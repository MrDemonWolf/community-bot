# Community Bot — Web Dashboard

The Next.js web dashboard for Community Bot. Built with [Next.js](https://nextjs.org/), [tRPC](https://trpc.io/), [better-auth](https://www.better-auth.com/), and [shadcn/ui](https://ui.shadcn.com/). Provides a full management interface for the Twitch and Discord bots with Discord and Twitch OAuth login.

## Features

- **First-User Setup Wizard** — One-time `/setup/{token}` flow to designate the broadcaster
- **Bot Controls** — Enable/disable/mute the Twitch bot from the dashboard
- **Custom Commands** — Create, edit, delete, and toggle Twitch chat commands
- **Default Commands** — Toggle built-in commands and change access levels
- **Regulars** — Manage trusted users who bypass access level restrictions
- **Quotes** — Add, remove, and search cross-platform quotes
- **Counters** — Create and manage named counters
- **Timers** — Configure recurring chat messages with chat-line thresholds
- **Spam Filters** — Configure caps, links, symbols, emotes, repetition, and banned words
- **Song Requests** — Manage the song request queue and settings
- **Viewer Queue** — Open/close/pause the queue; pick, remove, and clear entries
- **Discord Settings** — Link a guild, set notification channel/role, configure welcome messages
- **User Management** — Role assignment and ban system (broadcaster only)
- **Audit Log** — Role-filtered feed of all dashboard mutations
- **Import/Export** — Import commands from Nightbot or community-bot JSON format
- **Public Pages** — `/p`, `/p/commands`, `/p/queue` for viewers

## Development

This app is part of the Community Bot monorepo. All commands should be run from the monorepo root.

### Setup

```bash
# From monorepo root
bun install
docker compose up -d postgres redis
bun db:push
bun dev
```

### Environment

Web dashboard environment variables are validated in two files:

- `packages/env/src/server.ts` — Server-side (auth, database, API keys)
- `packages/env/src/web.ts` — Client-side (`NEXT_PUBLIC_*` branding vars)

See `apps/web/.env.example` for the full list with inline comments.

### Project Structure

```
src/
  app/
    (auth)/                     # Login page and setup wizard
    (dashboard)/dashboard/      # Auth-gated dashboard routes
    (landing)/                  # Public landing page, terms, privacy
  components/                   # Shared UI components (shadcn/ui based)
  lib/                          # Utilities (setup, auth, trpc client)
  index.css                     # Tailwind CSS with brand color tokens
```

## License

See the monorepo root [LICENSE](../../LICENSE) file.
