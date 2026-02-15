# Community Bot

Community Bot monorepo for MrDemonWolf, Inc. Turborepo workspace containing the web dashboard, documentation site, Discord bot, Twitch bot, and shared packages.

## Features

- **Discord Bot** - discord.js v14 with slash commands, Twitch live notifications, BullMQ job queue
- **Twitch Bot** - @twurple/chat with database-driven commands, viewer queue, stream status tracking
- **Web Dashboard** - Next.js with tRPC, better-auth (Discord + Twitch OAuth), bot management
- **Real-time Event Bus** - Redis Pub/Sub for instant inter-service communication
- **Shared Database** - Prisma with PostgreSQL, split schema files per domain
- **TypeScript** - End-to-end type safety across all packages
- **Audit Log** - Every mutation logged with user, action, and metadata; role-filtered visibility in the dashboard feed
- **Discord Controls** - Link Discord server, configure notification channel/role, enable/disable notifications, send test notifications from the web dashboard
- **Dashboard Redesign** - Two-column layout with audit log feed, bot controls, and quick stats
- **First-User Setup Wizard** - One-time `/setup/{token}` flow that designates the broadcaster and promotes them to admin
- **Turborepo** - Optimized monorepo build system

## Getting Started

1. Install dependencies:

```bash
pnpm install
```

2. Start infrastructure:

```bash
docker compose up -d postgres redis
```

3. Copy environment files and configure:

```bash
cp apps/web/.env.example apps/web/.env
cp apps/discord/.env.example apps/discord/.env
cp apps/twitch/.env.example apps/twitch/.env
```

4. Push the database schema:

```bash
pnpm db:push
```

5. Start all services in development mode:

```bash
pnpm dev
```

6. Complete first-time setup:

On first startup, the web app logs a one-time setup URL to the console. Visit the URL, sign in with Twitch or Discord, and complete the wizard to become the broadcaster and admin.

- Web dashboard: [http://localhost:3001](http://localhost:3001)
- Docs: [http://localhost:3000](http://localhost:3000)
- Discord bot API: [http://localhost:3141](http://localhost:3141)
- Twitch bot API: [http://localhost:3737](http://localhost:3737)

## Project Structure

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
  server/                 # Shared Express API server
  auth/                   # Authentication package (better-auth)
  api/                    # Shared tRPC API utilities
```

## Available Scripts

- `pnpm dev` - Start all applications in development mode
- `pnpm build` - Build all applications
- `pnpm db:generate` - Generate Prisma client from shared schema
- `pnpm db:push` - Push schema changes to database
- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Open Prisma Studio
