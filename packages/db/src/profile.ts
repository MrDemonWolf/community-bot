import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { personalAvatar, personalProfile } from "./schema/profile";

export type ProfileSource = "default" | "twitch" | "discord" | "custom";
export async function getPersonalProfile(userId: string) {
  const [profile] = await db.select().from(personalProfile).where(eq(personalProfile.userId, userId));
  const images = await db.select().from(personalAvatar).where(eq(personalAvatar.userId, userId));
  return { source: (profile?.source ?? "default") as ProfileSource, images };
}
export function profilePicture(profile: Awaited<ReturnType<typeof getPersonalProfile>>) {
  const image = profile.images.find((row) => row.source === profile.source);
  return { source: profile.source, version: image?.version ?? null,
    url: image ? `/api/profile-picture?v=${image.version}` : null };
}
export async function selectPersonalProfile(userId: string, source: ProfileSource, webp?: Buffer) {
  return db.transaction(async (tx) => {
    await tx.insert(personalProfile).values({ userId }).onConflictDoNothing();
    await tx.select().from(personalProfile).where(eq(personalProfile.userId, userId)).for("update");
    if (source !== "default") {
      if (webp) await tx.insert(personalAvatar).values({ userId, source, webp, version: randomUUID() })
        .onConflictDoUpdate({ target: [personalAvatar.userId, personalAvatar.source], set: { webp, version: randomUUID(), updatedAt: new Date() } });
      else if (!(await tx.select({ source: personalAvatar.source }).from(personalAvatar).where(and(eq(personalAvatar.userId, userId), eq(personalAvatar.source, source)))).length) return false;
    }
    await tx.update(personalProfile).set({ source }).where(eq(personalProfile.userId, userId));
    return true;
  });
}
