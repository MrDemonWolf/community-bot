import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "./index";
import { featureConfig, permissionMapping, platformIdentity, redemption, rewardConfig } from "./schema/features";
import { settings } from "./schema/settings";
import { user, verification } from "./schema/auth";

export async function getFeatureConfigs() {
  return db.select().from(featureConfig);
}

export async function setFeatureConfig(featureId: string, patch: Partial<Pick<typeof featureConfig.$inferInsert, "enabled" | "config" | "version">>) {
  const [row] = await db.insert(featureConfig).values({ featureId, ...patch })
    .onConflictDoUpdate({ target: featureConfig.featureId, set: { ...patch, updatedAt: new Date() } }).returning();
  return row!;
}

export async function getPlatformIdentities(userId: string) {
  return db.select().from(platformIdentity).where(eq(platformIdentity.userId, userId));
}

export async function upsertPlatformIdentity(input: Omit<typeof platformIdentity.$inferInsert, "id">) {
  const values = { ...input, roles: input.roles ?? [], verifiedAt: input.verifiedAt ?? null, expiresAt: input.expiresAt ?? null };
  const [row] = await db.insert(platformIdentity).values(values).onConflictDoUpdate({
    target: [platformIdentity.userId, platformIdentity.provider], set: values,
  }).returning();
  return row!;
}

export async function beginPlatformIdentityLink(userId: string, provider: "twitch" | "discord", nonce: string) {
  const identifier = `identity-link:${userId}:${provider}`;
  await db.transaction(async (tx) => {
    const [owner] = await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update");
    if (!owner) throw new Error("Identity linking requires an existing user");
    await tx.delete(verification).where(eq(verification.identifier, identifier));
    await tx.insert(verification).values({ id: crypto.randomUUID(), identifier, value: nonce, expiresAt: new Date(Date.now() + 600_000) });
  });
}

export async function savePlatformIdentity(
  expected: { provider: "twitch" | "discord"; clientId: string; clientSecretEnc: string; guildId?: string | null; linkState?: string },
  input: Omit<typeof platformIdentity.$inferInsert, "id">,
) {
  if (expected.provider !== input.provider) return null;
  return db.transaction(async (tx) => {
    const [owner] = await tx.select({ id: user.id }).from(user).where(eq(user.id, input.userId)).for("update");
    if (!owner) return null;
    const identifier = `identity-link:${input.userId}:${input.provider}`;
    if (expected.linkState !== undefined) {
      const [pending] = await tx.select().from(verification).where(eq(verification.identifier, identifier));
      if (!pending || pending.value !== expected.linkState || pending.expiresAt <= new Date()) return null;
    }
    const [current] = await tx.select().from(settings).where(eq(settings.id, "singleton")).for("update");
    if (!current || (expected.provider === "twitch"
      ? current.twitchClientId !== expected.clientId || current.twitchClientSecretEnc !== expected.clientSecretEnc
      : current.discordApplicationId !== expected.clientId || current.discordClientSecretEnc !== expected.clientSecretEnc ||
        (expected.guildId !== undefined && current.discordGuildId !== expected.guildId))) return null;
    const values = { ...input, roles: input.roles ?? [], verifiedAt: input.verifiedAt ?? null, expiresAt: input.expiresAt ?? null };
    const [row] = await tx.insert(platformIdentity).values(values).onConflictDoUpdate({
      target: [platformIdentity.userId, platformIdentity.provider], set: values,
    }).returning();
    if (expected.linkState !== undefined) await tx.delete(verification).where(eq(verification.identifier, identifier));
    return row!;
  });
}

export async function deletePlatformIdentity(userId: string, provider: "twitch" | "discord") {
  await db.transaction(async (tx) => {
    await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update");
    await tx.delete(verification).where(eq(verification.identifier, `identity-link:${userId}:${provider}`));
    await tx.delete(platformIdentity).where(and(eq(platformIdentity.userId, userId), eq(platformIdentity.provider, provider)));
  });
}

export async function replacePlatformIdentityToken(id: string, expectedTokenEnc: string, nextTokenEnc: string) {
  const rows = await db.update(platformIdentity).set({ tokenEnc: nextTokenEnc }).where(and(
    eq(platformIdentity.id, id), eq(platformIdentity.tokenEnc, expectedTokenEnc),
  )).returning({ id: platformIdentity.id });
  return rows.length === 1;
}

export async function getPermissionMappings() {
  return db.select().from(permissionMapping);
}

export async function upsertPermissionMapping(input: Omit<typeof permissionMapping.$inferInsert, "createdAt" | "updatedAt">) {
  const [row] = await db.insert(permissionMapping).values(input).onConflictDoUpdate({
    target: [permissionMapping.provider, permissionMapping.sourceRoleId, permissionMapping.role],
    set: { scopes: input.scopes ?? [], updatedAt: new Date() },
  }).returning();
  return row!;
}

export async function deletePermissionMapping(id: string) {
  await db.delete(permissionMapping).where(eq(permissionMapping.id, id));
}

export async function getRewardConfigs() {
  return db.select().from(rewardConfig);
}

export async function upsertRewardConfig(input: typeof rewardConfig.$inferInsert) {
  const [row] = await db.insert(rewardConfig).values(input).onConflictDoUpdate({
    target: rewardConfig.rewardId, set: { ...input, updatedAt: new Date() },
  }).returning();
  return row!;
}

export async function recordRedemption(input: Omit<typeof redemption.$inferInsert, "handledAt" | "actionState">) {
  const rows = await db.insert(redemption).values(input).onConflictDoNothing().returning({ id: redemption.redemptionId });
  return rows.length === 1;
}

export async function getRedemptions(limit = 100, broadcasterId?: string) {
  return db.select().from(redemption).where(broadcasterId ? eq(redemption.broadcasterId, broadcasterId) : undefined)
    .orderBy(desc(redemption.receivedAt)).limit(Math.min(100, Math.max(1, limit)));
}

export async function getRedemption(redemptionId: string, broadcasterId: string) {
  const [row] = await db.select().from(redemption).where(and(eq(redemption.redemptionId, redemptionId), eq(redemption.broadcasterId, broadcasterId)));
  return row ?? null;
}

export async function claimManualRedemption(redemptionId: string, broadcasterId: string) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(redemption).where(and(eq(redemption.redemptionId, redemptionId), eq(redemption.broadcasterId, broadcasterId))).for("update");
    if (!row || row.status !== "pending" || row.actionState === "processing") return null;
    await tx.update(redemption).set({ actionState: "processing" }).where(eq(redemption.redemptionId, redemptionId));
    return row;
  });
}

export async function getPendingRedemptions(broadcasterId: string, rewardIds: string[]) {
  if (!rewardIds.length) return [];
  return db.select().from(redemption).where(and(eq(redemption.broadcasterId, broadcasterId),
    inArray(redemption.rewardId, rewardIds), eq(redemption.status, "pending"), eq(redemption.actionState, "pending")))
    .orderBy(asc(redemption.receivedAt)).limit(50);
}

export async function updateRedemptionStatus(redemptionId: string, broadcasterId: string, status: "pending" | "fulfilled" | "canceled") {
  return db.update(redemption).set({ status, ...(status === "pending" ? {} : { handledAt: new Date() }) }).where(and(
    eq(redemption.redemptionId, redemptionId), eq(redemption.broadcasterId, broadcasterId),
  )).returning();
}

export async function claimRedemption(redemptionId: string) {
  const [row] = await db.update(redemption).set({ actionState: "processing" }).where(and(
    eq(redemption.redemptionId, redemptionId), eq(redemption.actionState, "pending"), eq(redemption.status, "pending"),
  )).returning();
  return row ?? null;
}

export async function completeRedemption(redemptionId: string, actionState: "sent" | "failed", status?: "pending" | "fulfilled" | "canceled") {
  const [row] = await db.update(redemption).set({ actionState, ...(status ? { status } : {}), handledAt: new Date() }).where(and(
    eq(redemption.redemptionId, redemptionId), eq(redemption.actionState, "processing"),
  )).returning();
  return row ?? null;
}
