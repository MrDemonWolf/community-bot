/**
 * Twitch Bot — Entry point.
 *
 * Starts the Express health-check API, connects to Redis EventBus, loads
 * caches (commands, regulars, disabled commands, broadcaster IDs), and
 * connects to Twitch chat. If no Twitch credentials are found (setup
 * wizard not completed), the bot runs in "limited mode" with the API
 * server and EventBus active but no chat connection.
 */
import cron from "node-cron";

import { listenWithFallback } from "@community-bot/server";
import { EventBus } from "@community-bot/events";
import { env } from "./utils/env.js";
import { logger } from "./utils/logger.js";
import { db, eq } from "@community-bot/db";
import { users, botChannels, twitchCredentials } from "@community-bot/db";
import api from "./api/index.js";
import { createAuthProvider, createChatClient } from "./twitch/index.js";
import { registerConnectionEvents } from "./events/connected.js";
import { registerMessageEvents } from "./events/message.js";
import { registerJoinEvents } from "./events/join.js";
import { registerPartEvents } from "./events/part.js";
import { commandCache } from "./services/commandCache.js";
import { loadRegulars } from "./services/accessControl.js";
import { loadMutedState, setMuted } from "./services/botState.js";
import {
  loadDisabledCommands,
  reloadForChannel,
} from "./services/disabledCommandsCache.js";
import { setEventBus } from "./services/eventBusAccessor.js";
import * as streamStatusManager from "./services/streamStatusManager.js";
import { loadBroadcasterIds, loadBotChannelIds } from "./services/broadcasterCache.js";
import * as timerManager from "./services/timerManager.js";
import * as spamFilter from "./services/spamFilter.js";
import * as songRequestManager from "./services/songRequestManager.js";
import * as keywordCache from "./services/keywordCache.js";
import * as eventSubManager from "./services/eventSubManager.js";

export let botStatus = {
  status: "offline" as "offline" | "connecting" | "online",
};

// Start API server immediately so healthchecks pass even if later init fails
listenWithFallback(api, {
  port: env.PORT,
  host: env.HOST,
  name: "Twitch Bot",
});

async function main() {
  // Verify database connection on startup
  await db.query.users.findFirst();
  logger.database.connected("Drizzle");

  const eventBus = new EventBus(env.REDIS_URL);
  setEventBus(eventBus);

  // Log AI feature readiness
  const hasGeminiKey = !!env.GEMINI_API_KEY;
  const aiShoutoutEnabled = env.AI_SHOUTOUT_ENABLED === "true";
  if (hasGeminiKey && aiShoutoutEnabled) {
    logger.info("AI", "Shoutouts: ✓ ready (Gemini key set, globally enabled)");
  } else if (hasGeminiKey) {
    logger.warn("AI", "Shoutouts: ⚠ disabled (key set but AI_SHOUTOUT_ENABLED !== \"true\")");
  } else {
    logger.warn("AI", "Shoutouts: ✗ not configured (missing GEMINI_API_KEY)");
  }

  await commandCache.load();
  await loadRegulars();
  await loadMutedState();
  await loadDisabledCommands();
  await loadBroadcasterIds();
  await loadBotChannelIds();

  let authProvider: Awaited<ReturnType<typeof createAuthProvider>>["authProvider"] | null = null;
  let botUsername: string | null = null;

  try {
    const authResult = await createAuthProvider();
    authProvider = authResult.authProvider;
    botUsername = authResult.botUsername;
  } catch (err) {
    logger.warn(
      "Twitch Bot",
      "No Twitch credentials available. Bot will run without chat. Complete the setup wizard and restart.",
      err instanceof Error ? { error: err.message } : undefined
    );
  }

  // Subscribe to EventBus events that work without auth
  await eventBus.on("command:created", async () => {
    logger.info("EventBus", "Command created, reloading cache");
    await commandCache.reload();
  });

  await eventBus.on("command:updated", async () => {
    logger.info("EventBus", "Command updated, reloading cache");
    await commandCache.reload();
  });

  await eventBus.on("command:deleted", async () => {
    logger.info("EventBus", "Command deleted, reloading cache");
    await commandCache.reload();
  });

  await eventBus.on("regular:created", async () => {
    logger.info("EventBus", "Regular added, reloading list");
    await loadRegulars();
  });

  await eventBus.on("regular:deleted", async () => {
    logger.info("EventBus", "Regular removed, reloading list");
    await loadRegulars();
  });

  // Default commands toggled via web dashboard
  await eventBus.on("commands:defaults-updated", async (payload) => {
    logger.info(
      "EventBus",
      `Default commands updated for channel: ${payload.channelId}`
    );
    await reloadForChannel(payload.channelId);
  });

  // Timer updated via web dashboard — reload timers for that channel
  await eventBus.on("timer:updated", async (payload) => {
    logger.info("EventBus", `Timer updated for channel: ${payload.channelId}`);
    // payload.channelId is the botChannel.id; we need to look up the username
    const botChannel = await db.query.botChannels.findFirst({
      where: eq(botChannels.id, payload.channelId),
      columns: { twitchUsername: true },
    });
    if (botChannel) {
      await timerManager.reloadTimers(botChannel.twitchUsername);
    }
  });

  // Spam filter updated via web dashboard — reload for that channel
  await eventBus.on("spam-filter:updated", async (payload) => {
    logger.info("EventBus", `Spam filter updated for channel: ${payload.channelId}`);
    const botChannel = await db.query.botChannels.findFirst({
      where: eq(botChannels.id, payload.channelId),
      columns: { twitchUsername: true },
    });
    if (botChannel) {
      await spamFilter.reloadSpamFilter(botChannel.twitchUsername);
    }
  });

  // Song request settings updated via web dashboard — reload for that channel
  await eventBus.on("song-request:settings-updated", async (payload) => {
    logger.info("EventBus", `Song request settings updated for channel: ${payload.channelId}`);
    const botChannel = await db.query.botChannels.findFirst({
      where: eq(botChannels.id, payload.channelId),
      columns: { twitchUsername: true },
    });
    if (botChannel) {
      await songRequestManager.reloadSettings(botChannel.twitchUsername);
    }
  });

  // Playlist activated via web dashboard — reload song request settings
  await eventBus.on("playlist:activated", async (payload) => {
    logger.info("EventBus", `Playlist activated for channel: ${payload.channelId}`);
    const botChannel = await db.query.botChannels.findFirst({
      where: eq(botChannels.id, payload.channelId),
      columns: { twitchUsername: true },
    });
    if (botChannel) {
      await songRequestManager.reloadSettings(botChannel.twitchUsername);
    }
  });

  // Keyword events — reload keyword cache for the channel
  await eventBus.on("keyword:created", async () => {
    logger.info("EventBus", "Keyword created, reloading all keyword caches");
    // Reload all active channels' keyword caches
    const activeChannels = await db.query.botChannels.findMany({
      where: eq(botChannels.enabled, true),
      columns: { twitchUsername: true },
    });
    for (const ch of activeChannels) {
      await keywordCache.loadKeywords(ch.twitchUsername);
    }
  });

  await eventBus.on("keyword:updated", async () => {
    logger.info("EventBus", "Keyword updated, reloading all keyword caches");
    const activeChannels = await db.query.botChannels.findMany({
      where: eq(botChannels.enabled, true),
      columns: { twitchUsername: true },
    });
    for (const ch of activeChannels) {
      await keywordCache.loadKeywords(ch.twitchUsername);
    }
  });

  await eventBus.on("keyword:deleted", async () => {
    logger.info("EventBus", "Keyword deleted, reloading all keyword caches");
    const activeChannels = await db.query.botChannels.findMany({
      where: eq(botChannels.enabled, true),
      columns: { twitchUsername: true },
    });
    for (const ch of activeChannels) {
      await keywordCache.loadKeywords(ch.twitchUsername);
    }
  });

  // Stream status changes should restart timers with updated intervals
  await eventBus.on("stream:online", async (payload) => {
    await timerManager.onStreamStatusChange(payload.username);
  });

  await eventBus.on("stream:offline", async (payload) => {
    await timerManager.onStreamStatusChange(payload.username);
  });

  // Fallback cron: reload commands + regulars every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      await commandCache.reload();
      await loadRegulars();
      await loadDisabledCommands();
    } catch (err) {
      logger.warn("Cron", "Failed to reload commands/regulars", err instanceof Error ? { error: err.message } : undefined);
    }
  });

  // If no credentials, run in limited mode (API + EventBus only, no chat).
  // This happens when the setup wizard hasn't been completed yet.
  if (!authProvider || !botUsername) {
    logger.info("Twitch Bot", "Running in limited mode — API server and EventBus active, no chat connection.");
    return;
  }

  // Load enabled channels from DB. Use a Set to deduplicate — the bot's
  // own channel is always included so it can receive commands there too.
  const enabledChannels = await db.query.botChannels.findMany({
    where: eq(botChannels.enabled, true),
  });
  const channels = [
    ...new Set([botUsername, ...enabledChannels.map((c) => c.twitchUsername)]),
  ];

  const getAccessToken = async () => {
    const cred = await db.query.twitchCredentials.findFirst();
    return cred?.accessToken ?? "";
  };

  await streamStatusManager.start(
    channels,
    env.TWITCH_APPLICATION_CLIENT_ID,
    getAccessToken,
    eventBus
  );

  const chatClient = createChatClient(authProvider, channels);
  registerConnectionEvents(chatClient, channels);
  registerMessageEvents(chatClient);
  registerJoinEvents(chatClient);
  registerPartEvents(chatClient);

  // Initialize EventSub WebSocket for chat alerts, channel points, and automod
  await eventSubManager.initEventSub(authProvider);
  eventSubManager.setAlertChatClient(chatClient);

  // Set chat client for timer manager and load timers + spam filters + keywords for all channels
  timerManager.setChatClient(chatClient);
  for (const ch of channels) {
    await timerManager.loadTimers(ch);
    await spamFilter.loadSpamFilter(ch);
    await songRequestManager.loadSettings(ch);
    await keywordCache.loadKeywords(ch);
  }

  // Subscribe to EventSub events for all enabled channels
  for (const ch of enabledChannels) {
    await eventSubManager.subscribeChannel(ch.twitchUserId, ch.twitchUsername, ch.id);
  }

  // Subscribe to EventBus events that require chat
  await eventBus.on("channel:join", async (payload) => {
    logger.info("EventBus", `Joining channel: ${payload.username}`);
    chatClient.join(payload.username);
    streamStatusManager.addChannel(payload.username);
    await timerManager.loadTimers(payload.username);
    await spamFilter.loadSpamFilter(payload.username);
    await songRequestManager.loadSettings(payload.username);
    await keywordCache.loadKeywords(payload.username);
    // Subscribe to EventSub events for new channel
    const botCh = await db.query.botChannels.findFirst({
      where: eq(botChannels.twitchUsername, payload.username.toLowerCase()),
    });
    if (botCh) {
      await eventSubManager.subscribeChannel(botCh.twitchUserId, payload.username, botCh.id);
    }
  });

  await eventBus.on("channel:leave", async (payload) => {
    logger.info("EventBus", `Leaving channel: ${payload.username}`);
    chatClient.part(payload.username);
    streamStatusManager.removeChannel(payload.username);
    timerManager.stopTimers(payload.username);
    songRequestManager.clearCache(payload.username);
    keywordCache.clearKeywords(payload.username);
  });

  // Mute/unmute via web dashboard
  await eventBus.on("bot:mute", async (payload) => {
    logger.info(
      "EventBus",
      `Bot ${payload.muted ? "muted" : "unmuted"} for channel: ${payload.username}`
    );
    setMuted(payload.username, payload.muted);
  });

  // Connect to Twitch
  botStatus.status = "connecting";
  chatClient.connect();

  await eventBus.publish("bot:status", {
    service: "twitch",
    status: "connecting",
  });

  logger.info("Twitch Bot", `Joining channels: ${channels.join(", ")}`);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);

  // Provide a clear, actionable message based on the failure type
  if (
    message.includes("credentials") ||
    message.includes("token") ||
    message.includes("TwitchCredential")
  ) {
    logger.warn(
      "Twitch Bot",
      "Twitch credentials not found. Complete the setup wizard at the web dashboard, then restart the bot."
    );
  } else if (
    message.includes("ECONNREFUSED") ||
    message.includes("connect")
  ) {
    logger.error(
      "Twitch Bot",
      "Could not connect to a required service (database or Redis). Check that PostgreSQL and Redis are running.",
      err
    );
  } else {
    logger.error("Twitch Bot", "Startup failed", err);
  }

  logger.info(
    "Twitch Bot",
    "API server remains active for healthchecks. Chat features are unavailable until the issue is resolved."
  );
});
