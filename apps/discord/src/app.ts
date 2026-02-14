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
prisma
  .$connect()
  .then(() => {
    logger.database.connected("Prisma");
  })
  .catch((err: Error) => {
    logger.database.error("Prisma", err);
    process.exit(1);
  });

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

eventBus.publish("bot:status", {
  service: "discord",
  status: "connecting",
});

export default client;
