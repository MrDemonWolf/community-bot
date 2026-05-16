# community-bot - Self-Hosted Twitch and Discord Community Bot

community-bot is an open-source community bot for Twitch and Discord, built for
the MrDemonWolf stream and shared with anyone who wants to run their own copy.
It replaces Fossabot, StreamElements, and Nightbot with one stack the
broadcaster fully owns: chat commands, timers, moderation, loyalty,
visual flows, role sync, and optional AI features.

One bot. Your data. Your rules.

## Features

- **Twitch chat bot** with a command runtime, scheduled timers, and a template engine compatible with most StreamElements variables.
- **Discord bot** with slash commands, stream-live alerts, configurable activity rotation, and graceful shutdown.
- **Cross-platform identity** linking Twitch and Discord into a single user record with role sync (sub, VIP).
- **Brain Cells loyalty** system: viewers earn currency by watching, chatting, subbing, and cheering, redeemable via the flow builder.
- **Visual flow builder** powered by `@xyflow/react` for event-driven automation, with an optional sandboxed JavaScript node via `quickjs-emscripten`.
- **Six-role RBAC**: broadcaster, editor, moderator, vip, subscriber, viewer, enforced at the database, API, and UI layers.
- **The Den**: a subscriber-only page for sneak peeks, schedules, and a sub-tier leaderboard.
- **Import wizard** for StreamElements, Nightbot, and Fossabot with a variable compatibility matrix and dry-run preview.
- **AI features** powered by Google Gemini: smart shoutouts, title suggestions, stream recaps, clip titles, hype messages, plus a content guardrail. Cost-capped, consent-aware, and EU AI Act labeled.
- **GDPR-ready** from day one: data export, delete, restrict, and object endpoints; append-only audit log; encrypted secrets at rest.
- **Self-hostable** on a single VPS via Dokploy (Docker Swarm and Traefik), with daily Supabase backups.

## Getting Started

Full documentation lives in `docs/` (planning pack) and `apps/docs/` (public Fumadocs site).

1. Clone the repository:

   ```bash
   git clone https://github.com/mrdemonwolf/community-bot.git
   cd community-bot
   ```

2. Install dependencies with Bun:

   ```bash
   bun install
   ```

3. Copy the environment template and fill in your secrets:

   ```bash
   cp .env.example .env
   ```

4. Start a local Supabase instance:

   ```bash
   bun supabase:start
   ```

5. Apply database migrations:

   ```bash
   bun db:migrate
   ```

6. Start the dev servers:

   ```bash
   bun dev
   ```

7. Visit `http://localhost:3001` and complete the setup wizard.

## Usage

Default Twitch commands ship with the `!` prefix.

| Command | Role | Description |
|---------|------|-------------|
| `!uptime` | Viewer | Current stream uptime |
| `!followage` | Viewer | How long the caller has followed |
| `!accountage` | Viewer | Twitch account age |
| `!game` | Viewer | Current Twitch category |
| `!title` | Viewer | Current stream title |
| `!commands` | Viewer | Link to the public commands page |
| `!addcom` | Moderator | Add a custom command |
| `!editcom` | Moderator | Edit a custom command |
| `!delcom` | Moderator | Delete a custom command |
| `!marker` | Moderator | Create a Twitch stream marker |
| `!clip` | Moderator | Create a 30-second clip |
| `!commercial` | Broadcaster | Run a commercial break |
| `!vanish` | Viewer | Self-purge from chat |
| `!ping` | Moderator | Health check |

Discord slash commands.

| Command | Role | Description |
|---------|------|-------------|
| `/ping` | Everyone | Bot latency |
| `/links` | Everyone | Project links |
| `/uptime` | Everyone | Bot uptime |
| `/about` | Everyone | Bot version and source |
| `/timeout` | Moderator | Timeout a member |
| `/ban` | Moderator | Ban a member |
| `/kick` | Moderator | Kick a member |
| `/warn` | Moderator | Warn a member |
| `/warnings` | Moderator | List warnings for a member |
| `/purge` | Moderator | Delete recent messages |
| `/slowmode` | Moderator | Set channel slowmode |
| `/link` | Everyone | Link Twitch to Discord |

Additional commands ship disabled by default and are documented in
`docs/02-database.md` and `packages/db/src/seed/default-commands.ts`.
The broadcaster enables them via the dashboard once the relevant phase ships.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Language | TypeScript (strict) |
| Frontend | TanStack Router, React, Tailwind CSS v4, shadcn/ui |
| Backend | Hono, tRPC |
| Database | PostgreSQL (Supabase) |
| ORM | Drizzle |
| Auth | Better-Auth (Twitch and Discord OAuth) |
| Queues | Supabase pgmq |
| Cron | Supabase pg_cron |
| Realtime | Supabase Realtime |
| Twitch | @twurple v8 (api, auth, eventsub-ws, chat) |
| Discord | discord.js v14 |
| Flow builder | @xyflow/react v12 |
| JS sandbox | quickjs-emscripten |
| AI | @google/genai (Gemini 3 Flash and Flash-Lite) |
| Weather | Apple WeatherKit |
| Docs | Fumadocs |
| Monorepo | Turborepo |
| Deploy | Dokploy on VPS |
| CI | GitHub Actions |
| Errors | Sentry |
| Logging | Pino |

## Development

### Prerequisites

- Bun 1.1.0 or later
- Node.js 20 or later (for tooling that still requires it)
- Docker (for `supabase start`)
- A Linux, macOS, or WSL2 shell

### Setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Configure environment variables:

   ```bash
   cp .env.example .env
   ```

3. Start the local Supabase stack:

   ```bash
   bun supabase:start
   ```

4. Apply migrations:

   ```bash
   bun db:migrate
   ```

5. Run all apps in dev mode:

   ```bash
   bun dev
   ```

### Development Scripts

- `bun dev` - Run all apps in dev mode via Turborepo.
- `bun dev:web` - Run only the web dashboard.
- `bun dev:server` - Run only the API server.
- `bun build` - Build every app and package.
- `bun check-types` - Type-check every workspace.
- `bun db:push` - Push the Drizzle schema to the database.
- `bun db:studio` - Open Drizzle Studio.
- `bun db:generate` - Generate a new Drizzle migration.
- `bun db:migrate` - Apply pending migrations.

### Code Quality

- TypeScript strict mode across the monorepo.
- Bun-only enforcement via `engine-strict` in `.npmrc` and an `only-allow` preinstall hook in `package.json`.
- Mobile-first Tailwind class ordering.
- Audit log is append-only at the database layer.
- Secrets are encrypted at rest with key-versioned AES-256-GCM.

## Project Structure

```
community-bot/
  apps/
    web/          TanStack Router dashboard (PWA)
    server/       Hono and tRPC API
    docs/         Fumadocs public docs site
  packages/
    api/          tRPC routers and procedures
    auth/         Better-Auth configuration
    config/       Shared tsconfig and tooling presets
    db/           Drizzle schema, migrations, seeds
    env/          Zod-validated environment loader
    ui/           shadcn/ui components and Tailwind theme
  docs/           Internal planning pack (numbered guides, ADRs, phase docs)
  supabase/       Local Supabase config
  .github/        CI workflows, issue templates, PR template, CODEOWNERS
  PLAN.md         Phase tracker with checkboxes
  README.md       This file
```

## License

![GitHub license](https://img.shields.io/github/license/mrdemonwolf/community-bot.svg?style=for-the-badge&logo=github)

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

- [Join my server](https://mrdwolf.net/discord)
- Website: https://www.mrdemonwolf.com
- GitHub: https://github.com/mrdemonwolf

Made with love by [MrDemonWolf, Inc.](https://www.mrdemonwolf.com)
