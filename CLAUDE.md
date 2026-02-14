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
| `auth.prisma` | User, Session, Account, Verification (web app) |
| `discord.prisma` | DiscordGuild |
| `twitch.prisma` | TwitchChannel, TwitchNotification, TwitchCredential, TwitchChatCommand, TwitchRegular, enums |
| `queue.prisma` | QueueEntry, QueueState, QueueStatus |

After schema changes, run `pnpm db:generate` from root.

## Shared Environment (`@community-bot/env`)

Each app has its own validated env config in the shared package using `@t3-oss/env-core`:

- `packages/env/src/server.ts` — Web dashboard server env
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

Both bots use ESM (`"type": "module"`) with NodeNext module resolution. All relative imports require `.js` extensions. Both tsconfigs extend `@community-bot/config/tsconfig.base.json`.

## Discord Bot (`apps/discord/`)

discord.js v14, Express API, BullMQ job queue (Redis). Features include Twitch live stream notifications, slash commands, background job scheduling, guild database sync. Entry point: `src/app.ts`.

## Twitch Bot (`apps/twitch/`)

@twurple/chat + @twurple/auth v7, Express API. Features include database-driven chat commands with variables/cooldowns/access levels, viewer queue, stream status tracking, Device Code Flow auth. Entry point: `src/app.ts`.
