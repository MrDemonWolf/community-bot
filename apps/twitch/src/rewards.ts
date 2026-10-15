import { featureEnabled } from "@community-bot/core/features";
import { redemptionStatus, rewardMessage } from "@community-bot/core/rewards";
import { claimRedemption, completeRedemption, getFeatureConfigs, getPendingRedemptions, getRewardConfigs, recordRedemption, updateRedemptionStatus } from "@community-bot/db/features";
import { getSettings } from "@community-bot/db/settings";
import { getCreatorClient } from "@community-bot/twitch";
import { EventSubWsListener } from "@twurple/eventsub-ws";

type Settings = Awaited<ReturnType<typeof getSettings>>;
type Creator = Awaited<ReturnType<typeof getCreatorClient>>;
export class RewardRuntime {
  private active: { listener: EventSubWsListener; creator: Creator; key: string; failed: boolean; confirmations: number; validatedAt: number; recoveredAt: number; managedIds: Set<string> } | null = null;
  private retryAt = 0;
  private failureKey = "";
  detail = "Channel Points are disabled.";

  stop() { this.active?.listener.stop(); this.active = null; }
  private key(settings: Settings) {
    return JSON.stringify([settings.twitchClientId, settings.twitchClientSecretEnc, settings.broadcasterUserId]);
  }
  async reconcile(settings: Settings, send: (message: string) => Promise<boolean>) {
    // Event collection can stay connected while chat is paused; action execution checks Join/Mute again below.
    const enabled = settings.channelPointsEnabled && featureEnabled("channel-points", await getFeatureConfigs(), "twitch");
    if (!enabled) { this.stop(); this.detail = "Channel Points are disabled."; return; }
    if (!settings.broadcasterTokenEnc) { this.stop(); this.detail = "Authorize the creator account for Channel Points."; return; }
    const key = this.key(settings);
    if (this.failureKey !== key) { this.failureKey = key; this.retryAt = 0; }
    if (this.active) await this.active.creator.flush().catch(() => { this.active!.failed = true; });
    if (this.active && (this.active.failed || this.active.confirmations < 2 && Date.now() - this.active.validatedAt > 60000)) {
      this.retryAt = Date.now() + 60000;
      this.detail = "Reward subscriptions failed; retrying shortly. Check creator authorization.";
      this.stop();
    }
    if (this.active && (this.active.key !== key || settings.broadcasterTokenEnc !== this.active.creator.encryptedToken() ||
      this.active.failed || Date.now() - this.active.validatedAt > 3600000)) this.stop();
    try {
      if (!this.active) {
        if (Date.now() < this.retryAt) return;
        const creator = await getCreatorClient(settings, ["channel:manage:redemptions"]);
        const listener = new EventSubWsListener({ apiClient: creator.api });
        const session = { listener, creator, key, failed: false, confirmations: 0, validatedAt: Date.now(), recoveredAt: 0, managedIds: new Set<string>() };
        this.active = session;
        listener.onSubscriptionCreateSuccess(() => { session.confirmations++; });
        listener.onSubscriptionCreateFailure(() => { session.failed = true; });
        listener.onRevoke(() => { session.failed = true; });
        listener.onChannelRedemptionAdd(creator.userId, (event) => {
          void recordRedemption({ redemptionId: event.id, rewardId: event.rewardId, broadcasterId: event.broadcasterId,
            userId: event.userId, login: event.userName, input: event.input, status: redemptionStatus(event.status), receivedAt: event.redemptionDate,
          }).catch(() => { session.failed = true; });
        });
        listener.onChannelRedemptionUpdate(creator.userId, (event) => {
          void updateRedemptionStatus(event.id, event.broadcasterId, redemptionStatus(event.status)).catch(() => { session.failed = true; });
        });
        await listener.start();
      }
      const session = this.active!;
      const rewards = await getRewardConfigs();
      // EventSub has no replay: recover outstanding app-managed rewards after downtime.
      if (Date.now() - session.recoveredAt >= 60000) {
        session.recoveredAt = Date.now();
        const manageable = await session.creator.api.channelPoints.getCustomRewards(session.creator.userId, true);
        session.managedIds = new Set(manageable.map((reward) => reward.id));
        for (const reward of rewards.filter((reward) => reward.isManaged && session.managedIds.has(reward.rewardId))) {
          const pages = session.creator.api.channelPoints.getRedemptionsForBroadcasterPaginated(session.creator.userId, reward.rewardId, "UNFULFILLED", {});
          for await (const event of pages) {
            await recordRedemption({ redemptionId: event.id, rewardId: event.rewardId, broadcasterId: event.broadcasterId,
              userId: event.userId, login: event.userName, input: event.userInput, status: "pending", receivedAt: event.redemptionDate });
          }
        }
      }
      const actionable = rewards.filter((reward) => reward.isManaged && reward.chatResponse && session.managedIds.has(reward.rewardId)).map((reward) => reward.rewardId);
      for (const event of await getPendingRedemptions(session.creator.userId, actionable)) {
        const reward = rewards.find((reward) => reward.rewardId === event.rewardId && reward.isManaged);
        if (!reward?.chatResponse) continue;
        const current = await getSettings();
        await session.creator.flush();
        if (!current.twitchEnabled || current.twitchMuted || !current.channelPointsEnabled || this.key(current) !== key ||
          current.broadcasterTokenEnc !== session.creator.encryptedToken() ||
          !featureEnabled("channel-points", await getFeatureConfigs(), "twitch")) break;
        if (!await claimRedemption(event.redemptionId)) continue;
        try {
          const message = rewardMessage(reward.chatResponse, { login: event.login, input: event.input, title: reward.title });
          if (!message.trim() || !await send(message)) throw new Error("Chat response unavailable");
          if (reward.autoFulfill) {
            await session.creator.api.channelPoints.updateRedemptionStatusByIds(session.creator.userId, reward.rewardId, [event.redemptionId], "FULFILLED");
          }
          await completeRedemption(event.redemptionId, "sent", reward.autoFulfill ? "fulfilled" : undefined);
        } catch {
          // A send may have succeeded before a network failure. Never automatically repeat it.
          await completeRedemption(event.redemptionId, "failed");
        }
      }
      this.detail = session.confirmations >= 2 ? "Channel Point events connected; pending actions are saved in Rewards." : "Waiting for Twitch to confirm reward subscriptions.";
    } catch {
      this.stop(); this.retryAt = Date.now() + 60000;
      this.detail = "Channel Points need attention. Check creator authorization and reward permissions.";
    }
  }
}
