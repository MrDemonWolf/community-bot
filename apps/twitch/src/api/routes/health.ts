import express from "express";
import { db, sql } from "@community-bot/db";

import { logger } from "../../utils/logger.js";
import { botStatus } from "../../app.js";
import { getEventBus } from "../../services/eventBusAccessor.js";
import { env } from "../../utils/env.js";

const router: ReturnType<typeof express.Router> = express.Router();

type CheckStatus = "up" | "degraded" | "down";
type AiShoutoutStatus = "ready" | "disabled" | "not_configured";

interface CheckResult {
  status: CheckStatus;
  latency: number | null;
}

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

function overallStatus(
  checks: Record<string, CheckResult>
): "healthy" | "degraded" | "unhealthy" {
  const statuses = Object.values(checks).map((c) => c.status);
  if (statuses.includes("down")) return "unhealthy";
  if (statuses.includes("degraded")) return "degraded";
  return "healthy";
}

/**
 *  @route GET /health
 *  @desc Get health of Twitch Bot
 *  @access Public
 *  @returns {object} - Health status of Twitch Bot
 */
router.get("/", async (_req, res) => {
  try {
    const [database, redis] = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ]);
    const twitch = checkTwitch();

    const checks = { twitch, database, redis };
    const infraChecks = { database, redis };
    const status = overallStatus(checks);
    const infraStatus = overallStatus(infraChecks);

    const geminiKey = !!env.GEMINI_API_KEY;
    const globalEnabled = env.AI_SHOUTOUT_ENABLED === "true";
    let shoutout: AiShoutoutStatus = "not_configured";
    if (geminiKey && globalEnabled) shoutout = "ready";
    else if (geminiKey) shoutout = "disabled";

    res.status(infraStatus === "unhealthy" ? 503 : 200).json({
      status,
      uptime: process.uptime(),
      version: process.env["npm_package_version"] || "1.7.0",
      timestamp: new Date().toISOString(),
      checks,
      ai: {
        shoutout,
        geminiKey,
        globalEnabled,
      },
    });
  } catch (err) {
    logger.error("API", "Health check failed", err);
    res.status(503).json({
      status: "unhealthy",
      uptime: process.uptime(),
      version: process.env["npm_package_version"] || "1.7.0",
      timestamp: new Date().toISOString(),
      checks: {},
    });
  }
});

export default router;
