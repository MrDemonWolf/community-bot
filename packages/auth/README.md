# @community-bot/auth

Shared authentication configuration using [better-auth](https://www.better-auth.com/) with Drizzle adapter.

## Features

- Discord and Twitch OAuth social login
- Automatic account linking (Discord + Twitch to a single user)
- Auto-link Twitch from Discord connections on login
- Cookie-based sessions for Next.js server components
- Last login method tracking

## Usage

```typescript
import { auth } from "@community-bot/auth";
```

The `auth` object is consumed by the web dashboard's API routes and middleware.

## Development

This package is part of the Community Bot monorepo. Run `bun dev` from the monorepo root to start all services.

## License

See the monorepo root [LICENSE](../../LICENSE) file.
