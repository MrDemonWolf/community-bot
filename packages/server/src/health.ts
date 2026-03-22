import express from "express";

export type CheckStatus = "up" | "degraded" | "down";

export interface CheckResult {
  status: CheckStatus;
  latency: number | null;
}

export type CheckFn = () => CheckResult | Promise<CheckResult>;

export interface HealthRouterOptions {
  /** Named check functions (e.g. database, redis, discord, twitch). */
  checks: Record<string, CheckFn>;
  /**
   * Optional extra data merged into the JSON response
   * (e.g. `{ ai: { shoutout, geminiKey, globalEnabled } }`).
   */
  extraData?: () => Record<string, unknown>;
  /** Logger with an `error(tag: string, msg: string, err: unknown)` method. */
  logger?: { error: (tag: string, msg: string, err: unknown) => void };
  /**
   * Names of checks considered "infrastructure".
   * If omitted, all checks except the first are treated as infra.
   * The HTTP status code is 503 when infra status is "unhealthy", 200 otherwise.
   */
  infraChecks?: string[];
}

function overallStatus(
  checks: Record<string, CheckResult>,
): "healthy" | "degraded" | "unhealthy" {
  const statuses = Object.values(checks).map((c) => c.status);
  if (statuses.includes("down")) return "unhealthy";
  if (statuses.includes("degraded")) return "degraded";
  return "healthy";
}

/**
 * Create an Express Router with a `GET /` health endpoint.
 *
 * All check functions are executed in parallel. The response shape is:
 * ```json
 * { "status", "uptime", "version", "timestamp", "checks", ...extraData }
 * ```
 */
export function createHealthRouter(options: HealthRouterOptions): express.Router {
  const { checks, extraData, logger, infraChecks } = options;
  const router: express.Router = express.Router();

  router.get("/", async (_req, res) => {
    try {
      const names = Object.keys(checks);
      const results = await Promise.all(
        names.map((name) => Promise.resolve(checks[name]!())),
      );

      const resolved: Record<string, CheckResult> = {};
      for (let i = 0; i < names.length; i++) {
        resolved[names[i]!] = results[i]!;
      }

      // Build infra-only subset for HTTP status decision
      const infraSubset: Record<string, CheckResult> = {};
      if (infraChecks) {
        for (const name of infraChecks) {
          if (resolved[name]) infraSubset[name] = resolved[name];
        }
      } else {
        // Default: "database" and "redis" are infra if present
        for (const name of ["database", "redis"]) {
          if (resolved[name]) infraSubset[name] = resolved[name];
        }
      }

      const status = overallStatus(resolved);
      const infraStatus =
        Object.keys(infraSubset).length > 0
          ? overallStatus(infraSubset)
          : status;

      const body: Record<string, unknown> = {
        status,
        uptime: process.uptime(),
        version: process.env["npm_package_version"] || "1.7.0",
        timestamp: new Date().toISOString(),
        checks: resolved,
        ...(extraData ? extraData() : {}),
      };

      res.status(infraStatus === "unhealthy" ? 503 : 200).json(body);
    } catch (err) {
      if (logger) logger.error("API", "Health check failed", err);

      res.status(503).json({
        status: "unhealthy",
        uptime: process.uptime(),
        version: process.env["npm_package_version"] || "1.7.0",
        timestamp: new Date().toISOString(),
        checks: {},
      });
    }
  });

  return router;
}
