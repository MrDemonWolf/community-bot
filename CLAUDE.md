# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Community Bot monorepo for MrDemonWolf, Inc. Turborepo workspace containing the web dashboard, documentation site, Discord bot, Twitch bot, and shared packages.

## Workspace Structure

```
apps/
  web/                    # Next.js web dashboard
  docs/                   # Fumadocs documentation site
  discord/                # Discord bot (discord.js v14, BullMQ, Express API)
  twitch/                 # Twitch chat bot (@twurple/chat, Express API)
packages/
  db/                     # Prisma schema + client (SOURCE OF TRUTH)
  env/                    # Shared Zod-validated env vars (@t3-oss/env-core)
  events/                 # Redis Pub/Sub event bus for inter-service communication
  config/                 # Shared TypeScript config (tsconfig.base.json)
  server/                 # Shared Express API server (createApiServer, listenWithFallback)
  auth/                   # Authentication package (better-auth)
  api/                    # Shared tRPC API utilities
```

## Commands

```bash
pnpm install              # Install all workspace dependencies
pnpm dev                  # Run all apps in dev mode (turbo)
pnpm build                # Build all packages and apps
pnpm db:generate          # Generate Prisma client from shared schema
pnpm db:push              # Push schema to database
pnpm db:migrate           # Run database migrations
pnpm db:studio            # Open Prisma Studio
```

## Shared Database (`@community-bot/db`)

All apps import the Prisma client and types from the shared db package:

```typescript
import { prisma } from "@community-bot/db";
import type { DiscordGuild } from "@community-bot/db";
import { TwitchAccessLevel, QueueStatus } from "@community-bot/db";
```

### Prisma Schema — Source of Truth

All model/enum definitions live in `packages/db/prisma/schema/` as split domain files:

| File | Contents |
|------|----------|
| `schema.prisma` | Generator + datasource config |
| `auth.prisma` | User, Session, Account, Verification, BotChannel relation on User |
| `discord.prisma` | DiscordGuild |
| `twitch.prisma` | TwitchChannel, TwitchNotification, TwitchCredential, TwitchChatCommand, TwitchRegular, BotChannel, enums |
| `queue.prisma` | QueueEntry, QueueState, QueueStatus |
| `audit.prisma` | AuditLog |
| `system.prisma` | SystemConfig (key-value runtime config) |

After schema changes, run `pnpm db:generate` from root.

## Shared Event Bus (`@community-bot/events`)

Type-safe Redis Pub/Sub event bus for real-time inter-service communication. All three services (Discord bot, Twitch bot, Web dashboard) use it to publish and subscribe to events.

```typescript
import { EventBus } from "@community-bot/events";

const eventBus = new EventBus(redisUrl);
await eventBus.publish("command:updated", { commandId: "abc" });
await eventBus.on("channel:join", (payload) => { /* handle */ });
```

### Event Types

| Event | Payload | Publisher | Subscribers |
|-------|---------|-----------|-------------|
| `channel:join` | `{ channelId, username }` | Web | Twitch |
| `channel:leave` | `{ channelId, username }` | Web | Twitch |
| `command:created/updated/deleted` | `{ commandId }` | Web | Twitch |
| `regular:created/deleted` | `{ twitchUserId }` | Web | Twitch |
| `stream:online` | `{ channelId, username, title, startedAt }` | Twitch | Discord |
| `stream:offline` | `{ channelId, username }` | Twitch | Discord |
| `queue:updated` | `{ channelId }` | Any | Any |
| `discord:settings-updated` | `{ guildId }` | Web | Discord |
| `discord:test-notification` | `{ guildId }` | Web | Discord |
| `bot:status` | `{ service, status }` | Discord/Twitch | Any |

## Audit Log System

Every mutation in the web dashboard is logged via the `logAudit()` utility in `packages/api/src/utils/audit.ts`. Each log entry records the user, action, resource, and optional metadata.

### Action Conventions

Actions use dot-separated strings: `domain.verb`. Current instrumented actions:

| Action | Description |
|--------|-------------|
| `bot.enable` | Twitch bot enabled for channel |
| `bot.disable` | Twitch bot disabled for channel |
| `bot.command-toggles` | Default command toggles updated |
| `bot.command-access-level` | Default command access level changed |
| `command.create` | Custom chat command created |
| `command.update` | Custom chat command updated |
| `command.delete` | Custom chat command deleted |
| `command.toggle` | Custom chat command enabled/disabled |
| `regular.add` | Regular (trusted user) added |
| `regular.remove` | Regular removed |
| `discord.link` | Discord guild linked |
| `discord.set-channel` | Notification channel configured |
| `discord.set-role` | Notification role configured |
| `discord.enable` | Discord notifications enabled |
| `discord.disable` | Discord notifications disabled |
| `import.streamelements` | Commands imported from StreamElements |

### Role-Based Visibility

The audit log feed is filtered by user role. ADMIN sees all entries. Other roles (MODERATOR, LEAD_MODERATOR) see entries from their level and below in the hierarchy: USER < MODERATOR < LEAD_MODERATOR < ADMIN.

## First-User Setup Wizard

On first startup, the web app generates a one-time setup token and logs a setup URL to the console. The first user to visit `/setup/{token}` and sign in becomes the broadcaster and is promoted to ADMIN. The token is single-use and deleted after setup completes.

Runtime config is stored in the `SystemConfig` table (key-value pairs):
- `broadcasterUserId` — the User ID of the broadcaster (set during setup)
- `setupToken` — the one-time token (deleted after use)
- `setupComplete` — `"true"` once setup is done

Key files:
- `apps/web/src/lib/setup.ts` — Server utilities: `ensureSetupToken()`, `getBroadcasterUserId()`, `isSetupComplete()`
- `apps/web/src/instrumentation.ts` — Next.js instrumentation hook that generates the token on startup
- `apps/web/src/app/(auth)/setup/[token]/` — Setup route and multi-step wizard
- `packages/api/src/routers/setup.ts` — tRPC router with `status` (public) and `complete` (protected) procedures

The dashboard layout (`apps/web/src/app/(dashboard)/layout.tsx`) guards against access before setup is complete. Public pages (`/public`, `/public/commands`, `/public/queue`) read the broadcaster from `SystemConfig` via `getBroadcasterUserId()`.

## Shared Environment (`@community-bot/env`)

Each app has its own validated env config in the shared package using `@t3-oss/env-core`:

- `packages/env/src/server.ts` — Web dashboard server env (includes `DISCORD_BOT_TOKEN` for Discord REST API calls)
- `packages/env/src/web.ts` — Web dashboard client env
- `packages/env/src/discord.ts` — Discord bot env
- `packages/env/src/twitch.ts` — Twitch bot env

Apps re-export from their local `src/utils/env.ts` for convenience.

## Docker

Single `docker-compose.yml` at repo root with shared PostgreSQL and Redis, plus per-app services:

```bash
docker compose up -d postgres redis   # Start infrastructure only
docker compose up -d                  # Start everything
```

Per-app Dockerfiles are at `apps/discord/Dockerfile` and `apps/twitch/Dockerfile`, built from the monorepo root context.

## TypeScript

Both bots use ESM (`"type": "module"`) with NodeNext module resolution. All relative imports require `.js` extensions. Both tsconfigs extend `@community-bot/config/tsconfig.base.json`. The `packages/events` package uses `bundler` module resolution (no `.js` extensions) since it's consumed by Next.js Turbopack.

## Discord Bot (`apps/discord/`)

discord.js v14, Express API, BullMQ job queue (Redis), EventBus. Features include Twitch live stream notifications, slash commands, background job scheduling, guild database sync. The bot subscribes to `discord:settings-updated` EventBus events to reload guild settings when changed from the web dashboard. Guilds with `enabled: false` are skipped during notification checks. Entry point: `src/app.ts`.

## Twitch Bot (`apps/twitch/`)

@twurple/chat + @twurple/auth v7, Express API, EventBus. Channels are loaded from the database (`BotChannel` table) at startup. Features include database-driven chat commands with variables/cooldowns/access levels, viewer queue, stream status tracking, Device Code Flow auth. The bot subscribes to EventBus events for real-time channel join/leave and command/regular reload. Entry point: `src/app.ts`.

## Web Dashboard (`apps/web/`)

Next.js with tRPC, better-auth, and EventBus. On first startup, a setup wizard flow (`/setup/{token}`) designates the broadcaster and promotes them to ADMIN (see "First-User Setup Wizard" section). Features a two-column dashboard layout with an audit log feed, bot controls card, and quick stats. Users can manage the Twitch bot (enable/disable, commands, regulars) and Discord settings (link guild, notification channel/role, enable/disable notifications) from `/dashboard/discord`. All mutations are logged to the audit log with role-based visibility in the dashboard feed.

## Web Dashboard Design System (`apps/web/`)

### Brand Colors

| Token | Hex Origin | Role | Tailwind Class |
|-------|-----------|------|----------------|
| `--brand-main` | `#00ACED` | **Primary CTA** — buttons, links, highlights | `bg-brand-main`, `text-brand-main` |
| `--brand-accent` | `#091533` | **Accent** — deep navy (dark), medium navy (light) | `bg-brand-accent`, `text-brand-accent` |
| `--brand-twitch` | `#9146FF` | Twitch-specific UI | `bg-brand-twitch`, `text-brand-twitch` |
| `--brand-discord` | `#5865F2` | Discord-specific UI | `bg-brand-discord`, `text-brand-discord` |

### Color Rules

- **Never hardcode hex colors** — always use semantic tokens (`bg-card`, `text-foreground`, `border-border`)
- Brand colors are oklch values in `apps/web/src/index.css`, registered in `@theme inline` for Tailwind
- Use opacity modifiers for states: `hover:bg-brand-main/80`, `bg-brand-accent/10`
- Glass effects: `.glass` (panels) and `.glass-subtle` (bars/headers)
- Surface elevation: `bg-surface-raised`, `bg-surface-overlay`

### Typography

- **Headings**: Montserrat (geometric, modern) — `font-heading` / `--font-heading`
- **Body**: Roboto (clean, readable) — `font-sans` / `--font-body`
- Loaded via `next/font/google` in `apps/web/src/app/layout.tsx`

### Layout Structure

- `(landing)/` — floating glass header + footer + content
- `(dashboard)/dashboard/` — minimal header + sidebar + content (auth-gated), includes `/dashboard/discord` for Discord settings
- `(auth)/` — centered card on gradient background (login + setup wizard)

### Animations

- `.animate-fade-in-up` — upward entrance (0.5s)
- `.animate-fade-in` — opacity entrance (0.4s)
- `.animate-slide-in-left` — left entrance (0.4s)
- Stagger with inline `animation-delay` styles
