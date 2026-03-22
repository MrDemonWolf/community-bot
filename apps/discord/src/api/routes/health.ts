import { db, sql } from "@community-bot/db";
import { createHealthRouter } from "@community-bot/server";
import type { CheckResult } from "@community-bot/server";

import logger from "../../utils/logger.js";
import client from "../../app.js";
import redis from "../../redis/index.js";

async function checkDatabase(): Promise<CheckResult> {
  const start = performance.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { status: "up", latency: Math.round(performance.now() - start) };
  } catch {
    return { status: "down", latency: null };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const start = performance.now();
  try {
    const result = await redis.ping();
    const ok = result === "PONG";
    return {
      status: ok ? "up" : "down",
      latency: ok ? Math.round(performance.now() - start) : null,
    };
  } catch {
    return { status: "down", latency: null };
  }
}

function checkDiscord(): CheckResult {
  if (client.isReady()) {
    return {
      status: "up",
      latency: client.ws.ping >= 0 ? client.ws.ping : null,
    };
  }
  return { status: "down", latency: null };
}

export default createHealthRouter({
  checks: {
    discord: checkDiscord,
    database: checkDatabase,
    redis: checkRedis,
  },
  infraChecks: ["database", "redis"],
  logger,
});
