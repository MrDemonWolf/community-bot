import { Redis } from "ioredis";

import env from "../utils/env.js";

const redisClient = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

export default redisClient;
