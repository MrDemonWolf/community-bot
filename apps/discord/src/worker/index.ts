import type { Queue, ConnectionOptions } from "bullmq";

import { Worker, Job } from "bullmq";

import client from "../app.js";
import redisClient from "../redis/index.js";
import env from "../utils/env.js";
import logger from "../utils/logger.js";
import { cronToText } from "../utils/cronParser.js";

/**
 * Import worker jobs
 */
import setActivity from "./jobs/setActivity.js";
import checkTwitchStreams from "./jobs/checkTwitchStreams.js";

const worker = new Worker(
  "community-bot-jobs",
  async (job: Job) => {
    switch (job.name) {
      case "set-activity":
        return setActivity(client);
      case "check-twitch-streams":
        return checkTwitchStreams(client);
      default:
        throw new Error(`No job found with name ${job.name}`);
    }
  },
  {
    // Cast needed: ioredis version mismatch between direct dep and BullMQ's internal dep
    connection: redisClient as unknown as ConnectionOptions,
  }
);

worker.on("completed", (job) => {
  logger.success("Worker", `Job ${job.id} of type ${job.name} has completed`);
});

worker.on("failed", (job, err) => {
  logger.error(
    "Worker",
    `Job ${job?.id} of type ${job?.name} has failed with error ${err.message}`,
    err
  );
});

export default (queue: Queue) => {
  // Add jobs to the queue
  queue.add(
    "set-activity",
    { client: null }, // client will be set in the job processor
    {
      repeat: {
        every: env.DISCORD_ACTIVITY_INTERVAL_MINUTES * 60 * 1000, // minutes to ms
      },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );

  queue.add(
    "check-twitch-streams",
    {},
    {
      repeat: {
        every: 90 * 1000, // 90 seconds
      },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );

  logger.info("Worker", "Jobs have been added to the queue", {
    activityCron: cronToText(
      `*/${env.DISCORD_ACTIVITY_INTERVAL_MINUTES} * * * *`
    ),
    twitchPollInterval: "Every 90 seconds",
  });
};
