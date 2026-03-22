import { db, sql } from "@community-bot/db";
import { createHealthRouter } from "@community-bot/server";
import type { CheckResult } from "@community-bot/server";

import { logger } from "../../utils/logger.js";
import { botStatus } from "../../app.js";
import { getEventBus } from "../../services/eventBusAccessor.js";
import { env } from "../../utils/env.js";

type AiShoutoutStatus = "ready" | "disabled" | "not_configured";

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
    const eventBus = getEventBus();
    const ok = await eventBus.ping();
    return {
      status: ok ? "up" : "down",
      latency: ok ? Math.round(performance.now() - start) : null,
    };
  } catch {
    return { status: "down", latency: null };
  }
}

function checkTwitch(): CheckResult {
  switch (botStatus.status) {
    case "online":
      return { status: "up", latency: null };
    case "connecting":
      return { status: "degraded", latency: null };
    default:
      return { status: "down", latency: null };
  }
}

export default createHealthRouter({
  checks: {
    twitch: checkTwitch,
    database: checkDatabase,
    redis: checkRedis,
  },
  infraChecks: ["database", "redis"],
  logger,
  extraData: () => {
    const geminiKey = !!env.GEMINI_API_KEY;
    const globalEnabled = env.AI_SHOUTOUT_ENABLED === "true";
    let shoutout: AiShoutoutStatus = "not_configured";
    if (geminiKey && globalEnabled) shoutout = "ready";
    else if (geminiKey) shoutout = "disabled";

    return {
      ai: {
        shoutout,
        geminiKey,
        globalEnabled,
      },
    };
  },
});
