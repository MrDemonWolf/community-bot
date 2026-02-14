import consola from "consola";
import cron from "node-cron";

import { listenWithFallback } from "@community-bot/server";
import { EventBus } from "@community-bot/events";
import { env } from "./utils/env.js";
import { prisma } from "@community-bot/db";
import api from "./api/index.js";
import { createAuthProvider, createChatClient } from "./twitch/index.js";
import { registerConnectionEvents } from "./events/connected.js";
import { registerMessageEvents } from "./events/message.js";
import { registerJoinEvents } from "./events/join.js";
import { registerPartEvents } from "./events/part.js";
import { commandCache } from "./services/commandCache.js";
import { loadRegulars } from "./services/accessControl.js";
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

  await commandCache.load();
  await loadRegulars();

  const { authProvider, botUsername } = await createAuthProvider();

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

  // Fallback cron: reload commands + regulars every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      await commandCache.reload();
      await loadRegulars();
    } catch (err) {
      consola.warn(`[Cron] Failed to reload commands/regulars: ${err}`);
    }
  });

  const chatClient = createChatClient(authProvider, channels);
  registerConnectionEvents(chatClient, channels);
  registerMessageEvents(chatClient);
  registerJoinEvents(chatClient);
  registerPartEvents(chatClient);

  // Subscribe to EventBus events
  await eventBus.on("channel:join", async (payload) => {
    consola.info(`[EventBus] Joining channel: ${payload.username}`);
    chatClient.join(payload.username);
    streamStatusManager.addChannel(
      payload.username,
      env.TWITCH_APPLICATION_CLIENT_ID,
      getAccessToken,
      eventBus
    );
  });

  await eventBus.on("channel:leave", async (payload) => {
    consola.info(`[EventBus] Leaving channel: ${payload.username}`);
    chatClient.part(payload.username);
    streamStatusManager.removeChannel(payload.username);
  });

  await eventBus.on("command:created", async () => {
    consola.info("[EventBus] Command created, reloading cache");
    await commandCache.reload();
  });

  await eventBus.on("command:updated", async () => {
    consola.info("[EventBus] Command updated, reloading cache");
    await commandCache.reload();
  });

  await eventBus.on("command:deleted", async () => {
    consola.info("[EventBus] Command deleted, reloading cache");
    await commandCache.reload();
  });

  await eventBus.on("regular:created", async () => {
    consola.info("[EventBus] Regular added, reloading list");
    await loadRegulars();
  });

  await eventBus.on("regular:deleted", async () => {
    consola.info("[EventBus] Regular removed, reloading list");
    await loadRegulars();
  });

  // Connect to Twitch
  botStatus.status = "connecting";
  chatClient.connect();

  await eventBus.publish("bot:status", {
    service: "twitch",
    status: "connecting",
  });

  consola.info(`[Twitch Bot] Joining channels: ${channels.join(", ")}`);
}

main().catch((err) => {
  consola.error(`[Twitch Bot] Fatal error: ${err}`);
  process.exit(1);
});
