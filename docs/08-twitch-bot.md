# 08 — Twitch bot (apps/twitch)

`@twurple` v8.x. Chat via IRC (`@twurple/chat`). Events via `@twurple/eventsub-ws`. Helix via `@twurple/api`.

## Auth

`RefreshingAuthProvider` from `@twurple/auth`. Refresh tokens stored encrypted in `twitchTokens` table. Refresh handler updates DB + audits.

```ts
import { RefreshingAuthProvider } from "@twurple/auth";

const authProvider = new RefreshingAuthProvider({
  clientId: env.TWITCH_CLIENT_ID,
  clientSecret: env.TWITCH_CLIENT_SECRET,
});

authProvider.onRefresh(async (userId, newTokenData) => {
  await db
    .update(twitchTokens)
    .set({
      accessToken: encrypt(newTokenData.accessToken),
      refreshToken: encrypt(newTokenData.refreshToken),
      expiresAt: new Date(newTokenData.expiresIn ? Date.now() + newTokenData.expiresIn * 1000 : 0),
      scope: newTokenData.scope,
    })
    .where(eq(twitchTokens.userId, userId));
  await auditLog.write({ action: "twitch.token.refresh", actorId: userId });
});
```

## Scopes (broadcaster auth)

Required:

- `chat:read` `chat:edit`
- `channel:read:subscriptions` `channel:read:redemptions`
- `moderator:manage:banned_users` `moderator:manage:announcements` `moderator:manage:chat_messages`
- `channel:manage:broadcast` (for set-title/set-game later)
- `channel:manage:redemptions`
- `clips:edit`
- `user:read:follows`
- `moderation:read`
- `channel:edit:commercial`

Mod auth (separate flow): `chat:read` `chat:edit` `moderator:manage:banned_users` `moderation:read`.

## Chat (apps/twitch/src/chat)

```ts
import { ChatClient } from "@twurple/chat";

const chatClient = new ChatClient({
  authProvider,
  channels: [broadcasterLogin],
});

chatClient.onMessage(async (channel, user, message, msg) => {
  // command dispatch
});
```

Outbound: `chatClient.say(channel, message)`.

Rate limit: 20 messages per 30s for non-mods, ~100/30s for mods/broadcaster. Bot account should be a moderator.

## EventSub WS (apps/twitch/src/events)

```ts
import { EventSubWsListener } from "@twurple/eventsub-ws";

const listener = new EventSubWsListener({ apiClient });
listener.start();

listener.onStreamOnline(broadcasterId, async (e) => {
  await writeRawEvent({ type: "stream.online", payload: e });
  await enqueueAction("stream.online", { broadcasterId });
});
```

Subscribe to:

- `onStreamOnline` / `onStreamOffline`
- `onChannelSubscribe` / `onChannelSubscriptionGift` / `onChannelSubscriptionMessage` / `onChannelSubscriptionEnd`
- `onChannelCheer`
- `onChannelRaid` (incoming + outgoing)
- `onChannelFollow` (with anti-bot follow filter — flag rapid bursts)
- `onChannelChannelPointsCustomRewardRedemptionAdd` — for Brain Cells flow
- `onChannelChatClear` / `onChannelChatClearUserMessages`
- `onChannelModeratorAdd` / `onChannelModeratorRemove`
- `onChannelBan` / `onChannelUnban`
- `onChannelUpdate` (title/game changes)

Each fires `writeRawEvent` → outbox row → downstream workers.

## Commands runtime

- On startup: load all enabled `commands` rows into in-memory cache (Map by name + aliases)
- On message: tokenize, match against cache, check role, check cooldowns
- Cooldown enforcement: in-memory ring buffer (`commandName → lastFiredAt`) + per-user map
- Template render via `packages/shared/template/`
- Reply via `chatClient.say`
- Audit if `minRole >= moderator`

Reload via Supabase Realtime `commands.reload` channel when dashboard updates a command.

## Timers runtime

`pg_cron` schedule `cron.timer-tick` (every minute):

1. SQL fetches timers due (`next_fire_at <= now()` AND `enabled = true`)
2. For each: enqueue pgmq job `timers.fire` with timer id
3. Worker (in apps/twitch): pop, check min-chat-lines via recent message counter, rotate message, post

## Phase 2 commands (the MVP 12)

See `docs/02-database.md` and `phases/phase-02-twitch-mvp.md`. Implementations live in `apps/twitch/src/builtins/` — each command in its own file. Builtins are first-class rows in `commands` table seeded by `packages/db/seed/default-commands.ts`.

## Configurable IRC nick

Bot can be the broadcaster's own account (chats as themselves) OR a separate bot account. Settings `twitch.botMode`: `'self'` | `'separate'`. Default `'separate'`. Documented in setup wizard.

## Graceful shutdown

```ts
process.on("SIGTERM", async () => {
  isShuttingDown = true;
  await Promise.all([
    ...workers.map((w) => w.stop()),
    listener.stop(),
    chatClient.quit(),
    realtime.unsubscribe(),
  ]);
});
```
