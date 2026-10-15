# WolfAide

A small bot for one creator, with a calm dashboard for Discord and Twitch.
Built on Better-T-Stack: Next.js, TypeScript, tRPC, Better Auth, Drizzle,
PostgreSQL, Bun, and Turborepo.

Discord and Twitch run as separate workers. Configure credentials, Discord
presence, Twitch accounts, and join/leave/mute controls through the dashboard.
An optional public channel page shows commands and connection status.
Saved credentials are encrypted and never returned to the UI.

The mobile dashboard is installable as a PWA. Private pages and API responses
stay online-only; an offline page explains how to reconnect. Twitch Channel
Points support managed rewards, chat responses, and a fulfill/refund queue.
Staff access comes from creator-configured Twitch and Discord role mappings,
with separate platform permissions. VIP and subscriber perks grant no admin access.

## Start here

**Get the dashboard open first. Connect one service afterward.**

| Your goal | Start here |
| --- | --- |
| Try it or develop on your Mac | Local setup below; detailed [local guide](apps/docs/src/app/local/page.tsx) |
| Keep the bot online on Dokploy | [Dokploy guide](apps/docs/src/app/dokploy/page.tsx) |
| Connect an existing Discord bot | [Discord guide](apps/docs/src/app/discord/page.tsx) |
| Connect creator and Twitch bot accounts | [Twitch guide](apps/docs/src/app/twitch/page.tsx) |
| Configure staff, features, rewards, or phone installation | [Feature guide](apps/docs/src/app/features/page.tsx) |
| Run browser checks or configure delivery | [CI/CD guide](docs/ci.md) |

The guides include numbered steps, copy buttons, expected results, and short
troubleshooting tables.

**First checkout only:** clone the repository and enter its folder. Skip this
if you already cloned it; open a terminal in that existing repository instead.

```sh
git clone https://github.com/MrDemonWolf/community-bot.git
cd community-bot
```

View the documentation website locally from the repository root:

```sh
bun install --frozen-lockfile
bun run dev:docs
```

Open [localhost:3004](http://localhost:3004). Docs need no database or secrets.

## Local setup

### 1. Prepare private settings

You need Bun 1.4.3 and a current Docker Compose with Watch support. For a fresh Colima session on macOS,
start it with mount events enabled, or open Docker Desktop instead.
Run these commands from the repository root. Copy the example only
when you do not already have a `.env`.

```sh
colima start --mount-inotify
cp .env.example .env
openssl rand -hex 32
openssl rand -hex 32
openssl rand -base64 32
```

Edit the untracked `.env`:

- First hex result → `POSTGRES_PASSWORD` and the password inside `DATABASE_URL`.
- Second hex result → `BETTER_AUTH_SECRET`.
- Base64 result → `APP_ENCRYPTION_KEY`.
- Set `OWNER_EMAIL` to your email.
- Keep `BETTER_AUTH_URL=http://localhost:3001` and `NODE_ENV=development`.
- Set `DEV_LOGIN=true`. Google credentials can remain empty.

The native database URL is
`postgresql://community_bot:YOUR_PASSWORD@localhost:5435/community_bot`.
Use the same generated hex password in both database settings.

**Ready when:** all three secrets are filled in. Keep `.env` out of Git.

### 2. Run everything in Docker

```sh
docker compose -f compose.yaml -f compose.dev.yaml up --build -d
docker compose -f compose.yaml -f compose.dev.yaml logs --tail=50 web discord twitch
```

Keep worker reload running in a second terminal at the repository root:

```sh
docker compose -f compose.yaml -f compose.dev.yaml watch --no-up discord twitch
```

Leave that terminal open while editing. Compose runs the file watcher on your
Mac, synchronizes worker source changes, and restarts the affected worker.
Stopping this watcher does not stop the running containers.

Open [localhost:3001](http://localhost:3001) and choose **Enter development
workspace**. The first build can take several minutes. The stack creates its
database tables before starting the apps.

Web source stays bind-mounted and Webpack polls for changes. Worker source uses
Compose Watch instead of guest filesystem events, so it does not depend on
Colima forwarding inotify notifications. Rebuild after dependency or configuration
changes. If Compose rejects the watch configuration, update Docker Compose.

**Ready when:** the login page opens and development login reaches setup.

### Alternative: run apps natively

Never run a native worker alongside its Docker counterpart. When switching
from the full Docker path, press Control-C in the Watch terminal first, then
stop the app containers:

```sh
docker compose -f compose.yaml -f compose.dev.yaml stop web discord twitch
```

Choose this instead of running the web and bot containers. Start just
PostgreSQL and the migration job:

```sh
bun install --frozen-lockfile
docker compose -f compose.yaml -f compose.dev.yaml up --build -d postgres migrate
```

Then run one command per terminal tab:

```sh
bun run dev:web
```

```sh
bun run dev:discord
```

```sh
bun run dev:twitch
```

These scripts load the root `.env`. If you already have a reachable empty
PostgreSQL database, supply its `DATABASE_URL` and run `bun run db:migrate`
instead of starting PostgreSQL through Compose.

### Check source reload

Edit a visible label in `apps/web/src/app/login/login.tsx`, save it, then refresh
the login page. **Ready when:** the changed label appears.

For a Docker worker edit, save a source file and check the Watch terminal reports
a sync and restart, then confirm a fresh heartbeat on the dashboard.

If an edit does not reload, restart the affected app. For native development,
press Control-C in its terminal and rerun its `bun run dev:web`,
`bun run dev:discord`, or `bun run dev:twitch` command. For Docker workers, first
confirm the Watch terminal is still running and has synchronized the changed
file. For Docker web, restart only web if needed:

```sh
docker compose -f compose.yaml -f compose.dev.yaml restart web
```

Restarting alone cannot copy unsynchronized worker source. Without Watch,
rebuild the affected worker with `docker compose -f compose.yaml -f compose.dev.yaml up --build -d discord`
(use `twitch` for that worker). Colima mount forwarding is experimental and can
miss file removals; Webpack polling and Compose Watch avoid relying on it.
See the official [Compose Watch guide](https://docs.docker.com/compose/how-tos/file-watch/),
[Colima mount-inotify setting](https://colima.run/docs/configuration/#mount-inotify)
and [Lima mount-event limits](https://lima-vm.io/docs/config/mount/#mount-inotify).

### 3. Connect one service

1. Give the workspace a name. Choose whether to enable the public command page.
2. Follow Discord **or** Twitch setup. The other service can stay paused.
3. Save the credentials and choose **Join** on the dashboard.
4. Wait for a fresh **connected** heartbeat.
5. Check Discord presence, or send `!uptime` in Twitch chat.

Saved credentials are configuration. A fresh worker heartbeat confirms a real
connection. Discord Leave disconnects without removing the bot from the server.
Twitch Mute keeps listening and suppresses replies.

To stop Docker safely while preserving the database, press Control-C in the
Watch terminal first, then run:

```sh
docker compose -f compose.yaml -f compose.dev.yaml down
```

Do not add `-v` unless you intend to delete the database.

## Dokploy setup

Use the numbered [Dokploy guide](apps/docs/src/app/dokploy/page.tsx).
The production stack uses only `compose.yaml`, with separate PostgreSQL,
migration, web, Discord, and Twitch services. Only web gets a public HTTPS
domain on port 3001. Run one replica per worker.

Production requires Google OAuth credentials and a verified `OWNER_EMAIL`.
Development login is disabled in production.

- Google redirect: `https://YOUR-DASHBOARD/api/auth/callback/google`
- Twitch redirect: `https://YOUR-DASHBOARD/api/twitch/callback`

The documentation workflow is prepared for GitHub Pages. Select GitHub Actions
as the Pages source before publishing. Repository configuration does not prove
a live deployment.

## Commands

| Command | Result |
| --- | --- |
| `!uptime`, `!botuptime` | Twitch worker process uptime |
| `!serveruptime` | OS-reported host uptime; containers may report their host |
| `!streamuptime` | Current live stream duration, or offline |
| `!commands` | Available commands |

The dashboard controls the prefix. Replies have a channel-wide cooldown.
Joining through EventSub does not promise viewer-list presence or a bot badge.

## Project layout

```text
apps/web       Private dashboard, onboarding, public /channel page
apps/discord   Discord Gateway connection and presence worker
apps/twitch    Twitch EventSub and Helix worker
apps/docs      Public static documentation website
packages/api   Validated tRPC procedures with platform capability checks
packages/auth  Google sessions and guarded local login
packages/core  Shared feature catalog, commands, permissions, and validators
packages/twitch Shared server-side creator authorization
packages/db    Schema, migrations, encrypted credentials, runtime heartbeats
packages/ui    Shared Tailwind styles
```

## Development checks

```sh
bun run check-types
bun run test
bun run build
```

CI also runs fresh PostgreSQL migrations, constraint and permission checks,
redemption concurrency tests, and real Chromium journeys inside Docker.
See [the test commands and manual Dokploy deployment workflow](docs/ci.md).
Live Google/Twitch/Discord authorization still requires your own credentials.

## Backups and existing deployments

Start this rewrite with an empty PostgreSQL database. Its initial migration
does not upgrade the former Supabase schema. Preserve the old database and plan
a migration separately.

Back up the database and preserve its `APP_ENCRYPTION_KEY` separately in a
password manager. A lost or replaced key makes stored credentials
unrecoverable. Keep the database volume during updates.

Platform references: [Discord Gateway](https://docs.discord.com/developers/events/gateway),
[Twitch chat](https://dev.twitch.tv/docs/chat/),
[Twurple](https://twurple.js.org/),
[Dokploy Compose domains](https://docs.dokploy.com/docs/core/docker-compose/domains).
