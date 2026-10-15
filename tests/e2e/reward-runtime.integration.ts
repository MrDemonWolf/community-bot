import assert from "node:assert/strict";
import { mock } from "bun:test";

// This process replaces every external adapter; it cannot contact a provider.
globalThis.fetch = (async () => { throw new Error("Network forbidden in runtime fixture"); }) as typeof fetch;
const settings = { channelPointsEnabled: true, twitchEnabled: false, twitchMuted: false,
  twitchClientId: "app", twitchClientSecretEnc: "secret", broadcasterUserId: "123", broadcasterTokenEnc: "token" };
const rows = new Map<string, any>();
const reward = { rewardId: "reward", title: "Hydrate", isManaged: true, chatResponse: "@{user} {reward}: {input}", autoFulfill: true };
let enabled = true;
let sent = 0;
let fulfilled = 0;
let listener: FakeListener;
class FakeListener {
  add: (event: any) => void = () => {};
  updated: (event: any) => void = () => {};
  confirmed: () => void = () => {};
  stopped = false;
  constructor() { listener = this; }
  onSubscriptionCreateSuccess(handler: () => void) { this.confirmed = handler; }
  onSubscriptionCreateFailure() {}
  onRevoke() {}
  onChannelRedemptionAdd(_id: string, handler: (event: any) => void) { this.add = handler; }
  onChannelRedemptionUpdate(_id: string, handler: (event: any) => void) { this.updated = handler; }
  async start() { this.confirmed(); this.confirmed(); }
  stop() { this.stopped = true; }
}
mock.module("@twurple/eventsub-ws", () => ({ EventSubWsListener: FakeListener }));
mock.module("@community-bot/db/settings", () => ({ getSettings: async () => ({ ...settings }) }));
mock.module("@community-bot/db/features", () => ({
  getFeatureConfigs: async () => [{ featureId: "twitch.channel-points", enabled, config: {} }],
  getRewardConfigs: async () => [reward],
  recordRedemption: async (row: any) => { if (rows.has(row.redemptionId)) return false; rows.set(row.redemptionId, { ...row, actionState: "pending" }); return true; },
  getPendingRedemptions: async (broadcaster: string, rewards: string[]) => [...rows.values()].filter((row) => row.broadcasterId === broadcaster && rewards.includes(row.rewardId) && row.actionState === "pending" && row.status === "pending"),
  claimRedemption: async (id: string) => { const row = rows.get(id); if (!row || row.actionState !== "pending" || row.status !== "pending") return null; row.actionState = "processing"; return row; },
  completeRedemption: async (id: string, action: string, status?: string) => { const row = rows.get(id); row.actionState = action; if (status) row.status = status; return row; },
  updateRedemptionStatus: async (id: string, _broadcaster: string, status: string) => { if (rows.has(id)) rows.get(id).status = status; },
}));
mock.module("@community-bot/twitch", () => ({ getCreatorClient: async () => ({ userId: "123", auth: {},
  encryptedToken: () => "token", flush: async () => {}, api: { channelPoints: {
    getCustomRewards: async () => [{ id: "reward" }],
    getRedemptionsForBroadcasterPaginated: () => ({ async *[Symbol.asyncIterator]() {} }),
    updateRedemptionStatusByIds: async () => { fulfilled++; return []; },
  } },
}) }));

const { RewardRuntime } = await import("../../apps/twitch/src/rewards");
const runtime = new RewardRuntime();
const send = async () => { sent++; return true; };
const reconcile = () => runtime.reconcile({ ...settings } as any, send);
await reconcile();
const event = { id: "one", rewardId: "reward", broadcasterId: "123", userId: "456", userName: "viewer", input: "hello", status: "UNFULFILLED", redemptionDate: new Date() };
listener!.add(event);
await reconcile();
assert.equal(rows.get("one").actionState, "pending", "chat leave preserves a queued action");
assert.equal(sent, 0);
settings.twitchEnabled = true;
await reconcile();
assert.equal(sent, 1);
assert.equal(fulfilled, 1);
assert.equal(rows.get("one").status, "fulfilled");
listener!.add(event);
await reconcile();
assert.equal(sent, 1, "duplicate delivery must not repeat a response");
listener!.add({ ...event, id: "two" });
await runtime.reconcile({ ...settings } as any, async () => { throw new Error("uncertain send"); });
assert.equal(rows.get("two").actionState, "failed");
await reconcile();
assert.equal(sent, 1, "uncertain sends must never auto-retry");
listener!.add({ ...event, id: "three" });
settings.twitchMuted = true;
await reconcile();
assert.equal(rows.get("three").actionState, "pending");
enabled = false;
await reconcile();
assert.equal(listener!.stopped, true);
assert.equal(sent, 1);
console.log("Reward runtime: leave, mute, deduplication, successful fulfillment, uncertain-send protection and feature stop passed.");
