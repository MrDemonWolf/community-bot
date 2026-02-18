import express from "express";
import { prisma } from "@community-bot/db";

import logger from "../../utils/logger.js";
import client from "../../app.js";
import redis from "../../redis/index.js";

const router: express.Router = express.Router();

type CheckStatus = "up" | "degraded" | "down";

interface CheckResult {
  status: CheckStatus;
  latency: number | null;
}

async function checkDatabase(): Promise<CheckResult> {
  const start = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
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

function overallStatus(
  checks: Record<string, CheckResult>
): "healthy" | "degraded" | "unhealthy" {
  const statuses = Object.values(checks).map((c) => c.status);
  if (statuses.includes("down")) return "unhealthy";
  if (statuses.includes("degraded")) return "degraded";
  return "healthy";
}

/**
 * GET /health
 * Returns comprehensive health status of the Discord bot and its dependencies
 */
router.get("/", async (_req, res) => {
  try {
    const [database, redisCheck] = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ]);
    const discord = checkDiscord();

    const checks = { discord, database, redis: redisCheck };
    const status = overallStatus(checks);

    res.status(status === "unhealthy" ? 503 : 200).json({
      status,
      uptime: process.uptime(),
      version: process.env["npm_package_version"] || "1.7.0",
      timestamp: new Date().toISOString(),
      checks,
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
