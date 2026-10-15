# community-bot - Discord and Twitch for One Creator

Community Bot is a dashboard and bot service for a single streamer or
creator. It keeps Discord, Twitch, staff permissions, and Channel Point
rewards together while running the two platform workers separately.
The project is named `community-bot`. WolfAide refers to the connected bot
accounts, not the project name.

Keep the setup small and your community connected.

## Features

- **Separate workers:** Run Discord, Twitch, and the dashboard independently.
- **Discord presence:** Configure your existing bot's status and activity.
- **Shared commands:** Use the same uptime commands in Twitch chat and
  Discord slash commands.
- **Channel Points:** Create managed rewards, configure chat responses,
  and fulfill or refund redemptions.
- **Platform-scoped staff:** Map existing Twitch and Discord roles to the
  tools each person needs. VIP and subscriber roles grant no admin access.
- **Private dashboard:** Use Google login, encrypted integration
  credentials, and an optional public channel page.
- **Mobile PWA:** Install the dashboard on your home screen. Private pages
  and API responses stay online-only.
- **Staff profiles:** Choose your linked Twitch or Discord picture, or upload
  and crop a personal picture. Compressed images stay below 1 MB per person.
- **Guided setup:** Start with one connection and add the other later.

## Getting Started

Full guides: [local development](apps/docs/src/app/local/page.tsx),
[Dokploy deployment](apps/docs/src/app/dokploy/page.tsx),
[Discord](apps/docs/src/app/discord/page.tsx),
[Twitch](apps/docs/src/app/twitch/page.tsx), and
[staff, features, rewards, and PWA](apps/docs/src/app/features/page.tsx).

1. Clone the repository and enter its folder. Skip this if already cloned.

   ```bash
   git clone https://github.com/MrDemonWolf/community-bot.git
   cd community-bot
   ```

2. Create your private settings file. Keep an existing `.env` instead of
   overwriting it. Generate three separate values.

   ```bash
   cp .env.example .env
   openssl rand -hex 32
   openssl rand -hex 32
   openssl rand -base64 32
   ```

3. Edit `.env`. Put the first hex value in `POSTGRES_PASSWORD` and the
   password inside `DATABASE_URL`. Put the second in `BETTER_AUTH_SECRET`
   and the base64 value in `APP_ENCRYPTION_KEY`. Set `OWNER_EMAIL` to your
   email and `DEV_LOGIN=true`. Keep the local defaults
   `NODE_ENV=development` and `BETTER_AUTH_URL=http://localhost:3001`.
   Google credentials can stay empty for local development.

4. Start your Docker engine. For a fresh Colima session on macOS:

   ```bash
   colima start --mount-inotify
   ```

   Then start the stack and keep worker source synchronization running:

   ```bash
   docker compose -f compose.yaml -f compose.dev.yaml up --build -d
   docker compose -f compose.yaml -f compose.dev.yaml watch --no-up discord twitch
   ```

   Leave the Watch terminal open. Webpack polls web source changes;
   Compose synchronizes and restarts the workers after source edits.
   Rebuild after dependency or configuration changes.

5. Open [localhost:3001](http://localhost:3001), choose
   **Enter development workspace**, and follow setup. Connect Discord or
   Twitch, choose **Join**, and wait for a fresh connected heartbeat.

Use a new database for this rewrite. Its initial migration does not upgrade
the former Supabase schema. Preserve existing data until you have a
migration plan. Back up the database and keep both `APP_ENCRYPTION_KEY`
and `BETTER_AUTH_SECRET` securely; encrypted credentials depend on their
original keys.

Production uses `compose.yaml` without the development override.
It requires an HTTPS dashboard domain, Google OAuth credentials, and a
verified `OWNER_EMAIL`. Development login never enables production access.
Follow the Dokploy guide for the exact environment and callback URLs.

## Usage

### Chat commands

The Twitch prefix is configurable. Discord uses guild-scoped slash
commands. The uptime feature switch is independent for each platform.

| Twitch | Discord | Result |
| --- | --- | --- |
| `!uptime`, `!botuptime` | `/uptime`, `/botuptime` | Bot process uptime |
| `!serveruptime` | `/serveruptime` | OS-reported host uptime; containers may share their host |
| `!streamuptime` | `/streamuptime` | Current stream duration, or offline |
| `!commands` | `/commands` | Available commands |

Replies have a cooldown. Twitch joining uses EventSub and does not promise
viewer-list presence or a bot badge.

### Dashboard tools

| Page | Use |
| --- | --- |
| `/dashboard` | Check heartbeats and control permitted connections |
| `/dashboard/settings` | Configure workspace, integrations, and permitted Discord presence |
| `/setup` | Creator onboarding and platform configuration |
| `/access` | Link your own accounts, copy account IDs, and view grants |
| `/dashboard/access` | Creator-only staff mappings and role checks |
| `/dashboard/features` | Configure built-in features by platform |
| `/dashboard/rewards` | Authorize, configure, and manage Channel Points |
| `/channel` | Public commands and creator information, when enabled |

**Join** starts a connection; **Leave** pauses it without removing accounts.
**Mute replies** keeps Twitch listening while suppressing chat replies.
Saved settings describe the requested state. Fresh worker heartbeats
confirm the actual connection.

Channel Points require an eligible Twitch Affiliate or Partner creator
and explicit creator authorization. Only rewards created by this
application can be edited or fulfilled through it.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Foundation | Better-T-Stack monorepo |
| Dashboard and docs | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4 and shared UI styles |
| API and data fetching | tRPC 11 and TanStack Query |
| Authentication | Better Auth 1.6.11 and Google OAuth |
| Database | PostgreSQL 17 and Drizzle ORM |
| Discord | discord.js 14.27.0 |
| Twitch | Twurple 8.2.0, EventSub WebSockets, and Helix |
| Tooling | Bun 1.4.3, Turborepo, and Playwright |
| Deployment | Docker Compose, Dokploy, and GitHub Actions |

## Development

### Prerequisites

- Git and Bun 1.4.3.
- Node.js 22 to match the dashboard container runtime.
- A current Docker Compose with Watch support and a running Docker engine.
- PostgreSQL, provided by Compose or reachable through `DATABASE_URL`.

### Setup

1. Install the workspace dependencies.

   ```bash
   bun install --frozen-lockfile
   ```

2. Use the root `.env` from Getting Started. For native apps, the local
   Compose database URL uses port `5435`:

   ```text
   postgresql://community_bot:YOUR_PASSWORD@localhost:5435/community_bot
   ```

3. If switching from Docker apps to native apps, press Control-C in the
   Watch terminal first. Stop the app containers, then start only the
   database and migration job.

   ```bash
   docker compose -f compose.yaml -f compose.dev.yaml stop web discord twitch
   docker compose -f compose.yaml -f compose.dev.yaml up --build -d postgres migrate
   ```

   For an existing reachable empty database, run `bun run db:migrate`
   instead of starting these database containers.

4. Start each app in a separate terminal tab.

   ```bash
   bun run dev:web
   ```

   ```bash
   bun run dev:discord
   ```

   ```bash
   bun run dev:twitch
   ```

   The scripts load the root `.env`. Do not run native and Docker
   counterparts together.

5. Open the public documentation locally when needed.

   ```bash
   bun run dev:docs
   ```

   Docs run at [localhost:3004](http://localhost:3004) without database
   credentials. See the local guide for reload checks and troubleshooting.

### Development Scripts

- `bun run dev`: Start workspace development processes.
- `bun run dev:web`: Start the dashboard on port 3001.
- `bun run dev:discord`: Start the Discord worker with native source watch.
- `bun run dev:twitch`: Start the Twitch worker with native source watch.
- `bun run dev:docs`: Start the documentation on port 3004.
- `bun run build`: Build all applications for production.
- `bun run check-types`: Run workspace TypeScript checks.
- `bun run test`: Run unit tests and OAuth-state checks.
- `bun run db:generate`: Generate Drizzle migrations.
- `bun run db:migrate`: Apply committed migrations.
- `bun run db:push`: Apply schema changes directly during development.
- `bun run db:studio`: Open Drizzle Studio.

Workspace scripts can also run directly, for example
`bun run --cwd apps/web build`:

| Workspace | Scripts |
| --- | --- |
| `apps/web` | `dev`, `build`, `start`, `check-types` |
| `apps/discord` | `dev`, `build`, `start`, `check-types`, `test` |
| `apps/twitch` | `dev`, `build`, `start`, `check-types`, `test` |
| `apps/docs` | `dev`, `build`, `check-types` |

### Code Quality

- TypeScript checks and focused Bun tests cover shared behavior.
- PostgreSQL integration checks exercise permissions and durable claims.
- Playwright journeys test desktop, mobile, and production login guards.
- CI builds real Docker images with disposable credentials.
- [CI/CD documentation](docs/ci.md) covers test commands, artifacts, and
  manually approved Dokploy deployments.

Local checks do not prove live OAuth, bot connectivity, physical PWA
installation, or a successful production rollout. Verify those with the
configured accounts and target environment.

## Project Structure

```text
apps/
  web/          # Dashboard, onboarding, public page, and PWA
  discord/      # Discord Gateway, presence, and slash command adapter
  twitch/       # Twitch EventSub, Helix, and redemption adapter
  docs/         # Public documentation website
packages/
  api/          # Validated operations and platform permission checks
  auth/         # Google sessions and guarded local login
  core/         # Shared features, commands, permissions, and validators
  twitch/       # Server-side Twitch creator authorization
  db/           # PostgreSQL schema, migrations, and encrypted credentials
  env/          # Environment validation
  ui/           # Shared Tailwind styles
  config/       # Shared TypeScript configuration
docs/           # Architecture, design, staff permissions, and CI/CD
tests/          # Integration and browser journeys
compose.yaml    # Production services
compose.dev.yaml # Local development override
Dockerfile      # Separate build targets for each service
```

## License

[![GitHub license](https://img.shields.io/github/license/MrDemonWolf/community-bot.svg?style=for-the-badge&logo=github)](LICENSE)

Licensed under the [MIT License](LICENSE), copyright 2026 MrDemonWolf, Inc.

## Contact

- Discord: [Join my server](https://mrdwolf.net/discord)
- GitHub: [Issues](https://github.com/MrDemonWolf/community-bot/issues)
- Website: [MrDemonWolf](https://www.mrdemonwolf.com)

Made with love by [MrDemonWolf, Inc.](https://www.mrdemonwolf.com)
