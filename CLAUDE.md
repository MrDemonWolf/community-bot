# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Community Bot monorepo for MrDemonWolf, Inc. Turborepo workspace containing the web dashboard, shared packages (db, env, config, auth, api).

## Prisma Schema — Source of Truth

This repo owns the Prisma schema. All model/enum definitions live in `packages/db/prisma/schema/` as split domain files:

| File | Contents |
|------|----------|
| `schema.prisma` | Generator + datasource config |
| `auth.prisma` | User, Session, Account, Verification, TwoFactor (web app) |
| `discord.prisma` | DiscordGuild |
| `twitch.prisma` | TwitchChannel, TwitchNotification, TwitchCredential, TwitchChatCommand, TwitchRegular, enums |
| `queue.prisma` | QueueEntry, QueueState, QueueStatus |

**When you add or modify models, edit these files here.** Then sync to the consumer projects:

```bash
# In ../community-bot-discord:
pnpm prisma:sync && pnpm prisma:generate

# In ../community-bot-twitch:
pnpm prisma:sync && pnpm db:generate
```

Consumer projects have a `scripts/sync-prisma.sh` that pulls the `.prisma` files listed in their `SCHEMA_FILES` array, combines them with their local generator config, and writes a single `prisma/schema.prisma`.

### Adding a new domain file

1. Create e.g. `packages/db/prisma/schema/moderation.prisma` with your models
2. In each consumer project that needs it, add `"moderation.prisma"` to the `SCHEMA_FILES` array in `scripts/sync-prisma.sh`
3. Run `pnpm prisma:sync` in those projects

### Migrations

Migrations are owned by `community-bot-discord` (it has the migration history). After schema changes:

```bash
# In ../community-bot-discord:
pnpm prisma:sync && pnpm prisma:generate && pnpm prisma:migrate
```

## Commands

```bash
pnpm install              # Install all workspace dependencies
pnpm dev                  # Run all apps in dev mode (turbo)
pnpm build                # Build all packages and apps
```

## Workspace Structure

```
apps/
  web/                    # Next.js web dashboard
packages/
  db/                     # Prisma schema + client (SOURCE OF TRUTH)
  env/                    # Shared Zod-validated env vars
  config/                 # Shared TypeScript config
  auth/                   # Authentication package
  api/                    # Shared API utilities
```
