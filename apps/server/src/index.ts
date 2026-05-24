import { createContext } from "@community-bot/api/context";
import { appRouter } from "@community-bot/api/routers/index";
import { auth } from "@community-bot/auth";
import { env } from "@community-bot/env/server";
import { logger } from "@community-bot/logger";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import discordBotInvite from "./oauth/discordBotInvite";
import twitchBot from "./oauth/twitchBot";

const app = new Hono();

app.use("*", async (c, next) => {
  const start = Date.now();
  const reqId = crypto.randomUUID();
  const log = logger.child({ reqId, method: c.req.method, path: c.req.path });
  try {
    await next();
  } finally {
    log.info({ status: c.res.status, durationMs: Date.now() - start }, "request");
  }
});

app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api/oauth/twitch-bot", twitchBot);
app.route("/api/discord/bot-invite", discordBotInvite);

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  }),
);

app.get("/", (c) => {
  return c.text("OK");
});

export default app;
