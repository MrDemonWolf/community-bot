# GEMINI.md - Community Bot Project Context

This file provides the necessary context for Gemini CLI to understand and interact with the Community Bot monorepo.

## Project Overview

**Community Bot** is an all-in-one stream management platform for Twitch streamers, built as a TypeScript monorepo using **Turborepo** and **Bun**. It integrates a Twitch bot, a Discord bot, and a web dashboard into a single ecosystem with real-time communication via a Redis-backed EventBus.

### Core Architecture
- **Monorepo Manager**: [Turborepo](https://turbo.build/)
- **Runtime & Package Manager**: [Bun](https://bun.sh/) (preferred over pnpm/npm)
- **Database**: PostgreSQL with [Drizzle ORM](https://orm.drizzle.team/)
- **Inter-service Communication**: Redis Pub/Sub (EventBus) and BullMQ (for background jobs)
- **Web Dashboard**: [Next.js](https://nextjs.org/) (App Router), Tailwind CSS v4, tRPC, and better-auth.
- **Discord Bot**: [discord.js](https://discord.js.org/)
- **Twitch Bot**: [@twurple/chat](https://twurple.js.org/)

## Directory Structure

- `apps/`
  - `web/`: Next.js web dashboard (tRPC client, better-auth).
  - `discord/`: Discord bot service (commands, events, logging).
  - `twitch/`: Twitch chat bot (custom commands, timers, spam filters).
  - `docs/`: Fumadocs-powered documentation site.
- `packages/`
  - `db/`: Drizzle schema, migrations, and database client.
  - `api/`: Shared tRPC router and procedure definitions.
  - `events/`: Type-safe Redis EventBus for cross-service events.
  - `env/`: Zod-validated environment variable schemas.
  - `auth/`: Shared authentication logic (better-auth).
  - `server/`: Shared Express/Node.js server utilities.
  - `config/`: Shared TypeScript and tool configurations.

## Key Development Commands

| Command | Description |
|---------|-------------|
| `bun install` | Install all dependencies. |
| `bun run dev` | Start all services in development mode (Turborepo). |
| `bun run build` | Build all packages and apps. |
| `bun run check-types` | Run type-checking across the monorepo. |
| `bun run db:push` | Push Drizzle schema changes to the database. |
| `bun run db:studio` | Open Drizzle Studio to explore the database. |
| `bun run test` | Run unit tests with Vitest. |
| `bun run test:integration` | Run integration tests. |

## Development Conventions

- **Language**: TypeScript (ESM). Strict type checking is enforced.
- **Environment Variables**: Always use `@community-bot/env` for type-safe environment access. Never use `process.env` directly.
- **Database**: All schema changes must be defined in `packages/db/src/schema/`. Use `bun run db:push` for development updates.
- **Inter-app Communication**: Use the `EventBus` from `@community-bot/events` for real-time triggers (e.g., when a command is updated on the web dashboard, notify the bots).
- **Styling**: Tailwind CSS v4 is used in `apps/web` and `apps/docs`.
- **API**: The web dashboard communicates with the backend services via tRPC (defined in `packages/api`).
- **Logging**: Use the internal logger utility (usually found in `./utils/logger.ts` within apps) which provides structured logging.

## Tech Stack Summary

- **Frameworks**: Next.js, Express (for bot healthchecks/APIs).
- **ORM**: Drizzle ORM.
- **Auth**: better-auth (Discord & Twitch OAuth).
- **Communication**: Redis (ioredis), BullMQ.
- **Testing**: Vitest.
- **Documentation**: Fumadocs.
- **UI**: Shadcn UI, Radix UI.

## Important Note on README Discrepancies
The root `README.md` might mention **Prisma** or **pnpm**. As of the latest updates, the project has migrated to **Drizzle ORM** and **Bun**. Always prioritize the actual code (`packages/db/drizzle.config.ts` and `bun.lock`) over outdated documentation.
