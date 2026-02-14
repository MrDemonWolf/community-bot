# Community Bot for MrDemonWolf, Inc. - Discord

A custom Discord bot powering the MrDemonWolf community. Features Twitch live stream notifications with rich embeds that update in real-time, slash commands for managing monitored channels, background job scheduling, and automatic guild sync. Built with TypeScript, [discord.js](https://discord.js.org/) v14, Express, BullMQ, and Prisma v7 (PostgreSQL).

## Features

- **Twitch Live Notifications**: Automatically sends rich embeds when monitored Twitch channels go live, updates them with viewer counts while streaming, and edits to an offline state when the stream ends.
- **Slash Commands**: Full `/twitch` command suite for adding/removing monitored channels, configuring notification channels and roles, and testing notifications.
- **Background Job Scheduling**: BullMQ-powered repeating jobs for stream polling (every 90s) and rotating bot activity status.
- **Automatic Guild Sync**: Tracks joined/left servers in the database, prunes stale guilds on startup.
- **REST API**: Express health/status endpoints with Helmet, CORS, and Morgan middleware.

## Usage

Here's a quick guide to the available slash commands:

- `/twitch add <username>` - Start monitoring a Twitch channel for live streams.
- `/twitch remove <username>` - Stop monitoring a Twitch channel.
- `/twitch list` - View all monitored channels with live/offline status and current config.
- `/twitch test <username>` - Send a test notification that auto-edits to offline after 10s (owner only).
- `/twitch notifications set-channel #channel` - Set the channel for stream notifications.
- `/twitch notifications set-role @role` - Set the role to mention when a stream goes live.

All `/twitch` commands require **Manage Server** permission except `/twitch test` which is restricted to the bot owner.

## Development

### Prerequisites

- Node.js 22.x
- pnpm
- PostgreSQL database
- Redis server

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/MrDemonWolf/community-bot-discord.git
   cd community-bot-discord
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start infrastructure (PostgreSQL and Redis):

   ```bash
   docker compose up -d postgres redis
   ```

4. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

5. Configure your environment variables in `.env`:

   - `DATABASE_URL` - PostgreSQL connection string
   - `REDIS_URL` - Redis connection string
   - `DISCORD_APPLICATION_ID` - From the [Discord Developer Portal](https://discord.com/developers/applications)
   - `DISCORD_APPLICATION_PUBLIC_KEY` - From the Discord Developer Portal
   - `DISCORD_APPLICATION_BOT_TOKEN` - From the Discord Developer Portal (Bot tab)
   - `OWNER_ID` - Your Discord user ID
   - `MAIN_GUILD_ID` - Your primary server ID
   - `MAIN_CHANNEL_ID` - Your primary channel ID
   - `TWITCH_CLIENT_ID` - From the [Twitch Developer Console](https://dev.twitch.tv/console/apps)

6. Generate Prisma client:

   ```bash
   pnpm prisma:generate
   ```

7. Run database migrations:

   ```bash
   pnpm prisma:migrate
   ```

8. Start the bot:

   ```bash
   pnpm dev
   ```

### Development Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Clean build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint with auto-fix
- `pnpm format` - Prettier + ESLint formatting
- `pnpm test` - Run Mocha tests
- `pnpm prisma:studio` - Open Prisma Studio to view/edit database

### Prisma Schema Sync

**Do NOT edit `prisma/schema.prisma` directly.** The source of truth for all Prisma models is the monorepo at `../community-bot/packages/db/prisma/schema/`.

To sync after schema changes in the monorepo:

```bash
pnpm prisma:sync        # Pull models from monorepo
pnpm prisma:generate    # Regenerate the Prisma client
```

Migrations are owned by this project. After schema changes:

```bash
pnpm prisma:sync && pnpm prisma:generate && pnpm prisma:migrate
```

### Code Quality

This project uses:

- **ESLint** with TypeScript support for code linting
- **TypeScript** in strict mode for type safety
- **Prisma** for database management
- **Consola** for structured, namespaced logging
- **Zod** for environment variable validation

### Project Structure

```
src/
  app.ts                          # Entry point — starts Discord, BullMQ, Prisma, Express
  commands/
    index.ts                      # Slash command registry (Map<string, Command>)
    twitch/
      index.ts                    # /twitch command definition + subcommand router
      add.ts                      # /twitch add — monitor a Twitch channel
      remove.ts                   # /twitch remove — stop monitoring
      list.ts                     # /twitch list — show monitored channels + config
      test.ts                     # /twitch test — send fake notification (owner only)
      notifications-set-channel.ts  # /twitch notifications set-channel
      notifications-set-role.ts     # /twitch notifications set-role
  twitch/
    api.ts                        # Twitch Helix API wrapper (users, streams)
    embeds.ts                     # Live/offline Discord embed builders
    index.ts                      # Barrel export
  events/
    ready.ts                      # Guild sync, slash command registration
    interactionCreate.ts          # Slash command routing
    guildCreate.ts                # Track new guild joins
    guildDelete.ts                # Track guild leaves
  worker/
    index.ts                      # BullMQ worker — routes jobs by name
    jobs/
      setActivity.ts              # Rotating bot activity status (cron)
      checkTwitchStreams.ts        # Twitch stream polling (every 90s)
  api/
    index.ts                      # Express server setup
    routes/
      status.ts                   # GET /status endpoint
  database/
    index.ts                      # Prisma client singleton
  utils/
    env.ts                        # Zod-validated environment variables
    logger.ts                     # Namespaced consola logger
    guildDatabase.ts              # Guild sync helpers
    setActivity.ts                # Activity type/status helpers
    cronParser.ts                 # Cron expression utilities
```

## License

![GitHub license](https://img.shields.io/github/license/MrDemonWolf/community-bot-discord.svg?style=for-the-badge&logo=github)

## Contact

If you have any questions, suggestions, or feedback, feel free to reach out!

- Discord: [Join my server](https://mrdwolf.net/discord)

Made with love by <a href="https://www.mrdemonwolf.com">MrDemonWolf, Inc.</a>
