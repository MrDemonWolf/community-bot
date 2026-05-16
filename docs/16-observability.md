# 16 — Observability

## What we log

- Structured JSON to stdout (Pino-based). Dokploy ingests.
- Every staff action → `audit_logs` row.
- Every command/timer fire → counted (not logged).
- Errors → Sentry (free tier — 5K events/mo is enough for one streamer).

## What we track in DB

- `events` (raw Twitch/Discord events, retention `eventsDays`)
- `actions` (outbox, deleted after success)
- `audit_logs` (append-only, retention `auditLogsDays`)
- `flow_traces` (Phase 5+, retention `flowTracesDays`)
- `imports` (one row per import run)

## Metrics endpoints

Each app exposes `/metrics` (Prometheus format) for internal scraping if Nathanial wants Grafana later. Phase 9+.

For now: dashboard `/dashboard` shows:

- Last 24h commands fired (counter)
- Last 24h Discord events
- Active flows
- Errors in last hour
- AI spend today / this month / vs cap

## Health checks

Each service exposes `GET /healthz` returning `{ ok, version, uptime, deps: { db, realtime } }`.

Dokploy uses these for restart-on-fail. Traefik uses these for routing decisions.

## Correlation IDs

Generated at the edge (`apps/server`). Propagated via:

- tRPC ctx
- pgmq job payload
- Audit log row
- Outbound logs

Single ID can trace a chat message → command lookup → reply → audit log.

## Sentry config

`packages/shared/src/sentry.ts` initializes per-app. Skip stack frames inside `node_modules`. Scrub PII via `beforeSend`.

## Sampling

In high-volume contexts (chat events), sample 1/10 to logs. Audit log is always 100%.

## Alerts (Phase 9)

Phase 9 wires Discord webhook for:

- Restart events
- Failed migrations
- 500-error spike
- AI budget at 80% / 100%
- Token refresh failures
- Backup failures
- Unauthorized auth attempts
