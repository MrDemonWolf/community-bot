# @community-bot/server

Shared Express API server factory for the Community Bot bots (Discord and Twitch).

## Exports

- **`createApiServer(options)`** — Creates a configured Express app with JSON parsing, CORS, Helmet security headers, Morgan logging, and a default `/api/status` endpoint.
- **`listenWithFallback(app, options)`** — Starts listening on the configured port. On `EADDRINUSE`, automatically retries with a random available port.
- **`skipHealthChecks`** — Morgan skip function that filters out health check requests from monitoring agents.

## Usage

```typescript
import { createApiServer, listenWithFallback } from "@community-bot/server";

const app = createApiServer({
  name: "MyBot",
  defaultPort: 3141,
  routes: (app) => {
    app.get("/health", (_req, res) => res.json({ status: "ok" }));
  },
});

await listenWithFallback(app, { port: 3141, host: "localhost", name: "MyBot" });
```

## License

See the monorepo root [LICENSE](../../LICENSE) file.
