import { Client, Events, GatewayIntentBits } from "discord.js";
import { prisma } from "@community-bot/db";
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
  interactionCreateEvent(client, interaction);
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
  .then(async () => {
    await prisma.$disconnect();
    logger.database.connected("Prisma");
  })
  .catch(async (err: Error) => {
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

const server = api.listen(api.get("port"), () => {
  logger.api.started(api.get("host"), api.get("port"));
});

server.on("error", (err: unknown) => {
  logger.api.error(err);
  process.exit(1);
});

export default client;
