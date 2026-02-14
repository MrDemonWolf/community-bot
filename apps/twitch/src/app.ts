import consola from "consola";
import cron from "node-cron";

import { listenWithFallback } from "@community-bot/server";
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
  // Connect to the database
  await prisma.$connect();

  // Start API server
  listenWithFallback(api, {
    port: env.PORT,
    host: env.HOST,
    name: "Twitch Bot",
  });

  // Load command cache and regulars from DB
  await commandCache.load();
  await loadRegulars();

  // Create Twitch auth provider (validates/refreshes stored tokens)
  const { authProvider, botUsername } = await createAuthProvider();

  // Build channel list: bot's own channel + the streamer channel
  const channels = [...new Set([botUsername, env.TWITCH_CHANNEL])];

  // Start stream status polling
  const getAccessToken = async () => {
    const cred = await prisma.twitchCredential.findFirst();
    return cred?.accessToken ?? "";
  };
  await streamStatusManager.start(
    env.TWITCH_CHANNEL,
    env.TWITCH_APPLICATION_CLIENT_ID,
    getAccessToken
  );

  // Schedule periodic reload of commands + regulars (every 60s)
  cron.schedule("* * * * *", async () => {
    try {
      await commandCache.reload();
      await loadRegulars();
    } catch (err) {
      consola.warn({
        message: `[Cron] Failed to reload commands/regulars: ${err}`,
        badge: true,
        timestamp: new Date(),
      });
    }
  });

  // Create chat client and register events
  const chatClient = createChatClient(authProvider, botUsername);
  registerConnectionEvents(chatClient, channels);
  registerMessageEvents(chatClient);
  registerJoinEvents(chatClient);
  registerPartEvents(chatClient);

  // Connect to Twitch
  botStatus.status = "connecting";
  chatClient.connect();

  consola.info({
    message: `[Twitch Bot] Joining channels: ${channels.join(", ")}`,
    badge: true,
    timestamp: new Date(),
  });
}

main().catch((err) => {
  consola.error({
    message: `[Twitch Bot] Fatal error: ${err}`,
    badge: true,
    timestamp: new Date(),
  });
  process.exit(1);
});
