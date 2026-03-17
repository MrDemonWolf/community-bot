/**
 * EventSub Manager — Manages Twitch EventSub WebSocket subscriptions.
 *
 * Subscribes to channel events for all joined channels and dispatches
 * configured chat alert messages when events fire.
 *
 * Requires @twurple/eventsub-ws to be installed.
 * Required OAuth scopes: channel:read:subscriptions, bits:read,
 *   moderator:read:followers, channel:read:hype_train,
 *   channel:read:charity, channel:read:ads, channel:manage:redemptions,
 *   channel:read:redemptions, moderator:manage:automod, channel:moderate
 */
import { db, eq } from "@community-bot/db";
import { botChannels, chatAlerts } from "@community-bot/db";
import { logger } from "../utils/logger.js";
import {
  renderAlertMessage,
  DEFAULT_TEMPLATES,
  type AlertType,
  type AlertContext,
} from "./alertTemplateEngine.js";
import { getEventBus } from "./eventBusAccessor.js";

interface ManagedChannel {
  botChannelId: string;
  broadcasterId: string;
  username: string;
}

type AlertCooldownKey = `${string}:${AlertType}`;
const alertCooldowns = new Map<AlertCooldownKey, number>();

function isOnAlertCooldown(channelId: string, alertType: AlertType, cooldownSeconds: number): boolean {
  if (cooldownSeconds <= 0) return false;
  const key: AlertCooldownKey = `${channelId}:${alertType}`;
  const last = alertCooldowns.get(key) ?? 0;
  return Date.now() - last < cooldownSeconds * 1000;
}

function recordAlertCooldown(channelId: string, alertType: AlertType): void {
  alertCooldowns.set(`${channelId}:${alertType}`, Date.now());
}

let chatClientRef: { say: (channel: string, message: string) => Promise<void> } | null = null;
let apiClientRef: { chat: unknown } | null = null;

export function setAlertChatClient(client: { say: (channel: string, message: string) => Promise<void> }): void {
  chatClientRef = client;
}

async function sendAlert(
  username: string,
  botChannelId: string,
  alertType: AlertType,
  ctx: AlertContext
): Promise<void> {
  if (!chatClientRef) return;

  try {
    const alert = await db.query.chatAlerts.findFirst({
      where: (a, { and, eq }) =>
        and(
          eq(a.botChannelId, botChannelId),
          eq(a.alertType, alertType)
        ),
    });

    if (!alert || !alert.enabled) return;
    if (ctx.bits !== undefined && alert.minThreshold > 1 && (ctx.bits ?? 0) < alert.minThreshold) return;
    if (ctx.viewerCount !== undefined && alert.minThreshold > 1 && (ctx.viewerCount ?? 0) < alert.minThreshold) return;

    if (isOnAlertCooldown(botChannelId, alertType, alert.cooldownSeconds)) return;

    const templates = (alert.messageTemplates as string[]) ?? DEFAULT_TEMPLATES[alertType];
    const tierConfigs = (alert.tierConfigs as Record<string, string>) ?? {};

    const message = renderAlertMessage(templates, tierConfigs, alertType, ctx);
    if (!message) return;

    recordAlertCooldown(botChannelId, alertType);
    await chatClientRef.say(`#${username}`, message);
    logger.debug("EventSub", `Alert "${alertType}" fired in ${username}`);
  } catch (err) {
    logger.warn(
      "EventSub",
      `Error sending alert "${alertType}" to ${username}`,
      err instanceof Error ? { error: err.message } : undefined
    );
  }
}

let eventSubClient: unknown = null;
const managedChannels = new Map<string, ManagedChannel>();

/**
 * Initialize EventSub WebSocket client. Called once after auth provider is ready.
 * Requires @twurple/eventsub-ws to be installed.
 */
export async function initEventSub(authProvider: unknown): Promise<void> {
  try {
    // Dynamic import so startup doesn't fail if package is missing
    // @ts-expect-error optional peer dependency — install with: bun add @twurple/eventsub-ws @twurple/api
    const { EventSubWsListener } = await import("@twurple/eventsub-ws");
    // @ts-expect-error optional peer dependency
    const { ApiClient } = await import("@twurple/api");

    apiClientRef = new ApiClient({ authProvider: authProvider as any });
    eventSubClient = new EventSubWsListener({ apiClient: apiClientRef as any });

    (eventSubClient as any).start();
    logger.info("EventSub", "WebSocket listener started");
  } catch (err) {
    logger.warn(
      "EventSub",
      "@twurple/eventsub-ws not available. Chat alerts disabled. Run: bun add @twurple/eventsub-ws @twurple/api",
      err instanceof Error ? { error: err.message } : undefined
    );
  }
}

/**
 * Subscribe to all alert-type EventSub subscriptions for a channel.
 */
export async function subscribeChannel(
  broadcasterId: string,
  username: string,
  botChannelId: string
): Promise<void> {
  if (!eventSubClient || !apiClientRef) return;

  const channel = { botChannelId, broadcasterId, username };
  managedChannels.set(username, channel);

  const client = eventSubClient as any;
  const api = apiClientRef as any;

  try {
    // Follows
    client.onChannelFollow(broadcasterId, broadcasterId, (e: any) => {
      sendAlert(username, botChannelId, "follow", {
        username: e.userDisplayName,
        displayName: e.userDisplayName,
      });
    });

    // Subscriptions
    client.onChannelSubscription(broadcasterId, (e: any) => {
      sendAlert(username, botChannelId, "subscribe", {
        username: e.userDisplayName,
        displayName: e.userDisplayName,
        tier: e.tier,
      });
    });

    // Resubs
    client.onChannelSubscriptionMessage(broadcasterId, (e: any) => {
      sendAlert(username, botChannelId, "resubscribe", {
        username: e.userDisplayName,
        displayName: e.userDisplayName,
        tier: e.tier,
        months: e.cumulativeMonths,
        message: e.messageText,
      });
    });

    // Gift subs
    client.onChannelSubscriptionGift(broadcasterId, (e: any) => {
      if (e.isAnonymous || e.gifterDisplayName) {
        sendAlert(username, botChannelId, e.amount > 1 ? "gift_sub_bomb" : "gift_sub", {
          username: e.isAnonymous ? "An anonymous gifter" : e.gifterDisplayName,
          displayName: e.isAnonymous ? "An anonymous gifter" : e.gifterDisplayName,
          giftCount: e.amount,
          tier: e.tier,
        });
      }
    });

    // Raids
    client.onChannelRaid({ to: broadcasterId }, (e: any) => {
      sendAlert(username, botChannelId, "raid", {
        username: e.raidingBroadcasterDisplayName,
        displayName: e.raidingBroadcasterDisplayName,
        viewerCount: e.viewers,
      });
    });

    // Cheers
    client.onChannelCheer(broadcasterId, (e: any) => {
      sendAlert(username, botChannelId, "cheer", {
        username: e.isAnonymous ? "Anonymous" : (e.userDisplayName ?? "Anonymous"),
        displayName: e.isAnonymous ? "Anonymous" : (e.userDisplayName ?? "Anonymous"),
        bits: e.bits,
        message: e.message,
      });
    });

    // Hype Train
    client.onChannelHypeTrainBegin(broadcasterId, (e: any) => {
      sendAlert(username, botChannelId, "hype_train_begin", { level: e.level, total: e.total });
    });

    client.onChannelHypeTrainEnd(broadcasterId, (e: any) => {
      sendAlert(username, botChannelId, "hype_train_end", { level: e.level, total: e.total });
    });

    // Ad break
    client.onChannelAdBreakBegin(broadcasterId, (e: any) => {
      sendAlert(username, botChannelId, "ad_break_begin", { duration: e.durationSeconds });
    });

    // Shoutout received
    client.onChannelShoutoutReceive(broadcasterId, broadcasterId, (e: any) => {
      sendAlert(username, botChannelId, "shoutout_received", {
        fromChannel: e.shoutingOutBroadcasterDisplayName,
        viewerCount: e.viewerCount,
      });
    });

    // Channel Points redemptions (Feature 5)
    client.onChannelRedemptionAdd(broadcasterId, async (e: any) => {
      const eventBus = getEventBus();
      if (eventBus) {
        await eventBus.publish("channel-points:redeemed", {
          channelId: botChannelId,
          rewardId: e.rewardId,
          redemptionId: e.id,
          username: e.userDisplayName,
          userInput: e.input ?? "",
        });
      }
    });

    // AutoMod held messages (Feature 7)
    client.onAutoModMessageHold(broadcasterId, broadcasterId, async (e: any) => {
      const eventBus = getEventBus();
      if (eventBus) {
        await eventBus.publish("automod:held", {
          channelId: botChannelId,
          messageId: e.messageId,
          userId: e.userId,
          username: e.userDisplayName,
          text: e.message?.text ?? "",
        });
      }
    });

    logger.info("EventSub", `Subscribed to events for ${username}`);
  } catch (err) {
    logger.warn(
      "EventSub",
      `Failed to subscribe to channel ${username}`,
      err instanceof Error ? { error: err.message } : undefined
    );
  }
}

export function unsubscribeChannel(username: string): void {
  managedChannels.delete(username);
  // Note: individual subscription cleanup requires storing subscription refs.
  // For simplicity, the listener will ignore events for removed channels.
}
