# @community-bot/api

Shared tRPC routers and role-gated procedures for the Community Bot web dashboard.

## Exports

- **`appRouter`** / **`AppRouter`** — The composed tRPC router containing all sub-routers (the public API surface)
- **Procedures** — `publicProcedure`, `protectedProcedure`, `moderatorProcedure`, `leadModProcedure`, `broadcasterProcedure`
- **Router factory** — `router` (re-export of `t.router`)

### Sub-routers (composed into `appRouter`)

`botChannel`, `chatCommand`, `user`, `regular`, `auditLog`, `discordGuild`, `setup`, `userManagement`, `queue`, `quote`, `counter`, `timer`, `spamFilter`, `songRequest`, `playlist`, `giveaway`, `poll`, `discordTemplates`, `discordScheduled`, `discordRoles`, `discordModeration`, `discordCustomCommands`, `keyword`, `configTester`, `chatAlert`, `channelPoints`, `automod`, `importExport`, `titleGenerator`

Context creation (`createContext`) lives in `src/context.ts` and is consumed by the web dashboard's tRPC handler, not re-exported from the package.

## Usage

```typescript
import { router, protectedProcedure } from "@community-bot/api";

export const myRouter = router({
  hello: protectedProcedure.query(() => "world"),
});
```

## Development

This package is part of the Community Bot monorepo. Run `bun dev` from the monorepo root to start all services.

## License

See the monorepo root [LICENSE](../../LICENSE) file.
