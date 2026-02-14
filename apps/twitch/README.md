# Community Bot for MrDemonWolf, Inc. - Twitch

A custom Twitch chat bot powering the MrDemonWolf community. Features database-driven commands with cooldowns, access levels, and stream-aware triggers — plus a viewer queue system, regex auto-responses, rich variable substitution, and full in-chat command management.

[![License](https://img.shields.io/github/license/MrDemonWolf/community-bot-twitch.svg?style=for-the-badge&logo=github)](LICENSE)

## Features

- **8 built-in commands** — ping, uptime, account age, bot mute, queue, filesay, command management, and reload
- **Database-driven commands** — Create, edit, and delete commands from chat or Prisma Studio without restarting
- **Viewer queue system** — Open/close/pause queue with join, leave, pick (next/random/by name), and position tracking
- **Access control** — 6-tier hierarchy from Everyone to Broadcaster with automatic cooldown bypass for mods
- **Variable substitution** — `{user}`, `{channel}`, `{args}`, positional args with fallbacks, `${random.pick}`, `${random.chatter}`, `${time}`
- **Stream-aware triggers** — Commands can be restricted to online/offline and filtered by stream title keywords
- **Regex auto-responses** — Trigger commands on pattern matches instead of `!prefix`
- **Auto token management** — Validates, refreshes, and persists Twitch OAuth tokens automatically
- **Device Code Flow** — First-run authentication with no manual token setup required
- **REST API** — Express v5 server with a `/status` health-check endpoint

## Usage

### Built-in Commands

| Command | Aliases | Access | Description |
|---------|---------|--------|-------------|
| `!ping` | — | Everyone | Replies with Pong! |
| `!uptime` | — | Everyone | Stream uptime or offline duration |
| `!accountage` | `!accage`, `!created` | Everyone | Twitch account creation date |
| `!bot` | — | Broadcaster | Mute/unmute the bot |
| `!queue` | — | Everyone / Mod+ | Viewer queue system |
| `!filesay` | — | Broadcaster | Send lines from a URL to chat |
| `!command` | — | Mod+ | Manage database commands from chat |
| `!reloadcommands` | — | Mod+ | Reload commands and regulars from DB |

For detailed usage, subcommands, and examples, see **[COMMANDS.md](COMMANDS.md)**.

### Database Commands

Create unlimited custom commands stored in PostgreSQL — manage them from chat with `!command add/edit/remove/show/options` or via Prisma Studio (`pnpm db:studio`).

For the full database command system docs (fields, variables, access levels, regex, cooldowns, stream filtering), see **[docs/DATABASE_COMMANDS.md](docs/DATABASE_COMMANDS.md)**.

### Authentication

The bot manages Twitch OAuth tokens automatically:

1. **Stored credentials** — Validates on startup, auto-refreshes if expired
2. **Device Code Flow** — If no stored credentials, starts interactive authorization (prints a link to your terminal)

Tokens are persisted in the `TwitchCredential` table and refreshed automatically. The device code flow only triggers again if both tokens are completely dead.

> **Tip:** To re-authenticate (e.g., switch bot accounts), delete the credentials from the `TwitchCredential` table and restart.

### API

The bot runs an Express API server (default: `http://localhost:3737`).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Returns bot health status: `offline`, `connecting`, or `online` |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) v22 or later
- [pnpm](https://pnpm.io/) package manager
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) (for PostgreSQL and Redis)
- A [Twitch Developer Application](https://dev.twitch.tv/console/apps)

### Setup

#### 1. Clone and install

```bash
git clone https://github.com/mrdemonwolf/community-bot-twitch.git
cd community-bot-twitch
pnpm install
```

#### 2. Start infrastructure

```bash
docker compose up -d
```

This starts **PostgreSQL 16** on port `5432` and **Redis 7.2** on port `6379`.

#### 3. Create a Twitch Application

1. Go to the [Twitch Developer Console](https://dev.twitch.tv/console/apps)
2. Click **Register Your Application**
3. Fill in:
   - **Name**: Whatever you want to call your bot
   - **OAuth Redirect URLs**: `https://id.twitch.tv/oauth2/device`
   - **Category**: Chat Bot
4. Copy the **Client ID** and generate a **Client Secret**

#### 4. Configure environment

Create a `.env` file in the project root:

```env
# Database (matches docker-compose defaults)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/community-bot"

# Twitch Application
TWITCH_APPLICATION_CLIENT_ID=your-client-id-here
TWITCH_APPLICATION_CLIENT_SECRET=your-client-secret-here

# Streamer channel to join
TWITCH_CHANNEL=mrdemonwolf

# Optional
# HOST=localhost
# PORT=3737
```

#### 5. Push schema and start

```bash
pnpm db:push
pnpm dev
```

On first run, the bot starts the **Twitch Device Code Flow** — it prints a link to your terminal, you authorize in your browser, and the bot saves the tokens automatically.

### Development Scripts

```bash
pnpm dev             # Development with hot reload
pnpm build           # Build for production
pnpm start           # Run production build
pnpm lint            # Lint the codebase
pnpm test            # Run tests

pnpm db:generate     # Regenerate Prisma Client
pnpm db:push         # Push schema to database
pnpm db:migrate      # Run Prisma migrations
pnpm db:studio       # Open Prisma Studio GUI
pnpm db:import       # Import commands from prisma/commands.json
```

### Prisma Schema Sync

**Do NOT edit `prisma/schema.prisma` directly.** The source of truth is the monorepo at `../community-bot/packages/db/prisma/schema/`.

```bash
pnpm prisma:sync     # Pull models from monorepo
pnpm db:generate     # Regenerate the Prisma client
```

### Code Quality

| Tool | Command | Description |
|------|---------|-------------|
| ESLint | `pnpm lint` | Lints and auto-fixes JavaScript/TypeScript |
| Prettier | `pnpm format` | Formats code with Prettier via ESLint |
| TypeScript | `pnpm build` | Strict mode type checking during build |
| Zod | Runtime | Environment variable validation at startup |

### Project Structure

```
src/
  app.ts                    # Entry point
  api/                      # Express server
    routes/status.ts        # GET /status
  commands/                 # Built-in command handlers
    index.ts                # Command registry
    ping.ts                 # !ping
    uptime.ts               # !uptime
    accountage.ts           # !accountage
    bot.ts                  # !bot mute/unmute
    queue.ts                # !queue
    filesay.ts              # !filesay
    command.ts              # !command management
    reloadCommands.ts       # !reloadcommands
  database/
    index.ts                # Prisma client singleton (pg adapter)
  events/                   # Twitch event handlers
    connected.ts            # Auth, connect, disconnect
    message.ts              # 3-phase command pipeline
    join.ts                 # User joins + chatter tracking
    part.ts                 # User parts + chatter tracking
  services/                 # Business logic
    commandCache.ts         # In-memory command index
    accessControl.ts        # Access levels + regulars
    cooldownManager.ts      # Cooldown tracking
    commandExecutor.ts      # Variable substitution + dispatch
    streamStatusManager.ts  # Stream polling
    queueManager.ts         # Queue operations
    helixClient.ts          # Helix API wrapper
    botState.ts             # Mute state
    chatterTracker.ts       # Active chatter tracking
  scripts/
    importCommands.ts       # JSON command importer
  twitch/                   # Auth + chat setup
    auth.ts                 # RefreshingAuthProvider
    chat.ts                 # ChatClient factory
    deviceAuth.ts           # Device Code Flow
  types/
    command.ts              # TwitchCommand interface
  utils/
    env.ts                  # Zod-validated env vars
    commandLogger.ts        # Logging helpers
prisma/
  schema.prisma             # Database schema
  commands.json             # Legacy command seed data
prisma.config.ts            # Prisma v7 datasource config
docs/
  DATABASE_COMMANDS.md      # Full database command system docs
```

## License

[![GitHub license](https://img.shields.io/github/license/MrDemonWolf/community-bot-twitch.svg?style=for-the-badge&logo=github)](LICENSE)

## Contact

If you have any questions, suggestions, or feedback, feel free to reach out!

- Discord: [Join our server](https://mrdwolf.net/discord)

Made with love by [MrDemonWolf, Inc.](https://www.mrdemonwolf.com)
