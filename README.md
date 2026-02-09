# my-better-t-app

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Next.js, Self, TRPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Reusable UI components
- **tRPC** - End-to-end type-safe APIs
- **Prisma** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

## Database Setup

This project uses PostgreSQL with Prisma.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/web/.env` file with your PostgreSQL connection details.

3. Apply the schema to your database:

```bash
pnpm run db:push
```

Then, run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the fullstack application.

## Prisma Schema — Source of Truth

This monorepo owns the Prisma schema. All model/enum definitions live in `packages/db/prisma/schema/` as split domain files:

| File | Contents |
|------|----------|
| `schema.prisma` | Generator + datasource config |
| `auth.prisma` | User, Session, Account, Verification, TwoFactor (web app) |
| `discord.prisma` | DiscordGuild |
| `twitch.prisma` | TwitchChannel, TwitchNotification, TwitchCredential, TwitchChatCommand, TwitchRegular, enums |
| `queue.prisma` | QueueEntry, QueueState, QueueStatus |

**Do NOT edit `prisma/schema.prisma` in the consumer projects directly.** Edit the `.prisma` files here, then sync to each consumer:

```bash
# In ../community-bot-discord:
pnpm prisma:sync && pnpm prisma:generate

# In ../community-bot-twitch:
pnpm prisma:sync && pnpm db:generate
```

Consumer projects have a `scripts/sync-prisma.sh` that pulls the `.prisma` files listed in their `SCHEMA_FILES` array, combines them with their local generator config, and writes a single `prisma/schema.prisma`.

### Adding a New Domain File

1. Create e.g. `packages/db/prisma/schema/moderation.prisma` with your models
2. In each consumer project that needs it, add `"moderation.prisma"` to the `SCHEMA_FILES` array in `scripts/sync-prisma.sh`
3. Run `pnpm prisma:sync` in those projects

### Migrations

Migrations are owned by `community-bot-discord` (it has the migration history). After schema changes:

```bash
# In ../community-bot-discord:
pnpm prisma:sync && pnpm prisma:generate && pnpm prisma:migrate
```

## Project Structure

```
my-better-t-app/
├── apps/
│   └── web/         # Fullstack application (Next.js)
├── packages/
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries (SOURCE OF TRUTH)
```

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm run build`: Build all applications
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run db:push`: Push schema changes to database
- `pnpm run db:generate`: Generate database client/types
- `pnpm run db:migrate`: Run database migrations
- `pnpm run db:studio`: Open database studio UI
