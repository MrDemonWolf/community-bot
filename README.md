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

- **Twitch Chat Bot** — Database-driven custom commands with 40+ dynamic response variables, cooldowns, access levels, regex triggers, keyword matching, and stream status awareness.
- **Discord Bot** — Slash commands, Twitch live stream notifications, moderation (ban/kick/warn/mute with case tracking), self-assignable role panels, message templates, scheduled messages, and cross-platform quotes.
- **Web Dashboard** — Next.js app with tRPC, Discord and Twitch OAuth, audit log feed, bot controls, and full management of commands, regulars, quotes, counters, timers, spam filters, song requests, viewer queue, Discord settings, and user roles.
- **Viewer Queue** — Position-based queue system managed from chat (`!queue`) or the dashboard with open/close/pause controls.
- **Quotes** — Cross-platform quote system shared between Twitch chat and Discord slash commands.
- **Named Counters** — Create, increment, decrement, and display counters from chat.
- **Recurring Timers** — Automated chat messages on an interval with chat-line thresholds and online-only mode.
- **Spam Filters** — Configurable filters for caps, links, symbols, emotes, repetition, and banned words with permit system.
- **Moderation Commands** — `!permit`, `!nuke`, `!vanish`, and `!clip` for Twitch chat moderation.
- **Song Requests** — Viewers request songs via `!sr`; manage the queue from the dashboard with skip, remove, and clear.
- **AI-Enhanced Shoutouts** — Optional Google Gemini integration for personalized shoutout messages via `!so`.
- **Giveaways & Polls** — Run giveaways and polls from chat or the dashboard.
- **Import/Export** — Import commands from Nightbot or export your full channel config as JSON.
- **Welcome Messages** — Configurable Discord welcome/leave messages, auto-role, and DM welcome with embed builder.
- **User Management** — Role-based access control (USER → MODERATOR → LEAD_MODERATOR → BROADCASTER) with ban system.
- **Real-Time Event Bus** — Type-safe Redis Pub/Sub for instant communication between all services.
- **First-User Setup Wizard** — One-time `/setup/{token}` flow that designates the broadcaster.
- **Documentation Site** — Fumadocs-powered docs with guides for every feature and full variable reference.

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

| Command           | Description                              | Access     |
|-------------------|------------------------------------------|------------|
| `!ping`           | Basic ping/pong response                 | Everyone   |
| `!uptime`         | Display stream uptime                    | Everyone   |
| `!title`          | Show current stream title                | Everyone   |
| `!game`           | Show current game/category               | Everyone   |
| `!followage`      | Show how long you've followed            | Everyone   |
| `!accountage`     | Look up Twitch account age               | Everyone   |
| `!commands`       | Links to the public commands page        | Everyone   |
| `!quote`          | View, add, remove, search quotes         | Everyone/Mod |
| `!counter`        | Manage named counters                    | Mod+       |
| `!sr`             | Song request queue                       | Everyone/Mod |
| `!queue`          | Viewer queue management                  | Everyone/Mod |
| `!so` / `!shoutout` | Shout out another streamer (+ AI)     | Mod+       |
| `!permit`         | Temporarily exempt a user from filters   | Mod+       |
| `!nuke`           | Timeout users matching a phrase          | Mod+       |
| `!vanish`         | Self-timeout for 1 second                | Everyone   |
| `!clip`           | Create a clip of the current stream      | Everyone   |
| `!command`        | Manage custom commands                   | Mod+       |
| `!reloadcommands` | Reload commands from database            | Mod+       |
| `!bot`            | Bot mute/unmute controls                 | Mod+       |
| `!filesay`        | Fetch a URL and send lines to chat       | Mod+       |
| `!weather`        | Show weather for a location              | Everyone   |
| `!giveaway`       | Run a chat giveaway                      | Mod+       |
| `!poll`           | Run a chat poll                          | Mod+       |

See the [docs](http://localhost:3000/docs/twitch-bot/built-in-commands)
for full command details and response variables.

### Web Dashboard

After completing the setup wizard, the dashboard provides:

- **Bot Controls** — Enable/disable/mute the Twitch bot
- **Command Management** — CRUD for custom commands and default command toggles
- **Regulars, Quotes, Counters, Timers** — Full management UI
- **Spam Filters** — Configure all filter types with thresholds
- **Song Requests & Viewer Queue** — Real-time queue management
- **Discord Settings** — Link guild, set notification channel/role, welcome messages
- **User Management** — Assign roles and ban/unban users (broadcaster only)
- **Audit Log** — Role-filtered history of all dashboard changes
- **Public Pages** — `/p/commands` and `/p/queue` for viewers

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
