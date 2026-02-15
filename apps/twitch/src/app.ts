import cron from "node-cron";

import { listenWithFallback } from "@community-bot/server";
import { EventBus } from "@community-bot/events";
import { env } from "./utils/env.js";
import { logger } from "./utils/logger.js";
import { prisma } from "@community-bot/db";
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

export let botStatus = {
  status: "offline" as "offline" | "connecting" | "online",
};

async function main() {
  await prisma.$connect();

  listenWithFallback(api, {
    port: env.PORT,
    host: env.HOST,
    name: "Twitch Bot",
  });

  const eventBus = new EventBus(env.REDIS_URL);
  setEventBus(eventBus);

  await commandCache.load();
  await loadRegulars();
  await loadMutedState();
  await loadDisabledCommands();

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

  if (!authProvider || !botUsername) {
    logger.info("Twitch Bot", "Running in limited mode — API server and EventBus active, no chat connection.");
    return;
  }

  // Load channels from database
  const botChannels = await prisma.botChannel.findMany({
    where: { enabled: true },
  });
  const channels = [
    ...new Set([botUsername, ...botChannels.map((c) => c.twitchUsername)]),
  ];

  const getAccessToken = async () => {
    const cred = await prisma.twitchCredential.findFirst();
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

  // Subscribe to EventBus events that require chat
  await eventBus.on("channel:join", async (payload) => {
    logger.info("EventBus", `Joining channel: ${payload.username}`);
    chatClient.join(payload.username);
    streamStatusManager.addChannel(
      payload.username,
      env.TWITCH_APPLICATION_CLIENT_ID,
      getAccessToken,
      eventBus
    );
  });

  await eventBus.on("channel:leave", async (payload) => {
    logger.info("EventBus", `Leaving channel: ${payload.username}`);
    chatClient.part(payload.username);
    streamStatusManager.removeChannel(payload.username);
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
  logger.error("Twitch Bot", "Fatal error", err);
  process.exit(1);
});
