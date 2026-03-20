# @community-bot/env

Zod-validated environment variable configs for each Community Bot service. Uses [@t3-oss/env-core](https://env.t3.gg/) for type-safe env access with fail-fast validation at startup.

## Exports

| Import Path | Service | Description |
|-------------|---------|-------------|
| `@community-bot/env/server` | Web dashboard (server) | Auth, database, API keys |
| `@community-bot/env/web` | Web dashboard (client) | `NEXT_PUBLIC_*` branding vars |
| `@community-bot/env/discord` | Discord bot | Bot token, guild IDs, activity |
| `@community-bot/env/twitch` | Twitch bot | Twitch API, AI, WeatherKit |

## Usage

```typescript
import { env } from "@community-bot/env/twitch";

console.log(env.TWITCH_APPLICATION_CLIENT_ID);
```

Invalid or missing required variables cause a descriptive error at startup.

## License

See the monorepo root [LICENSE](../../LICENSE) file.
