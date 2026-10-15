import { and, eq } from "drizzle-orm";

import { db } from "./index";
import { type Settings, settings } from "./schema/settings";
import { user, verification } from "./schema/auth";

const SINGLETON = "singleton";
type TwitchRole = "broadcaster" | "bot";
type OwnerTwitchAttempt = { userId: string; sessionId: string; role: TwitchRole; state: string };
const ownerTwitchIdentifier = (attempt: Pick<OwnerTwitchAttempt, "userId" | "role">) => `owner-twitch:${attempt.userId}:${attempt.role}`;

function matchesOwnerTwitchAttempt(row: { value: string; expiresAt: Date } | undefined,
  clientId: string, secretEnc: string, attempt: OwnerTwitchAttempt) {
  if (!row || row.expiresAt.getTime() <= Date.now() || !attempt.state || !attempt.sessionId) return false;
  try {
    const saved = JSON.parse(row.value);
    return saved.state === attempt.state && saved.sessionId === attempt.sessionId
      && saved.clientId === clientId && saved.secretEnc === secretEnc;
  } catch { return false; }
}

export async function beginOwnerTwitchConnection(attempt: OwnerTwitchAttempt, clientId: string, secretEnc: string) {
  if (!attempt.state || !attempt.sessionId || !clientId || !secretEnc) throw new Error("OAuth state, session, and application are required");
  await db.transaction(async (tx) => {
    // Begin, disconnect, and callback consume the same user lock: an old callback cannot undo Disconnect.
    const [owner] = await tx.select({ id: user.id }).from(user).where(eq(user.id, attempt.userId)).for("update");
    if (!owner) throw new Error("Twitch linking requires an existing user");
    const identifier = ownerTwitchIdentifier(attempt);
    await tx.delete(verification).where(eq(verification.identifier, identifier));
    await tx.insert(verification).values({ id: crypto.randomUUID(), identifier,
      value: JSON.stringify({ state: attempt.state, sessionId: attempt.sessionId, clientId, secretEnc }),
      expiresAt: new Date(Date.now() + 600000) });
  });
}

export async function verifyOwnerTwitchConnection(attempt: OwnerTwitchAttempt, clientId: string, secretEnc: string) {
  const [row] = await db.select().from(verification).where(eq(verification.identifier, ownerTwitchIdentifier(attempt)));
  return matchesOwnerTwitchAttempt(row, clientId, secretEnc, attempt);
}

export async function disconnectOwnerTwitchConnection(userId: string, role: TwitchRole) {
  return db.transaction(async (tx) => {
    await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update");
    await tx.delete(verification).where(eq(verification.identifier, ownerTwitchIdentifier({ userId, role })));
    const [updated] = await tx.update(settings).set(role === "broadcaster"
      ? { broadcasterUserId: null, broadcasterLogin: null, broadcasterTokenEnc: null, channelName: null, twitchEnabled: false }
      : { botUserId: null, botLogin: null, botTokenEnc: null, twitchEnabled: false })
      .where(eq(settings.id, SINGLETON)).returning();
    return updated!;
  });
}

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

export async function replaceBotToken(
  expectedEncrypted: string,
  nextEncrypted: string,
) {
  // Compare the old ciphertext atomically; refresh must not resurrect a cleared or replaced account.
  const rows = await db
    .update(settings)
    .set({ botTokenEnc: nextEncrypted })
    .where(
      and(
        eq(settings.id, SINGLETON),
        eq(settings.botTokenEnc, expectedEncrypted),
      ),
    )
    .returning({ id: settings.id });
  return rows.length === 1;
}

export async function replaceBroadcasterToken(
  expectedEncrypted: string,
  nextEncrypted: string,
) {
  // Web requests and the reward worker may refresh concurrently; only the current token may advance.
  const rows = await db
    .update(settings)
    .set({ broadcasterTokenEnc: nextEncrypted })
    .where(
      and(
        eq(settings.id, SINGLETON),
        eq(settings.broadcasterTokenEnc, expectedEncrypted),
      ),
    )
    .returning({ id: settings.id });
  return rows.length === 1;
}

// OAuth callbacks must pass their bound attempt; nonce-less calls are trusted internal writes.
export async function saveTwitchConnection(
  expectedClientId: string,
  expectedSecretEnc: string,
  patch: Partial<
    Pick<
      Settings,
      | "broadcasterUserId"
      | "broadcasterLogin"
      | "broadcasterTokenEnc"
      | "botUserId"
      | "botLogin"
      | "botTokenEnc"
      | "channelName"
      | "twitchEnabled"
    >
  >,
  attempt?: OwnerTwitchAttempt,
) {
  return db.transaction(async (tx) => {
    if (attempt) {
      // Consume the nonce in the same transaction as credentials, preventing replay and superseded attempts.
      const [owner] = await tx.select({ id: user.id }).from(user).where(eq(user.id, attempt.userId)).for("update");
      if (!owner) return false;
      const [pending] = await tx.select().from(verification).where(eq(verification.identifier, ownerTwitchIdentifier(attempt)));
      if (!matchesOwnerTwitchAttempt(pending, expectedClientId, expectedSecretEnc, attempt)) return false;
    }
    const rows = await tx.update(settings)
    .set(patch)
    .where(
      and(
        eq(settings.id, SINGLETON),
        eq(settings.twitchClientId, expectedClientId),
        eq(settings.twitchClientSecretEnc, expectedSecretEnc),
      ),
    )
    .returning({ id: settings.id });
    if (rows.length !== 1) return false;
    if (attempt) await tx.delete(verification).where(eq(verification.identifier, ownerTwitchIdentifier(attempt)));
    return true;
  });
}
