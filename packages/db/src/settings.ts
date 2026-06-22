import { eq } from "drizzle-orm";

import { db } from "./index";
import { type Settings, settings } from "./schema/settings";

const SINGLETON = "singleton";

/** Fetch the single settings row, creating defaults on first call. */
export async function getSettings(): Promise<Settings> {
  const existing = await db.query.settings.findFirst({
    where: eq(settings.id, SINGLETON),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(settings)
    .values({ id: SINGLETON })
    .onConflictDoNothing()
    .returning();
  return created ?? (await getSettings());
}

/** Patch the settings row (upsert on the singleton). */
export async function updateSettings(
  patch: Partial<Omit<Settings, "id" | "createdAt" | "updatedAt">>,
): Promise<Settings> {
  await getSettings();
  const [updated] = await db
    .update(settings)
    .set(patch)
    .where(eq(settings.id, SINGLETON))
    .returning();
  return updated!;
}
