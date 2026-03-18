<p align="center">
  <img src="assets/logo-white-border.png" alt="MrDemonWolf Logo" width="150" />
</p>

# Community Bot - MrDemonWolf's Stream Management Platform

Community Bot is MrDemonWolf's personal, self-hosted stream
management platform — a monorepo that ties together a Twitch
chat bot, Discord notification bot, and web dashboard into one
cohesive system. It's built specifically for his channels, but
it's fully open source so anyone can fork it and adapt it for
their own streams.

Your stream, your bot, your rules.

## Features

- **Twitch Chat Bot** - Database-driven custom commands with
  40+ dynamic response variables, viewer queue, cooldowns,
  access levels, regex triggers, and stream status awareness.
- **Discord Bot** - Slash commands and Twitch live stream
  notifications with BullMQ job scheduling and automatic
  guild sync.
- **Web Dashboard** - Next.js app with tRPC, Discord and
  Twitch OAuth, audit log feed, bot controls, and full
  command management.
- **Real-Time Event Bus** - Type-safe Redis Pub/Sub for
  instant communication between all services.
- **First-User Setup Wizard** - One-time `/setup/{token}` flow
  that designates the broadcaster and promotes them to admin.
- **Documentation Site** - Fumadocs-powered docs with guides
  for every feature and full variable reference.

## Getting Started

Full documentation is available at the
[docs site](http://localhost:3000) when running locally.

1. Install dependencies:

```bash
bun install
```

2. Start infrastructure services:

```bash
docker compose up -d postgres redis
```

3. Copy and configure environment files:

```bash
cp apps/web/.env.example apps/web/.env
cp apps/discord/.env.example apps/discord/.env
cp apps/twitch/.env.example apps/twitch/.env
```

4. Push the database schema:

```bash
bun db:push
```

5. Start all services in development mode:

```bash
bun dev
```

6. Complete first-time setup by visiting the one-time setup
   URL logged to the console.

## Usage

### Service URLs (Development)

| Service         | URL                     |
|-----------------|-------------------------|
| Web Dashboard   | `http://localhost:3001`  |
| Documentation   | `http://localhost:3000`  |
| Discord Bot API | `http://localhost:3141`  |
| Twitch Bot API  | `http://localhost:3737`  |

### Built-In Twitch Commands

| Command           | Description                              |
|-------------------|------------------------------------------|
| `!ping`           | Basic ping/pong response                 |
| `!uptime`         | Display stream uptime                    |
| `!accountage`     | Look up Twitch account age               |
| `!bot`            | Bot mute/unmute controls                 |
| `!queue`          | Viewer queue management                  |
| `!command`        | Manage custom commands (mod+)            |
| `!reloadcommands` | Reload commands from database (mod+)     |
| `!filesay`        | Fetch a URL and send lines to chat       |
| `!commands`       | Links to the public commands page        |

See the [docs](http://localhost:3000/docs/twitch-bot/built-in-commands)
for full command details and response variables.

## Tech Stack

| Layer              | Technology                           |
|--------------------|--------------------------------------|
| Language           | TypeScript (ESM)                     |
| Build System       | Turborepo, bun workspaces           |
| Web Framework      | Next.js 16                           |
| API Layer          | tRPC                                 |
| Authentication     | better-auth (Discord + Twitch OAuth) |
| Discord Library    | discord.js v14                       |
| Twitch Library     | @twurple/chat v7, @twurple/auth v7   |
| Database           | PostgreSQL via Drizzle ORM           |
| Cache / Events     | Redis (ioredis), Redis Pub/Sub       |
| Job Queue          | BullMQ                               |
| UI Components      | shadcn/ui, Tailwind CSS v4           |
| Documentation      | Fumadocs                             |
| Env Validation     | @t3-oss/env-core + Zod              |
| HTTP Server (Bots) | Express 5                            |
| Containerization   | Docker Compose                       |

## Development

### Prerequisites

- Node.js 22+
- Bun 1.x
- Docker and Docker Compose
- A Twitch application (Client ID and Secret)
- A Discord application (Bot Token, Client ID, Client Secret)

### Setup

1. Clone the repository:

```bash
git clone https://github.com/MrDemonWolf/community-bot.git
cd community-bot
```

2. Install dependencies:

```bash
bun install
```

3. Start PostgreSQL and Redis:

```bash
docker compose up -d postgres redis
```

4. Copy environment files and fill in credentials:

```bash
cp apps/web/.env.example apps/web/.env
cp apps/discord/.env.example apps/discord/.env
cp apps/twitch/.env.example apps/twitch/.env
```

5. Push the database schema:

```bash
bun db:push
```

6. Start development:

```bash
bun dev
```

### Development Scripts

- `bun dev` - Start all apps in development mode
- `bun build` - Build all packages and apps
- `bun test` - Run Vitest unit tests
- `bun check-types` - Type-check all packages
- `bun db:push` - Push schema changes to database
- `bun db:migrate` - Run database migrations
- `bun db:studio` - Open Drizzle Studio GUI
- `bun dev:web` - Start only the web dashboard

### Code Quality

- TypeScript strict mode across all packages
- Zod-validated environment variables
- Vitest for unit testing
- Shared `tsconfig.base.json` for consistent compiler settings

## Project Structure

```
apps/
  web/                    # Next.js web dashboard (tRPC, better-auth)
  docs/                   # Fumadocs documentation site
  discord/                # Discord bot (discord.js v14, BullMQ, Express)
  twitch/                 # Twitch chat bot (@twurple/chat, Express)
packages/
  db/                     # Drizzle schema + client
  env/                    # Shared Zod-validated environment configs
  events/                 # Redis Pub/Sub typed event bus
  config/                 # Shared TypeScript config
  server/                 # Shared Express API server utilities
  auth/                   # Authentication package (better-auth)
  api/                    # Shared tRPC routers and utilities
docker-compose.yml        # PostgreSQL, Redis, and bot services
turbo.json                # Turborepo pipeline configuration
```

## Acknowledgments

Community Bot is built on the shoulders of these excellent
open-source projects and tools:

- [Next.js](https://nextjs.org/) - React framework for the web dashboard
- [Turborepo](https://turbo.build/) - Monorepo build system
- [Bun](https://bun.sh/) - JavaScript runtime and package manager
- [discord.js](https://discord.js.org/) - Discord API library
- [@twurple](https://twurple.js.org/) - Twitch API and chat library
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Redis](https://redis.io/) - Caching and Pub/Sub event bus
- [better-auth](https://www.better-auth.com/) - Authentication
- [tRPC](https://trpc.io/) - End-to-end typesafe API layer
- [shadcn/ui](https://ui.shadcn.com/) - UI component library
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Fumadocs](https://fumadocs.vercel.app/) - Documentation framework
- [BullMQ](https://bullmq.io/) - Job queue for background tasks
- [Docker](https://www.docker.com/) - Containerization

## License

[![GitHub license](https://img.shields.io/github/license/MrDemonWolf/community-bot.svg?style=for-the-badge&logo=github)](https://github.com/MrDemonWolf/community-bot/blob/main/LICENSE)

## Contact

Have questions or feedback?

- Discord: [Join my server](https://mrdwolf.net/discord)

---

Made with love by [MrDemonWolf, Inc.](https://www.mrdemonwolf.com)
