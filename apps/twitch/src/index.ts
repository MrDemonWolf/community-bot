import "./load-env";
import { uptime as hostUptime } from "node:os";
import { decrypt } from "@community-bot/db/crypto";
import { reportRuntime } from "@community-bot/db/runtime";
import {
  getSettings,
  replaceBotToken,
} from "@community-bot/db/settings";
import { decodeToken, encodeToken } from "@community-bot/db/twitch";
import { ApiClient } from "@twurple/api";
import { getTokenInfo, RefreshingAuthProvider } from "@twurple/auth";
import { EventSubWsListener } from "@twurple/eventsub-ws";
import { executeCommand } from "@community-bot/core/commands";
import { TWITCH_BOT_SCOPES, featureConfig, featureEnabled } from "@community-bot/core/features";
import { getFeatureConfigs } from "@community-bot/db/features";
import { twitchBadgeRoles } from "@community-bot/core/permissions";
import { RewardRuntime } from "./rewards";
import {
  connectionAction,
  connectionKey,
  parseCommand,
  retryDelay,
  shouldRespond,
} from "./commands";

type Settings = Awaited<ReturnType<typeof getSettings>>;
// shortcut: run one Twitch worker replica; add a database lease before horizontal scaling.
const startedAt = new Date();
let state = "starting";
let stopping = false;
let retryKey = "";
let failures = 0;
let retryAfter = 0;
const rewards = new RewardRuntime();
let active:
  | {
      listener: EventSubWsListener;
      settings: Settings;
      auth: RefreshingAuthProvider;
      api: ApiClient;
      streamCheckedAt: number;
      stream: Record<string, unknown>;
      validatedAt: number;
      subscribed: boolean;
      failed: boolean;
    }
  | undefined;

async function report(nextState: string, detail: string) {
  state = nextState;
  await reportRuntime("twitch", {
    state,
    detail,
    startedAt,
    identity: active?.settings.botLogin ?? null,
    metadata: {
      transport: "EventSub WebSocket + Helix",
      channel: active?.settings.broadcasterLogin,
      rewards: rewards.detail,
      ...active?.stream,
    },
  });
}
function disconnect() {
  active?.listener.stop();
  active = undefined;
}
function recordFailure() {
  retryAfter = Date.now() + retryDelay(++failures);
}

async function connect(settings: Settings) {
  const {
    twitchClientId,
    twitchClientSecretEnc,
    botUserId,
    botTokenEnc,
    broadcasterUserId,
  } = settings;
  if (
    !twitchClientId ||
    !twitchClientSecretEnc ||
    !botUserId ||
    !botTokenEnc ||
    !broadcasterUserId
  )
    return;
  const auth = new RefreshingAuthProvider({
    clientId: twitchClientId,
    clientSecret: decrypt(twitchClientSecretEnc),
  });
  const api = new ApiClient({ authProvider: auth });
  const session = {
    listener: undefined as unknown as EventSubWsListener,
    settings,
    auth,
    api,
    streamCheckedAt: 0,
    stream: {} as Record<string, unknown>,
    validatedAt: 0,
    subscribed: false,
    failed: false,
  };
  auth.onRefresh(async (userId, token) => {
    try {
      // Do not restore credentials after a dashboard disconnect or account replacement.
      if (userId !== botUserId || !session.settings.botTokenEnc) return;
      const encoded = encodeToken(token);
      if (await replaceBotToken(session.settings.botTokenEnc, encoded)) {
        session.settings = { ...session.settings, botTokenEnc: encoded };
      }
    } catch {
      session.failed = true;
      await report(
        "error",
        "Could not save refreshed Twitch credentials. Check database access.",
      );
    }
  });
  auth.onRefreshFailure(() => {
    session.failed = true;
  });
  await auth.addUser(botUserId, decodeToken(botTokenEnc));
  const token = await auth.getAccessTokenForUser(botUserId, [...TWITCH_BOT_SCOPES]);
  if (!token) throw new Error("Missing Twitch bot authorization");
  const info = await getTokenInfo(token.accessToken, twitchClientId);
  if (info.userId !== botUserId || info.clientId !== twitchClientId)
    throw new Error("Twitch bot identity mismatch");
  session.validatedAt = Date.now();
  const listener = new EventSubWsListener({ apiClient: api });
  session.listener = listener;
  active = session;
  let lastResponse = 0;
  listener.onSubscriptionCreateSuccess(() => {
    session.subscribed = true;
  });
  listener.onSubscriptionCreateFailure(() => {
    session.failed = true;
  });
  listener.onRevoke(() => {
    session.failed = true;
    session.subscribed = false;
  });
  listener.onUserSocketDisconnect(() => {
    session.subscribed = false;
    state = "connecting";
  });
  listener.onChannelChatMessage(broadcasterUserId, botUserId, (event) => {
    void (async () => {
      const current = await getSettings();
      if (
        active !== session ||
        connectionKey(current) !== connectionKey(session.settings)
      )
        return;
      const now = Date.now();
      const features = await getFeatureConfigs();
      if (!featureEnabled("uptime", features, "twitch")) return;
      const config = featureConfig("uptime", features, "twitch") as { cooldownSeconds: number };
      if (
        !shouldRespond({
          enabled: current.twitchEnabled,
          muted: current.twitchMuted,
          chatterId: event.chatterId,
          botId: botUserId,
          broadcasterId: event.broadcasterId,
          channelId: broadcasterUserId,
          sourceBroadcasterId: event.sourceBroadcasterId,
          now,
          lastResponse,
          cooldownMs: config.cooldownSeconds * 1000,
        })
      )
        return;
      const command = parseCommand(event.messageText, current.commandPrefix);
      if (!command) return;
      lastResponse = now;
      const message = await executeCommand(command, {
        platform: "twitch", subject: { owner: false, grants: twitchBadgeRoles(Object.keys(event.badges).map((setId) => ({ setId })))
          .map((role) => ({ platform: "twitch" as const, role, source: "verified-channel-message" })) }, prefix: current.commandPrefix,
        botUptime: process.uptime(), hostUptime: hostUptime(),
        streamStartedAt: async () => {
          const stream = await api.asUser(botUserId, (client) =>
            client.streams.getStreamByUserId(broadcasterUserId),
          );
          return stream?.startDate ?? null;
        },
      });
      if (!message) return;
      // Recheck after API awaits so Leave or Mute takes effect before a queued reply.
      const latest = await getSettings();
      if (
        active !== session ||
        !latest.twitchEnabled ||
        latest.twitchMuted ||
        !featureEnabled("uptime", await getFeatureConfigs(), "twitch") ||
        connectionKey(latest) !== connectionKey(session.settings)
      )
        return;
      const sent = await api.asUser(botUserId, (client) =>
        client.chat.sendChatMessage(broadcasterUserId, message),
      );
      if (!sent.isSent)
        await report(
          "error",
          "Twitch declined a chat reply. Check bot permissions and chat restrictions.",
        );
    })().catch(() => {
      void report(
        "error",
        "Twitch command failed. Check connection and permissions.",
      ).catch(() => {});
    });
  });
  await listener.start();
}

async function reconcile() {
  const settings = await getSettings();
  const key = connectionKey(settings);
  if (key !== retryKey || !settings.twitchEnabled) {
    retryKey = key;
    failures = 0;
    retryAfter = 0;
  }
  if (active && !active.subscribed && Date.now() - active.validatedAt > 60000)
    active.failed = true;
  if (active?.failed) {
    disconnect();
    recordFailure();
  }
  const configured = Boolean(
    settings.twitchClientId &&
    settings.twitchClientSecretEnc &&
    settings.botUserId &&
    settings.botTokenEnc &&
    settings.broadcasterUserId,
  );
  const action = connectionAction(
    settings.twitchEnabled,
    configured,
    active ? connectionKey(active.settings) : null,
    connectionKey(settings),
    active?.failed ?? false,
  );
  if (action === "stop") {
    disconnect();
    await report(
      "stopped",
      "Bot has left the channel. Join from the dashboard.",
    );
    return;
  }
  if (action === "wait") {
    disconnect();
    await report(
      "waiting",
      "Connect the Twitch app, creator, and bot account in the dashboard.",
    );
    return;
  }
  if (action === "connect") disconnect();
  if (!active) {
    if (Date.now() < retryAfter) {
      await report(
        "error",
        "Twitch connection failed; retrying shortly. Check credentials and network.",
      );
      return;
    }
    await report("connecting", "Connecting to Twitch chat with EventSub.");
    await connect(settings);
  }
  if (active?.subscribed) {
    failures = 0;
    retryAfter = 0;
  }
  if (
    active &&
    settings.botUserId &&
    settings.twitchClientId &&
    Date.now() - active.validatedAt >= 3600000
  ) {
    const token = await active.auth.getAccessTokenForUser(settings.botUserId);
    if (!token) throw new Error("Twitch authorization missing");
    const info = await getTokenInfo(token.accessToken, settings.twitchClientId);
    if (
      info.userId !== settings.botUserId ||
      info.clientId !== settings.twitchClientId
    )
      throw new Error("Twitch identity mismatch");
    active.validatedAt = Date.now();
  }
  if (
    active?.subscribed &&
    settings.botUserId &&
    settings.broadcasterUserId &&
    Date.now() - active.streamCheckedAt >= 30000
  ) {
    active.streamCheckedAt = Date.now();
    try {
      const stream = await active.api.asUser(settings.botUserId, (client) =>
        client.streams.getStreamByUserId(settings.broadcasterUserId!),
      );
      active.stream = stream
        ? {
            live: true,
            title: stream.title,
            category: stream.gameName,
            viewers: stream.viewers,
            streamStartedAt: stream.startDate.toISOString(),
          }
        : { live: false };
    } catch {
      active.stream = { live: null };
    }
  }
  await report(
    active?.subscribed
      ? settings.twitchMuted
        ? "muted"
        : "connected"
      : "connecting",
    active?.subscribed
      ? settings.twitchMuted
        ? "Listening; chat replies are muted."
        : "Listening and replying to commands."
      : "Waiting for Twitch to confirm the chat subscription.",
  );
}

const server = Bun.serve({
  port: Number(process.env.TWITCH_PORT ?? process.env.PORT ?? 3005),
  fetch(request) {
    const path = new URL(request.url).pathname;
    if (path !== "/health" && path !== "/ready")
      return new Response("Not found", { status: 404 });
    const ready = state === "connected" || state === "muted";
    return Response.json(
      { service: "twitch", state, startedAt },
      { status: path === "/ready" && !ready ? 503 : 200 },
    );
  },
});
async function shutdown() {
  if (stopping) return;
  stopping = true;
  disconnect();
  rewards.stop();
  await report("stopped", "Twitch worker shut down.").catch(() => {});
  server.stop();
  process.exit(0);
}
process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
while (!stopping) {
  try {
    await rewards.reconcile(await getSettings(), async (message) => {
      const session = active;
      const current = await getSettings();
      if (!session?.subscribed || !current.twitchEnabled || current.twitchMuted || !current.botUserId ||
        !current.broadcasterUserId || connectionKey(current) !== connectionKey(session.settings)) return false;
      const result = await session.api.asUser(current.botUserId, (client) => client.chat.sendChatMessage(current.broadcasterUserId!, message));
      return result.isSent;
    });
    await reconcile();
  } catch {
    disconnect();
    recordFailure();
    await report(
      "error",
      "Twitch connection failed. Check credentials, database, and network in the dashboard.",
    ).catch(() => {
      console.error("[twitch] Could not update runtime status.");
    });
  }
  await Bun.sleep(5000);
}
