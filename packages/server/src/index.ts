import express from "express";
import type { Application, Request } from "express";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import consola from "consola";
import type { Server } from "node:http";

export interface ServerOptions {
  name: string;
  defaultPort: number;
  port?: number | string;
  host?: string;
  nodeEnv?: string;
  corsOrigin?: string;
  routes?: (app: Application) => void;
}

export interface ListenOptions {
  port: number;
  host: string;
  name: string;
}

/**
 * Skip logging for health check requests from Coolify (curl/*),
 * Pulsetic monitoring, and localhost IPs.
 */
export const skipHealthChecks = (req: Request) => {
  const userAgent = req.get("User-Agent") || "";
  const clientIP = req.ip || req.socket.remoteAddress || "";

  if (userAgent.startsWith("curl/")) return true;
  if (userAgent.toLowerCase().includes("pulsetic")) return true;
  if (
    clientIP === "127.0.0.1" ||
    clientIP === "::1" ||
    clientIP === "::ffff:127.0.0.1"
  ) {
    return true;
  }

  return false;
};

/**
 * Create a configured Express application with common middleware.
 */
export function createApiServer(options: ServerOptions): Application {
  const {
    nodeEnv = "production",
    corsOrigin = "*",
    routes,
  } = options;

  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(helmet());
  app.use(
    cors({
      origin: nodeEnv === "production" ? corsOrigin : "*",
    })
  );
  app.set("x-powered-by", "MrDemonWolf, Inc., Community Bot");

  if (nodeEnv === "production") {
    app.use(morgan("combined", { skip: skipHealthChecks }));
  } else {
    app.use(morgan("dev", { skip: skipHealthChecks }));
  }

  // Default status endpoint
  app.get("/api/status", (_req, res) => {
    res.json({
      status: "online",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  if (routes) {
    routes(app);
  }

  return app;
}

/**
 * Start listening on the configured port. On EADDRINUSE, retries with port 0
 * (OS picks a random available port).
 */
export function listenWithFallback(
  app: Application,
  options: ListenOptions
): Server {
  const { port, host, name } = options;

  const server = app.listen(port, host, () => {
    const addr = server.address();
    const actualPort = typeof addr === "object" && addr ? addr.port : port;
    consola.ready({
      message: `[${name} API] Listening on http://${host}:${actualPort}`,
      badge: true,
    });
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      consola.warn({
        message: `[${name} API] Port ${port} in use, trying random available port...`,
        badge: true,
      });

      const fallback = app.listen(0, host, () => {
        const addr = fallback.address();
        const actualPort =
          typeof addr === "object" && addr ? addr.port : "unknown";
        consola.ready({
          message: `[${name} API] Listening on http://${host}:${actualPort}`,
          badge: true,
        });
      });

      fallback.on("error", (fallbackErr: Error) => {
        consola.error({
          message: `[${name} API] Failed to start server: ${fallbackErr.message}`,
          badge: true,
        });
        process.exit(1);
      });

      return;
    }

    consola.error({
      message: `[${name} API] Server error: ${err.message}`,
      badge: true,
    });
    process.exit(1);
  });

  return server;
}
