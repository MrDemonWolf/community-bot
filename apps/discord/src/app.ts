import { Client, Events, GatewayIntentBits } from "discord.js";
import { prisma } from "@community-bot/db";
import { listenWithFallback } from "@community-bot/server";
import { EventBus } from "@community-bot/events";
import env from "./utils/env.js";
import logger from "./utils/logger.js";
import api from "./api/index.js";
import redis from "./redis/index.js";

/**
 * Import events from the events folder.
 */
import { readyEvent } from "./events/ready.js";
import { guildCreateEvent } from "./events/guildCreate.js";
import { guildDeleteEvent } from "./events/guildDelete.js";
import { interactionCreateEvent } from "./events/interactionCreate.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

/**
 * This event will run if the bot starts, and logs in, successfully. Also sets the bot's activity.
 */
client.on(Events.ClientReady, async () => {
  try {
    readyEvent(client);
  } catch (err) {
    logger.error(
      "Discord - Event (Ready)",
      "Error during client ready event",
      err
    );
    process.exit(1);
  }
});

/**
 * This event will run every time the bot joins a guild.
 */
client.on(Events.GuildCreate, (guild) => {
  guildCreateEvent(guild);
});

/**
 * This event will run every time the bot leaves a guild.
 */
client.on(Events.GuildDelete, (guild) => {
  guildDeleteEvent(guild);
});

/**
 * Update guild name/icon in the database when a server is renamed or changes its icon.
 */
client.on(Events.GuildUpdate, async (_oldGuild, newGuild) => {
  try {
    await prisma.discordGuild.updateMany({
      where: { guildId: newGuild.id },
      data: { name: newGuild.name, icon: newGuild.icon },
    });
  } catch (err) {
    logger.error(
      "Discord - Event (Guild Update)",
      "Error updating guild metadata",
      err,
      { guildId: newGuild.id }
    );
  }
});

/**
 * Handle interactionCreate events.
 */
client.on(Events.InteractionCreate, (interaction) => {
  interactionCreateEvent(interaction);
});

client.login(env.DISCORD_APPLICATION_BOT_TOKEN);

/**
 * Initialize BullMQ worker to handle background jobs.
 */
import { Queue } from "bullmq";
import worker from "./worker/index.js";

const queueName = "community-bot-jobs";

const queue = new Queue(queueName, {
  connection: env.REDIS_URL
    ? { url: env.REDIS_URL }
    : { host: "localhost", port: 6379 },
});

worker(queue);

/**
 * Verify Prisma connection on startup.
 */
try {
  await prisma.user.findFirst();
  logger.database.connected("Prisma");
} catch (err) {
  logger.database.error("Prisma", err as Error);
  process.exit(1);
}

/**
 * Load Redis connection and connect to Redis Server if failed to connect, throw error.
 */
redis
  .on("connect", () => {
    logger.database.connected("Redis");
  })
  .on("error", (err: Error) => {
    logger.database.error("Redis", err);
    process.exit(1);
  });

/**
 * Start API server.
 */
listenWithFallback(api, {
  port: env.PORT,
  host: env.HOST,
  name: "Discord Bot",
});

/**
 * Initialize EventBus for real-time inter-service communication.
 */
const eventBus = new EventBus(env.REDIS_URL);

eventBus.on("stream:online", (payload) => {
  logger.info(
    "EventBus",
    `Stream online: ${payload.username} - ${payload.title}`
  );
});

eventBus.on("stream:offline", (payload) => {
  logger.info("EventBus", `Stream offline: ${payload.username}`);
});

eventBus.on("bot:status", (payload) => {
  logger.info(
    "EventBus",
    `Bot status: ${payload.service} is ${payload.status}`
  );
});

eventBus.on("discord:settings-updated", (payload) => {
  logger.info(
    "EventBus",
    `Discord settings updated for guild: ${payload.guildId}`
  );
});

eventBus.on("discord:test-notification", async (payload) => {
  try {
    const { buildLiveEmbed, buildOfflineEmbed } = await import(
      "./twitch/embeds.js"
    );
    const { TextChannel } = await import("discord.js");

    const guild = await prisma.discordGuild.findUnique({
      where: { guildId: payload.guildId },
      include: { TwitchChannel: { take: 1 } },
    });

    if (!guild?.notificationChannelId) return;

    const discordChannel = await client.channels.fetch(
      guild.notificationChannelId
    );
    if (!discordChannel || !(discordChannel instanceof TextChannel)) return;

    const channel = guild.TwitchChannel[0];
    const username = channel?.username ?? "teststreamer";
    const displayName = channel?.displayName ?? username;
    const profileImageUrl = channel?.profileImageUrl ?? "";

    const now = new Date();
    const fakeStream = {
      id: "test-stream",
      user_id: channel?.twitchChannelId ?? "0",
      user_login: username,
      user_name: displayName,
      game_name: "Just Chatting",
      title: "Test Stream - This is a test notification!",
      viewer_count: 1234,
      started_at: now.toISOString(),
      thumbnail_url:
        "https://static-cdn.jtvnw.net/previews-ttv/live_user_{width}x{height}.jpg",
      type: "live" as const,
    };

    const roleMention = guild.notificationRoleId
      ? guild.notificationRoleId === "everyone"
        ? "@everyone"
        : `<@&${guild.notificationRoleId}>`
      : "";

    const liveEmbed = buildLiveEmbed({
      displayName,
      username,
      profileImageUrl,
      stream: fakeStream,
      startedAt: now,
    });

    const message = await discordChannel.send({
      content: roleMention || undefined,
      embeds: [liveEmbed],
    });

    logger.info("EventBus", `Test notification sent for guild: ${payload.guildId}`);

    // Update to viewer count change after 5s, then offline after 10s
    setTimeout(async () => {
      try {
        fakeStream.viewer_count = 5678;
        const updatedEmbed = buildLiveEmbed({
          displayName,
          username,
          profileImageUrl,
          stream: fakeStream,
          startedAt: now,
        });
        await message.edit({
          content: roleMention || undefined,
          embeds: [updatedEmbed],
        });
      } catch (err) {
        logger.error("EventBus", "Failed to update test notification", err);
      }
    }, 5000);

    setTimeout(async () => {
      try {
        const offlineAt = new Date();
        const offlineEmbed = buildOfflineEmbed({
          displayName,
          username,
          profileImageUrl,
          title: fakeStream.title,
          gameName: fakeStream.game_name,
          startedAt: now,
          offlineAt,
        });
        await message.edit({
          content: roleMention || undefined,
          embeds: [offlineEmbed],
        });
      } catch (err) {
        logger.error("EventBus", "Failed to edit test to offline", err);
      }
    }, 10000);
  } catch (err) {
    logger.error("EventBus", "Error handling test notification", err);
  }
});

eventBus.publish("bot:status", {
  service: "discord",
  status: "connecting",
});

export default client;
