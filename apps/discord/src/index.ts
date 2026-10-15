import { createServer } from "node:http";

import { Client, Events, GatewayIntentBits, REST, Routes } from "discord.js";

import { type DiscordConfig, readConfig } from "./config";

// Never log Discord error objects, request headers, tokens, or response bodies.
function errorDetails(error: unknown): Record<string, string | number> {
  const details: Record<string, string | number> = {};
  if (error instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(error.name)) {
    details.name = error.name;
  }
  if (error && typeof error === "object") {
    if ("code" in error && typeof error.code === "number") details.code = error.code;
    if ("status" in error && typeof error.status === "number") details.status = error.status;
  }
  return details;
}

function log(event: string, details: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({
      time: new Date().toISOString(),
      service: "wolfaide-discord",
      event,
      ...details,
    }),
  );
}

async function main() {
  let config: DiscordConfig;
  try {
    config = readConfig(process.env);
  } catch (error) {
    // readConfig emits only fixed validation text and environment variable names.
    console.error(error instanceof Error ? error.message : "Invalid Discord configuration");
    process.exitCode = 1;
    return;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const rest = new REST({ version: "10", timeout: 15_000, retries: 2 }).setToken(
    config.token,
  );
  const reconnectingShards = new Set<number>();
  let identityVerified = false;
  let stopping = false;

  function readiness() {
    const guild = client.guilds.cache.get(config.guildId);
    const identityMatches = identityVerified && client.user?.id === config.applicationId;
    const gatewayReady = client.isReady() && reconnectingShards.size === 0;
    const guildAvailable = Boolean(guild?.available);
    const ready = !stopping && identityMatches && gatewayReady && guildAvailable;
    let state = "ready";
    if (stopping) state = "stopping";
    else if (!identityVerified) state = "starting";
    else if (!gatewayReady) state = "connecting";
    else if (!identityMatches) state = "identity_mismatch";
    else if (!guildAvailable) state = "guild_unavailable";
    return {
      service: "wolfaide-discord",
      ready,
      state,
      applicationId: config.applicationId,
      guildId: config.guildId,
      gatewayReady,
      guildAvailable,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.setHeader("Allow", "GET, HEAD");
      response.writeHead(405).end(JSON.stringify({ error: "method_not_allowed" }));
      return;
    }
    if (request.url === "/healthz") {
      response
        .writeHead(stopping ? 503 : 200)
        .end(JSON.stringify({ service: "wolfaide-discord", alive: !stopping }));
      return;
    }
    if (request.url === "/readyz") {
      const status = readiness();
      response.writeHead(status.ready ? 200 : 503).end(JSON.stringify(status));
      return;
    }
    response.writeHead(404).end(JSON.stringify({ error: "not_found" }));
  });

  async function shutdown(exitCode: number, reason: string) {
    if (stopping) return;
    stopping = true;
    log("stopping", { reason });
    const deadline = setTimeout(() => process.exit(exitCode || 1), 10_000);
    deadline.unref();
    try {
      await Promise.all([
        client.destroy(),
        new Promise<void>((resolve) => server.close(() => resolve())),
      ]);
    } finally {
      server.closeAllConnections();
      clearTimeout(deadline);
      process.exit(exitCode);
    }
  }

  process.once("SIGTERM", () => void shutdown(0, "SIGTERM"));
  process.once("SIGINT", () => void shutdown(0, "SIGINT"));
  process.once("uncaughtException", (error) => {
    log("fatal", errorDetails(error));
    void shutdown(1, "uncaught_exception");
  });
  process.once("unhandledRejection", (error) => {
    log("fatal", errorDetails(error));
    void shutdown(1, "unhandled_rejection");
  });

  client.on(Events.ClientReady, () => {
    if (client.user?.id !== config.applicationId) {
      log("identity_mismatch");
      void shutdown(1, "identity_mismatch");
      return;
    }
    log("gateway_ready", {
      applicationId: config.applicationId,
      guildId: config.guildId,
      guildAvailable: Boolean(client.guilds.cache.get(config.guildId)?.available),
    });
  });
  client.on(Events.ShardReconnecting, (shardId) => {
    reconnectingShards.add(shardId);
    log("gateway_reconnecting", { shardId });
  });
  client.on(Events.ShardDisconnect, (event, shardId) => {
    reconnectingShards.add(shardId);
    log("gateway_disconnected", { shardId, code: event.code });
  });
  client.on(Events.ShardReady, (shardId) => reconnectingShards.delete(shardId));
  client.on(Events.ShardResume, (shardId) => {
    reconnectingShards.delete(shardId);
    log("gateway_resumed", { shardId });
  });
  client.on(Events.ShardError, (error, shardId) => {
    log("gateway_error", { shardId, ...errorDetails(error) });
  });
  client.on(Events.Error, (error) => log("client_error", errorDetails(error)));
  client.on(Events.GuildUnavailable, (guild) => {
    if (guild.id === config.guildId) log("guild_unavailable", { guildId: config.guildId });
  });
  client.on(Events.GuildAvailable, (guild) => {
    if (guild.id === config.guildId) log("guild_available", { guildId: config.guildId });
  });
  client.on(Events.GuildDelete, (guild) => {
    if (guild.id === config.guildId) log("guild_missing", { guildId: config.guildId });
  });

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(config.port, "0.0.0.0", () => {
        server.off("error", reject);
        resolve();
      });
    });
    log("health_listening", { port: config.port });

    // GETs only: reject the wrong application or missing membership before login.
    const identity = await rest.get(Routes.user());
    if (
      !identity ||
      typeof identity !== "object" ||
      !("id" in identity) ||
      identity.id !== config.applicationId ||
      !("bot" in identity) ||
      identity.bot !== true
    ) {
      log("identity_mismatch");
      await shutdown(1, "identity_mismatch");
      return;
    }
    const guild = await rest.get(Routes.guild(config.guildId));
    if (
      !guild ||
      typeof guild !== "object" ||
      !("id" in guild) ||
      guild.id !== config.guildId
    ) {
      log("guild_mismatch");
      await shutdown(1, "guild_mismatch");
      return;
    }
    identityVerified = true;
    if (!stopping) await client.login(config.token);
  } catch (error) {
    log("startup_failed", errorDetails(error));
    await shutdown(1, "startup_failed");
  }
}

void main();
