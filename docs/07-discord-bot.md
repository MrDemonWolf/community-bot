# 07 — Discord bot (apps/discord)

`discord.js@^14.26`. Always-on gateway connection. Bun process running in Dokploy.

## Intents

```ts
import { GatewayIntentBits, Partials } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,         // privileged — toggle in Dev Portal
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,       // privileged — toggle in Dev Portal
    GatewayIntentBits.GuildPresences,       // privileged — toggle in Dev Portal
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.User],
});
```

Privileged intents documented in `docs/17-operations.md`.

## Phase 1 commands

- `/ping` — replies "Pong! `<uptime>`"
- `/about` — wolf-themed about message
- `/commands` — link to public `/commands` page

Custom commands from `commands` table register dynamically. Strategy: register as guild commands keyed by name; on reload `guild.commands.set([...])`.

## Phase 6 commands

- `/link` — link Twitch account
- `/mydata` — request GDPR export
- `/forgetme` — confirmation flow + cascade delete

## Phase 3 mod slash commands

- `/warn @user reason` → `audit_logs`; optional DM
- `/timeout @user duration reason` → Discord API + audit
- `/note @user text` → mod-only note; not visible to user
- `/mycase` → user self-serve case lookup
- `/unwarn case-id`

Mod-log channel post per action.

## Configurable Discord activity (Phase 6)

Dashboard: `/dashboard/discord/activity`. Settings live under `settings.discord.activity`:

```ts
{
  enabled: true,
  rotationIntervalSec: 60,
  status: 'online',  // 'online' | 'idle' | 'dnd' | 'invisible'
  activities: [
    { type: 'Playing', text: 'with brain cells 🧠' },
    { type: 'Watching', text: '${followers} wolves' },
    { type: 'Listening', text: 'to chat' },
  ],
  autoStreaming: true,  // when live, override to `Streaming` type with stream URL
  liveOverride: { type: 'Streaming', text: '${title}', url: 'https://twitch.tv/mrdemonwolf' },
}
```

Variables (`${followers}`, `${title}`) resolved server-side every rotation.

Bot subscribes to Supabase Realtime `stream.state` channel. On `stream.online` → swap to `liveOverride`. On `stream.offline` → resume rotation.

## Stream-live cross-post (Phase 6)

When `stream.online` fires:

- Embed in configured channel (`settings.discord.streamLive.channelId`)
- Color: cyan `#0FACED` (decimal `1027949`)
- Title: current stream title
- URL: `https://twitch.tv/mrdemonwolf`
- Fields: Game, Started at
- Footer: "Go catch the wolf 🐺"
- Optional role ping: `settings.discord.streamLive.mentionRoleId`

Edit every 10 min with viewer count + game.

On `stream.offline` → edit to "Stream ended", duration, VOD link.

## The Den (sub-only page)

- Dashboard route `/den`
- Login required (Twitch OAuth)
- Server-side check: user's Twitch ID has active sub via Helix `getSubscriptionForUser`
- Cache result 60s
- Content: sub schedule, sneak peeks, polls, member shoutouts
- Linked from Discord via slash `/den` (returns URL)

## Graceful shutdown

```ts
process.on('SIGTERM', async () => {
  isShuttingDown = true;
  await Promise.all([
    ...workers.map(w => w.stop()),
    realtime.unsubscribe(),
    client.destroy(),
  ]);
  process.exit(0);
});
```

`docker/compose.yml`: `stop_grace_period: 30s`.

## Phase 1 scope (apps/discord)

Get bot running, post `/ping`, register slash commands per guild, connect to gateway. Audit log on slash command use. Nothing else.
