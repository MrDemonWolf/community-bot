# WolfAide Discord runtime

`apps/discord` is a standalone Gateway service. It uses the current monorepo but does not need the dashboard, PostgreSQL, Redis, Twitch, or the historical worker. The recovery service connects the existing bot and reports readiness. It does not register commands, send messages, change roles, or run moderation jobs. Sapphire continues to handle the community's existing moderation and reporting tools.

## Configuration

Set these runtime variables through Dokploy's private environment editor. Never put a token in Git, a build argument, screenshots, logs, or a command line.

| Variable | Purpose |
| --- | --- |
| `DISCORD_APPLICATION_BOT_TOKEN` | The target application's raw bot token; required. The MCP bridge's `DISCORD_TOKEN` is deliberately not used. |
| `DISCORD_APPLICATION_ID` | Required expected application/bot ID. WolfAide production is `1459804884466405501`. |
| `DISCORD_GUILD_ID` | Required target guild. Production is `127607669103001600`. |
| `PORT` | Internal HTTP port; defaults to `3003`. |

The process verifies the token's identity and guild membership using read-only Discord REST requests before opening the Gateway connection. It requests only the nonprivileged `Guilds` intent. No Administrator, message-content, member-list, or presence permission is required for this recovery service.

The dashboard's optional Discord token remains separately encrypted in its settings database with `APP_ENCRYPTION_KEY`. A stored credential means **Configured**, not online. This standalone service reads its explicit environment token; saving a dashboard credential does not update the running service. Keeping these separate avoids deploying an unverified database rewrite to restore a Gateway connection. A future dashboard integration must deliberately reconcile the two configuration paths.

## Build and startup

The repository pins Bun `1.3.14`; the Dockerfile uses the same runtime version. From the repository root:

```sh
bun install --frozen-lockfile --ignore-scripts
bun run --cwd apps/discord check-types
bun run --cwd apps/discord build
docker build -f apps/discord/Dockerfile -t wolfaide-discord:local .
```

The container's startup command is `bun run dist/index.mjs`. Building or typechecking does not log in to Discord. Do not run the worker with production credentials until the target deployment is approved.

For an explicitly configured local bot, `bun run dev:discord` runs directly through Bun so Turbo's strict environment filtering does not remove its credentials. The default `bun run dev` excludes Discord; use a separate staging identity when developing.

## Dokploy service

Use one application in the existing production project/environment, with a clear display name such as **WolfAide Discord** and description **Production Gateway for WolfAide in MrDemonWolf; standalone recovery service, no command registration or automated moderation.** Choose the repository root as build context and `apps/discord/Dockerfile` as the Dockerfile. Use an approved commit SHA for a repeatable deployment.

- Keep **one replica**. Stop the old instance before starting its replacement; use stop-first updates and do not run another service with the same bot token.
- Keep the health port internal. No public domain, reverse proxy, published host port, volume, or database is needed.
- Start with a `0.25` CPU reservation, `0.5` CPU limit, and `256 MiB` memory limit. These are initial budgets, not measured production usage; review actual memory and restart behavior after deployment.
- Allow outbound HTTPS/WebSocket access to Discord. The client library handles Gateway reconnect/resume; readiness drops during a disconnect.
- Give shutdown at least `15` seconds. SIGTERM/SIGINT marks the service unready, closes HTTP and the Gateway, and has a ten-second exit deadline.
- The image healthcheck polls `/readyz`, with a 90-second startup allowance. An unhealthy Docker status alone is not a promise that a plain Docker container will restart; verify Dokploy's actual restart/replacement policy.

A future staging service must use a **different Discord application/token and test guild**. Name it **WolfAide Discord (Staging)** in the staging environment and describe it as a test Gateway. Do not reuse production credentials or mistake the existing FluffBoost staging service for WolfAide staging.

## Readiness and deployment evidence

| Endpoint | Meaning |
| --- | --- |
| `GET /healthz` | HTTP process is alive. This does not prove a Discord connection. |
| `GET /readyz` | `200` only when the verified bot identity, Gateway-ready state, and available target guild all agree. Otherwise `503` with a state such as `starting`, `connecting`, or `guild_unavailable`. |

Health responses contain public application/guild IDs and state only. Logs contain event names and numeric error codes, without Discord response bodies or raw error objects.

After an approved deployment, record the commit/image, target service/environment, redacted startup log events, internal `/readyz` response, and independent Discord online/member readback. Verify reconnect and graceful shutdown using the target service only, without touching Twitch, Sapphire, the MCP bridge, or other applications. This recovery phase does not exercise messages, slash commands, bans, reports, or appeals; response behavior needs a separately scoped command implementation and harmless runtime check.

For rollback, restore the previous approved image/commit and its matching private environment. Do not revert the repository rewrite or run the historical startup module: it registers commands, changes database records, starts scheduled jobs, and attempts migrations.

No database migration is part of this service. Current source has a singleton settings schema and no tracked Drizzle migration history; inspect the actual schema and prepare a reviewed migration before deploying broader dashboard changes against an existing database.
