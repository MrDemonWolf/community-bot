import { featureEnabled } from "@community-bot/core/features";
import { getFeatureConfigs, getRedemptions, getRewardConfigs, recordRedemption, setFeatureConfig,
  getRedemption, claimManualRedemption, completeRedemption, updateRedemptionStatus, upsertRewardConfig } from "@community-bot/db/features";
import { getSettings, updateSettings } from "@community-bot/db/settings";
import { decodeToken } from "@community-bot/db/twitch";
import { getCreatorClient } from "@community-bot/twitch";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requireCapability } from "../access";
import { ownerProcedure, protectedProcedure, router } from "../index";

const REWARD_SCOPE = ["channel:manage:redemptions"] as const;
const rewardInput = z.object({ title: z.string().trim().min(1).max(45), prompt: z.string().max(200),
  cost: z.number().int().min(1).max(2147483647), userInputRequired: z.boolean() });
type Settings = Awaited<ReturnType<typeof getSettings>>;
type Creator = Awaited<ReturnType<typeof getCreatorClient>>;
type Reward = Awaited<ReturnType<Creator["api"]["channelPoints"]["getCustomRewards"]>>[number];
type Snapshot = { eligible: boolean; rewards: Reward[]; manageable: Set<string> };
let cached: { key: string; until: number; value: Promise<Snapshot> } | undefined;

async function twitchRequest<T>(run: () => Promise<T>): Promise<T> {
  try { return await run(); }
  catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({ code: "BAD_GATEWAY", message: "Twitch could not complete this request. Refresh the queue or check creator authorization." });
  }
}

async function enabled(settings: Settings) {
  return settings.channelPointsEnabled && featureEnabled("channel-points", await getFeatureConfigs(), "twitch");
}
function configured(settings: Settings) {
  return Boolean(settings.twitchClientId && settings.twitchClientSecretEnc && settings.broadcasterUserId && settings.broadcasterTokenEnc);
}
function authorized(settings: Settings) {
  try { return Boolean(settings.broadcasterTokenEnc && decodeToken(settings.broadcasterTokenEnc).scope.includes(REWARD_SCOPE[0])); }
  catch { return false; }
}

async function snapshot(settings: Settings, force = false) {
  const key = JSON.stringify([settings.broadcasterUserId, settings.broadcasterTokenEnc, settings.twitchClientId, settings.twitchClientSecretEnc]);
  if (!force && cached?.key === key && cached.until > Date.now()) return cached.value;
  const work = (async () => {
    const creator = await getCreatorClient(settings, REWARD_SCOPE);
    const user = await creator.api.users.getUserById(creator.userId);
    const eligible = user?.broadcasterType === "affiliate" || user?.broadcasterType === "partner";
    if (!eligible) return { eligible: false, rewards: [], manageable: new Set<string>() };
    const [rewards, manageable] = await Promise.all([creator.api.channelPoints.getCustomRewards(creator.userId),
      creator.api.channelPoints.getCustomRewards(creator.userId, true)]);
    await creator.flush();
    return { eligible: true, rewards, manageable: new Set(manageable.map((reward) => reward.id)) };
  })();
  cached = { key, until: Date.now() + 30000, value: work };
  try { return await work; } catch (error) { cached = undefined; throw error; }
}

async function requireCreator() {
  const settings = await getSettings();
  if (!await enabled(settings)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The creator must enable Channel Points first." });
  if (!configured(settings) || !authorized(settings)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Reconnect the creator account and authorize Channel Points." });
  try {
    const client = await getCreatorClient(settings, REWARD_SCOPE);
    const profile = await client.api.users.getUserById(client.userId);
    if (profile?.broadcasterType !== "affiliate" && profile?.broadcasterType !== "partner") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Channel Points require an eligible Twitch Affiliate or Partner account." });
    }
    return client;
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({ code: "BAD_GATEWAY", message: "Could not authorize Twitch rewards. Reconnect the creator or try again." });
  }
}

async function requireManaged(client: Creator, rewardId: string) {
  const rewards = await client.api.channelPoints.getCustomRewards(client.userId, true);
  if (!rewards.some((reward) => reward.id === rewardId)) throw new TRPCError({ code: "FORBIDDEN", message: "This reward is managed by another application." });
}

async function view() {
  const settings = await getSettings();
  const configs = await getRewardConfigs();
  const byId = new Map(configs.map((config) => [config.rewardId, config]));
  const history = settings.broadcasterUserId ? await getRedemptions(100, settings.broadcasterUserId) : [];
  const base = { enabled: await enabled(settings), configured: configured(settings), authorized: authorized(settings),
    eligible: null as boolean | null, reason: "" as string, rewards: [] as Array<{
      rewardId: string; title: string; prompt: string; cost: number; isEnabled: boolean; userInputRequired: boolean;
      chatResponse: string | null; autoFulfill: boolean; isManaged: boolean;
    }>, redemptions: history.map((row) => ({ ...row, userLogin: row.login })) };
  if (!base.enabled) return { ...base, reason: "Channel Points are disabled. The creator can enable the connection." };
  if (!base.configured || !base.authorized) return { ...base, reason: "Reconnect the creator account to authorize Channel Points." };
  try {
    const remote = await snapshot(settings);
    return { ...base, eligible: remote.eligible,
      reason: remote.eligible ? "" : "This Twitch account is not currently an eligible Affiliate or Partner.",
      rewards: remote.rewards.map((reward) => ({ rewardId: reward.id, title: reward.title, prompt: reward.prompt,
        cost: reward.cost, isEnabled: reward.isEnabled, userInputRequired: reward.userInputRequired,
        chatResponse: byId.get(reward.id)?.chatResponse ?? null, autoFulfill: byId.get(reward.id)?.autoFulfill ?? false,
        isManaged: remote.manageable.has(reward.id) })) };
  } catch { return { ...base, authorized: false, reason: "Twitch rewards are unavailable. Check creator authorization and try again." }; }
}

export const rewardsRouter = router({
  get: protectedProcedure.query(({ ctx }) => { requireCapability(ctx.access, "redemptions:view", "twitch"); return view(); }),
  configure: ownerProcedure.input(z.object({ enabled: z.boolean() })).mutation(async ({ input }) => {
    await updateSettings({ channelPointsEnabled: input.enabled });
    await setFeatureConfig("twitch.channel-points", { enabled: input.enabled });
    cached = undefined; return view();
  }),
  refresh: protectedProcedure.mutation(async ({ ctx }) => {
    requireCapability(ctx.access, "redemptions:manage", "twitch");
    return twitchRequest(async () => {
    const client = await requireCreator();
    const rewards = await client.api.channelPoints.getCustomRewards(client.userId, true);
    const local = new Map((await getRewardConfigs()).map((reward) => [reward.rewardId, reward]));
    const tracked = await getRedemptions(100, client.userId);
    for (const reward of rewards) {
      await upsertRewardConfig({ rewardId: reward.id, title: reward.title, prompt: reward.prompt, cost: reward.cost,
        chatResponse: local.get(reward.id)?.chatResponse ?? null, autoFulfill: local.get(reward.id)?.autoFulfill ?? false, isManaged: true });
      const pending = await client.api.channelPoints.getRedemptionsForBroadcaster(client.userId, reward.id, "UNFULFILLED", { limit: 100, newestFirst: true });
      for (const redemption of pending.data) await recordRedemption({ redemptionId: redemption.id, rewardId: reward.id,
        broadcasterId: client.userId, userId: redemption.userId, login: redemption.userName,
        input: redemption.userInput.slice(0, 10000), status: "pending", receivedAt: redemption.redemptionDate });
      const ids = tracked.filter((row) => row.rewardId === reward.id && row.status === "pending").map((row) => row.redemptionId);
      if (ids.length) for (const row of await client.api.channelPoints.getRedemptionsByIds(client.userId, reward.id, ids)) {
        if (row.isFulfilled || row.isCanceled) await updateRedemptionStatus(row.id, client.userId, row.isFulfilled ? "fulfilled" : "canceled");
      }
    }
    await client.flush(); cached = undefined;
    return view();
    });
  }),
  create: protectedProcedure.input(rewardInput).mutation(async ({ ctx, input }) => {
    requireCapability(ctx.access, "features:manage", "twitch");
    return twitchRequest(async () => {
    const client = await requireCreator();
    // Keep Twitch's queue enabled so the worker completes only after its action succeeds.
    const reward = await client.api.channelPoints.createCustomReward(client.userId, { ...input, isEnabled: true, autoFulfill: false });
    await client.flush();
    await upsertRewardConfig({ rewardId: reward.id, title: reward.title, prompt: reward.prompt, cost: reward.cost,
      chatResponse: null, autoFulfill: false, isManaged: true });
    cached = undefined; return { rewardId: reward.id };
    });
  }),
  update: protectedProcedure.input(rewardInput.extend({ rewardId: z.string().min(1).max(100), isEnabled: z.boolean(),
    chatResponse: z.string().max(500).nullable(), autoFulfill: z.boolean() })).mutation(async ({ ctx, input }) => {
    requireCapability(ctx.access, "features:manage", "twitch");
    return twitchRequest(async () => {
    const client = await requireCreator();
    await requireManaged(client, input.rewardId);
    const reward = await client.api.channelPoints.updateCustomReward(client.userId, input.rewardId, {
      title: input.title, prompt: input.prompt, cost: input.cost, isEnabled: input.isEnabled,
      userInputRequired: input.userInputRequired, autoFulfill: false,
    });
    await client.flush();
    await upsertRewardConfig({ rewardId: reward.id, title: reward.title, prompt: reward.prompt, cost: reward.cost,
      chatResponse: input.chatResponse, autoFulfill: input.autoFulfill, isManaged: true });
    cached = undefined; return { rewardId: reward.id };
    });
  }),
  resolve: protectedProcedure.input(z.object({ redemptionId: z.string().min(1).max(100),
    status: z.enum(["fulfilled", "canceled"]) })).mutation(async ({ ctx, input }) => {
    requireCapability(ctx.access, "redemptions:manage", "twitch");
    return twitchRequest(async () => {
    const client = await requireCreator();
    const redemption = await getRedemption(input.redemptionId, client.userId);
    if (!redemption) throw new TRPCError({ code: "NOT_FOUND", message: "Redemption was not found in the current creator queue." });
    await requireManaged(client, redemption.rewardId);
    if (!await claimManualRedemption(redemption.redemptionId, client.userId)) throw new TRPCError({
      code: "CONFLICT", message: "This redemption is already processing or completed. Refresh the queue.",
    });
    try {
      const upstream = await client.api.channelPoints.getRedemptionById(client.userId, redemption.rewardId, redemption.redemptionId);
      if (!upstream) throw new TRPCError({ code: "NOT_FOUND", message: "Twitch no longer has this redemption." });
      const finalStatus = upstream.isFulfilled ? "fulfilled" : upstream.isCanceled ? "canceled" : null;
      if (finalStatus) {
        await completeRedemption(redemption.redemptionId, "sent", finalStatus);
        if (finalStatus !== input.status) throw new TRPCError({ code: "CONFLICT", message: "Twitch already completed this redemption with another status. The queue was updated." });
      } else {
        const updated = await client.api.channelPoints.updateRedemptionStatusByIds(client.userId, redemption.rewardId,
          [redemption.redemptionId], input.status === "fulfilled" ? "FULFILLED" : "CANCELED");
        if (!updated.some((row) => row.id === redemption.redemptionId && (input.status === "fulfilled" ? row.isFulfilled : row.isCanceled))) {
          throw new Error("Twitch did not confirm the requested redemption status");
        }
        await client.flush();
        await completeRedemption(redemption.redemptionId, "sent", input.status);
      }
    } catch (error) {
      // An ambiguous provider failure must never requeue the bot action automatically.
      await completeRedemption(redemption.redemptionId, "failed");
      throw error;
    }
    return { ok: true };
    });
  }),
});
