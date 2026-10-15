import { createServer } from "node:http";
import assert from "node:assert/strict";
import { uptime as hostUptime } from "node:os";
import { COMMAND_DEFINITIONS, executeCommand } from "@community-bot/core/commands";
import { featureConfig, featureEnabled } from "@community-bot/core/features";
import { decrypt } from "@community-bot/db/crypto";
import { getFeatureConfigs } from "@community-bot/db/features";
import { getRuntimes, reportRuntime } from "@community-bot/db/runtime";
import { getSettings } from "@community-bot/db/settings";
import { Client, Events, GatewayIntentBits, MessageFlags, REST, Routes, type Interaction } from "discord.js";
import { presence, validateIdentity } from "./config";
import { commandRegistration, streamStart } from "./commands";

const port = Number(process.env.PORT ?? "3003");
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid PORT");
let client: Client | undefined;
let identity: string | null = null;
let credentialKey = "";
let presenceKey = "";
let guildId = "";
let state = "starting";
let detail = "Waiting for dashboard configuration";
let stopping = false;
let nextAttempt = 0;
let attemptedKey = "";
let lastPresence = 0;
let startedAt: Date | null = null;
let sessionStartLimit: unknown = null;
let reconnecting = false;
const processStartedAt = Date.now();
let commandsEnabled = true;
let commandCooldownSeconds = 3;
let lastCommand = 0;
let commandKey = "";
let nextCommandAttempt = 0;
let commandsRegistered = false;

function log(event: string, error?: unknown) {
  // Discord errors may contain tokens or response bodies: only emit numeric codes.
  const code =
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "number"
      ? error.code
      : undefined;
  console.log(JSON.stringify({ service: "discord", event, code }));
}

function ready() {
  return (
    !stopping &&
    !reconnecting &&
    Boolean(client?.isReady() && client.guilds.cache.get(guildId)?.available)
  );
}

async function heartbeat() {
  await reportRuntime("discord", {
    state: ready()
      ? "connected"
      : state === "connected"
        ? "guild_unavailable"
        : state,
    detail: ready() ? commandsRegistered ? "Connected to Discord" : "Connected; command registration is waiting to complete" : detail,
    identity,
    startedAt,
    metadata: {
      guildId,
      gatewayReady: Boolean(client?.isReady()),
      guildAvailable: Boolean(client?.guilds.cache.get(guildId)?.available),
      gatewayEventsPerMinute: 120,
      presenceUpdatesPer20Seconds: 5,
      sessionStartLimit,
      commandsRegistered,
    },
  });
}

async function disconnect() {
  const previous = client;
  client = undefined;
  identity = null;
  startedAt = null;
  credentialKey = "";
  presenceKey = "";
  reconnecting = false;
  commandKey = "";
  nextCommandAttempt = 0;
  commandsRegistered = false;
  await previous?.destroy();
}

async function reconcile() {
  const [settings, features] = await Promise.all([getSettings(), getFeatureConfigs()]);
  commandsEnabled = featureEnabled("uptime", features, "discord");
  const config = featureConfig("uptime", features, "discord");
  commandCooldownSeconds = "cooldownSeconds" in config ? config.cooldownSeconds : 3;
  if (stopping) return;
  if (!settings.discordEnabled || !settings.discordTokenEnc) {
    await disconnect();
    attemptedKey = "";
    nextAttempt = 0;
    state = settings.discordEnabled ? "needs_setup" : "disconnected";
    detail = settings.discordEnabled
      ? "Add the bot token in Connections"
      : "Discord is paused";
    await heartbeat();
    return;
  }
  validateIdentity(settings);
  const desiredPresence = featureEnabled("presence", features, "discord") ? presence(settings) : { status: "online" as const, activities: [] };
  const key = JSON.stringify([
    settings.discordTokenEnc,
    settings.discordApplicationId,
    settings.discordGuildId,
  ]);
  if (attemptedKey !== key) {
    attemptedKey = key;
    nextAttempt = 0;
  }
  if (client && credentialKey !== key) await disconnect();
  guildId = settings.discordGuildId!;
  if (!client && Date.now() >= nextAttempt) {
    nextAttempt = Date.now() + 60_000;
    state = "connecting";
    detail = "Verifying bot identity and server access";
    await heartbeat();
    const token = decrypt(settings.discordTokenEnc).trim();
    if (!token || /\s/.test(token) || token.startsWith("Bot "))
      throw new Error("Invalid raw bot token");
    const rest = new REST({
      version: "10",
      timeout: 15_000,
      retries: 1,
    }).setToken(token);
    const user = (await rest.get(Routes.user())) as {
      id: string;
      bot?: boolean;
      username: string;
    };
    if (!user.bot || user.id !== settings.discordApplicationId)
      throw new Error("Bot application identity mismatch");
    const guild = (await rest.get(Routes.guild(guildId))) as { id?: string } | null;
    assert.equal(guild?.id, guildId, "Discord server identity mismatch");
    const gateway = (await rest.get(Routes.gatewayBot())) as {
      session_start_limit: unknown;
    };
    sessionStartLimit = gateway.session_start_limit;
    if (stopping) return;
    const latest = await getSettings();
    if (
      !latest.discordEnabled ||
      key !==
        JSON.stringify([
          latest.discordTokenEnc,
          latest.discordApplicationId,
          latest.discordGuildId,
        ])
    )
      return;
    const connection = new Client({
      intents: [GatewayIntentBits.Guilds],
      presence: desiredPresence,
    });
    client = connection;
    credentialKey = key;
    connection.on(Events.Error, (error) => log("client_error", error));
    connection.on(Events.ShardError, (error) => log("gateway_error", error));
    connection.on(Events.ShardDisconnect, () => {
      reconnecting = true;
      state = "reconnecting";
      detail = "Discord connection interrupted";
    });
    connection.on(Events.ShardReconnecting, () => {
      reconnecting = true;
      state = "reconnecting";
      detail = "Reconnecting to Discord";
    });
    connection.on(Events.ShardReady, () => {
      reconnecting = false;
    });
    connection.on(Events.ShardResume, () => {
      reconnecting = false;
    });
    connection.on(Events.InteractionCreate, (interaction) => { void respondToCommand(interaction); });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        connection.login(token),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("Discord connection timed out")),
            45_000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
    if (stopping) return;
    if (connection.user?.id !== settings.discordApplicationId)
      throw new Error("Gateway identity mismatch");
    identity = connection.user.tag;
    startedAt = new Date();
    state = "connected";
    nextAttempt = 0;
    detail = "Waiting for the configured server to become available";
    presenceKey = JSON.stringify(desiredPresence);
    lastPresence = Date.now();
    log("connected");
  }
  const registration = commandRegistration(commandsEnabled);
  const desiredCommandKey = JSON.stringify([guildId, registration]);
  commandsRegistered = commandKey === desiredCommandKey;
  if (ready() && !commandsRegistered && Date.now() >= nextCommandAttempt) {
    nextCommandAttempt = Date.now() + 60_000;
    try {
      await client!.application!.commands.set(registration, guildId);
      commandKey = desiredCommandKey;
      commandsRegistered = true;
    } catch (error) { log("command_registration_failed", error); }
  }
  const desiredKey = JSON.stringify(desiredPresence);
  // Coalesce dashboard changes; one update per five seconds stays below Discord's 5/20s limit.
  if (
    client?.isReady() &&
    desiredKey !== presenceKey &&
    Date.now() - lastPresence >= 5_000
  ) {
    client.user.setPresence(desiredPresence);
    presenceKey = desiredKey;
    lastPresence = Date.now();
  }
  await heartbeat();
}

async function respondToCommand(interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;
  const command = COMMAND_DEFINITIONS.find((entry) => entry.name === interaction.commandName);
  if (!command) return;
  try {
    if (!ready() || interaction.guildId !== guildId || !commandsEnabled) {
      await interaction.reply({ content: "This command is not enabled in this server.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (Date.now() - lastCommand < commandCooldownSeconds * 1000) {
      await interaction.reply({ content: "Please wait a moment before trying another command.", flags: MessageFlags.Ephemeral });
      return;
    }
    lastCommand = Date.now();
    await interaction.deferReply();
    const reply = await executeCommand(command.name, {
      platform: "discord", subject: { owner: false, grants: [] }, prefix: "/",
      botUptime: (Date.now() - processStartedAt) / 1000, hostUptime: hostUptime(),
      streamStartedAt: async () => streamStart((await getRuntimes()).find((runtime) => runtime.service === "twitch")),
    });
    await interaction.editReply({ content: reply ?? "This command is unavailable for your role.", allowedMentions: { parse: [] } });
  } catch (error) {
    log("command_failed", error);
    if (interaction.deferred || interaction.replied) await interaction.editReply({ content: "This command is temporarily unavailable. Please try again shortly.", allowedMentions: { parse: [] } }).catch(() => {});
    else await interaction.reply({ content: "This command is temporarily unavailable. Please try again shortly.", flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}

const server = createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    response.writeHead(405).end();
  } else if (request.url === "/healthz") {
    response
      .writeHead(stopping ? 503 : 200)
      .end(JSON.stringify({ alive: !stopping }));
  } else if (request.url === "/readyz") {
    response
      .writeHead(ready() ? 200 : 503)
      .end(JSON.stringify({ ready: ready(), state }));
  } else response.writeHead(404).end();
});

let timer: ReturnType<typeof setTimeout>;
async function tick() {
  try {
    await reconcile();
  } catch (error) {
    log("configuration_or_connection_failed", error);
    await disconnect();
    state = "error";
    detail =
      "Check the bot token, application ID, server invitation, and database connection";
    await heartbeat().catch(() => log("heartbeat_failed"));
  } finally {
    if (!stopping) timer = setTimeout(() => void tick(), 5_000);
  }
}

async function shutdown(exitCode: number) {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  state = "stopping";
  detail = "Discord service stopped";
  const deadline = setTimeout(() => process.exit(exitCode || 1), 10_000);
  deadline.unref();
  await disconnect().catch(() => {});
  await heartbeat().catch(() => {});
  server.closeAllConnections();
  server.close(() => process.exit(exitCode));
}
process.once("SIGINT", () => void shutdown(0));
process.once("SIGTERM", () => void shutdown(0));
process.once("uncaughtException", (error) => {
  log("fatal", error);
  void shutdown(1);
});
process.once("unhandledRejection", (error) => {
  log("fatal", error);
  void shutdown(1);
});
server.listen(port, "0.0.0.0", () => void tick());
