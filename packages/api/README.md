# @community-bot/api

Shared tRPC routers and role-gated procedures for the Community Bot web dashboard.

## Exports

- **Procedures** — `publicProcedure`, `protectedProcedure`, `moderatorProcedure`, `leadModProcedure`, `broadcasterProcedure`
- **Router factory** — `router` (re-export of `t.router`)
- **Context** — `createContext` for binding auth sessions to tRPC calls
- **Routers** — `botChannel`, `chatCommand`, `discordGuild`, `user`, `auditLog`, `setup`, `regular`, `quote`, `counter`, `timer`, `spamFilter`, `queue`, `poll`, `songRequest`, `importExport`, `userManagement`

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
