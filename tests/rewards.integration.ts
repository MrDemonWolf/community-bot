import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "bun:test";

assert.equal(process.env.REWARDS_TEST, "true", "Set REWARDS_TEST=true only against the disposable development database.");
assert.equal(process.env.NODE_ENV, "development");
const { db } = await import("../packages/db/src/index");
const { getSettings, updateSettings } = await import("../packages/db/src/settings");
const { getFeatureConfigs, setFeatureConfig, getRewardConfigs, getRedemptions, recordRedemption, claimRedemption, completeRedemption } = await import("../packages/db/src/features");
const { encrypt } = await import("../packages/db/src/crypto");
const { encodeToken } = await import("../packages/db/src/twitch");
const original = await getSettings();
if (original.twitchEnabled || original.discordEnabled) { await db.$client.end(); throw new Error("Stop both workers first."); }
const originalFeature = (await getFeatureConfigs()).find((feature) => feature.featureId === "twitch.channel-points");
const suffix = randomUUID();
const ownedId = "owned-" + suffix;
const foreignId = "foreign-" + suffix;
const createdId = "created-" + suffix;
const redemptionIds = ["redeem-owned-" + suffix, "redeem-foreign-" + suffix];
let eligible = true;
let upstreamUpdates = 0;
let resolvedStatus = "";
const reward = (id: string) => ({ id, title: "Fixture reward", prompt: "Fixture prompt", cost: 100, isEnabled: true, userInputRequired: false });
const rewards = [reward(ownedId), reward(foreignId)];
const manageable = new Set([ownedId]);
const realFetch = globalThis.fetch;
globalThis.fetch = Object.assign(async () => { throw new Error("Live network access is forbidden in reward fixtures"); }, { preconnect: realFetch.preconnect });
mock.module("@community-bot/twitch", () => ({
  getCreatorClient: async () => ({ userId: "999", auth: {}, flush: async () => {}, encryptedToken: () => "unused", api: {
    users: { getUserById: async () => ({ broadcasterType: eligible ? "affiliate" : "" }) },
    channelPoints: {
      getCustomRewards: async (_id: string, onlyManaged?: boolean) => onlyManaged ? rewards.filter((item) => manageable.has(item.id)) : rewards,
      getRedemptionsForBroadcaster: async () => ({ data: [] }),
      getRedemptionById: async (_user: string, _reward: string, id: string) => ({ id, isFulfilled: false, isCanceled: false }),
      createCustomReward: async (_id: string, input: Record<string, unknown>) => {
        assert.equal(input.autoFulfill, false); const created = { ...reward(createdId), ...input };
        rewards.push(created); manageable.add(created.id); return created;
      },
      updateCustomReward: async (_id: string, id: string, input: Record<string, unknown>) => {
        upstreamUpdates++; assert.equal(input.autoFulfill, false);
        const updated = { ...reward(id), ...input }; return updated;
      },
      updateRedemptionStatusByIds: async (_user: string, _reward: string, ids: string[], status: string) => {
        resolvedStatus = status; return ids.map((id) => ({ id, isFulfilled: status === "FULFILLED", isCanceled: status === "CANCELED" }));
      },
    },
  } }),
}));
const { appRouter } = await import("../packages/api/src/routers/index");
const now = new Date();
const actor = { id: randomUUID(), email: process.env.OWNER_EMAIL ?? "dev@localhost", emailVerified: true, name: "Fixture owner", image: null, createdAt: now, updatedAt: now };
const session = { id: randomUUID(), userId: actor.id, token: "fixture-session", expiresAt: new Date(Date.now() + 3600000), createdAt: now, updatedAt: now, ipAddress: null, userAgent: null };
const caller = appRouter.createCaller({ db, session: { session, user: actor } });
let checks = 0;
const check = (value: unknown, message: string) => { assert.ok(value, message); checks++; };

try {
  await updateSettings({ channelPointsEnabled: true, twitchEnabled: false, discordEnabled: false,
    twitchClientId: "fixturerewards123", twitchClientSecretEnc: encrypt("fixture-secret"),
    broadcasterUserId: "999", broadcasterLogin: "fixturecreator", channelName: "fixturecreator",
    broadcasterTokenEnc: encodeToken({ accessToken: "fixture-token", refreshToken: "fixture-refresh", expiresIn: 3600,
      obtainmentTimestamp: Date.now(), scope: ["channel:manage:redemptions"] }) });
  await caller.rewards.configure({ enabled: true });
  check((await getFeatureConfigs()).some((feature) => feature.featureId === "twitch.channel-points" && feature.enabled), "Owner reward connection enables its feature gate");
  const listing = await caller.rewards.get();
  check(listing.eligible === true && listing.authorized, "Eligible authorized creator can load rewards");
  check(listing.rewards.find((item) => item.rewardId === ownedId)?.isManaged === true
    && listing.rewards.find((item) => item.rewardId === foreignId)?.isManaged === false, "Live app-managed list controls editability");
  const input = { title: "Fixture edited", prompt: "", cost: 5, userInputRequired: true, isEnabled: true, chatResponse: "Thanks {user}", autoFulfill: true };
  await assert.rejects(() => caller.rewards.update({ ...input, rewardId: foreignId }), (error: unknown) => (error as { code?: string }).code === "FORBIDDEN"); checks++;
  check(upstreamUpdates === 0, "Unmanaged reward cannot reach upstream mutation");
  await assert.rejects(() => caller.rewards.create({ title: "", prompt: "", cost: 0, userInputRequired: false }), (error: unknown) => (error as { code?: string }).code === "BAD_REQUEST"); checks++;
  await caller.rewards.create({ title: "Fixture created", prompt: "", cost: 1, userInputRequired: false });
  check((await getRewardConfigs()).some((item) => item.rewardId === createdId && item.isManaged), "Created reward is persisted as app-managed");
  await caller.rewards.update({ ...input, rewardId: ownedId });
  const edited = (await getRewardConfigs()).find((item) => item.rewardId === ownedId);
  check(edited?.chatResponse === "Thanks {user}" && edited.autoFulfill === true, "Bot action and post-action fulfillment persist locally");
  for (const [index, rewardId] of [ownedId, foreignId].entries()) await recordRedemption({ redemptionId: redemptionIds[index]!, rewardId,
    broadcasterId: "999", userId: "123", login: "fixtureviewer", input: "fixture", status: "pending" });
  await assert.rejects(() => caller.rewards.resolve({ redemptionId: redemptionIds[1]!, status: "canceled" }), (error: unknown) => (error as { code?: string }).code === "FORBIDDEN"); checks++;
  check(Boolean(await claimRedemption(redemptionIds[0]!)), "Worker can atomically claim a pending redemption");
  await assert.rejects(() => caller.rewards.resolve({ redemptionId: redemptionIds[0]!, status: "fulfilled" }), (error: unknown) => (error as { code?: string }).code === "CONFLICT"); checks++;
  await completeRedemption(redemptionIds[0]!, "failed");
  await caller.rewards.resolve({ redemptionId: redemptionIds[0]!, status: "fulfilled" });
  check(resolvedStatus === "FULFILLED" && (await getRedemptions()).find((item) => item.redemptionId === redemptionIds[0])?.status === "fulfilled", "Fulfillment updates upstream and current-creator queue");
  eligible = false;
  await caller.rewards.configure({ enabled: true });
  check((await caller.rewards.get()).eligible === false, "Ineligible creator gets an explicit blocked state");
  await assert.rejects(() => caller.rewards.create({ title: "No eligibility", prompt: "", cost: 1, userInputRequired: false }), (error: unknown) => (error as { code?: string }).code === "PRECONDITION_FAILED"); checks++;
  await caller.rewards.configure({ enabled: false });
  check(!(await getSettings()).channelPointsEnabled && !(await caller.rewards.get()).enabled, "Owner can disable the reward connection");
} finally {
  globalThis.fetch = realFetch;
  try {
    await db.$client.query("DELETE FROM redemption WHERE redemption_id = ANY($1::text[])", [redemptionIds]);
    await db.$client.query("DELETE FROM reward_config WHERE reward_id = ANY($1::text[])", [[ownedId, foreignId, createdId]]);
    if (originalFeature) await setFeatureConfig("twitch.channel-points", originalFeature);
    else await db.$client.query("DELETE FROM feature_config WHERE feature_id = $1", ["twitch.channel-points"]);
    const { id: _id, createdAt: _created, updatedAt: _updated, ...restore } = original;
    await updateSettings(restore);
  } finally { await db.$client.end(); }
}
console.log(`Reward integration checks passed: ${checks}. Twitch was mocked; original settings and feature configuration restored.`);
