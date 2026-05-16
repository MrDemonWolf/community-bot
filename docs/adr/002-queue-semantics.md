# ADR-002: Queue semantics

- Status: Accepted
- Date: Phase -1
- Authors: Nathanial (broadcaster)

## Context

We need a job queue for: Twitch token refresh, role sync, timer fires, imports, AI calls, retention purges.

Options:

1. BullMQ on Redis (proven, fast)
2. pgmq on Supabase Postgres (one less service)
3. Cloudflare Queues (vendor lock-in)
4. Hand-rolled SKIP LOCKED on Postgres

## Decision

pgmq. One service to run. ACID semantics for free. Native Postgres → no separate persistence to back up.

Workers in Bun apps poll their queues with `read_with_poll` (long-polling).

## Consequences

+ Operational simplicity: one DB to back up
+ Atomic enqueue with the row that triggered it (transactional outbox)
+ No Redis to operate
- Higher latency vs Redis (~50ms p95 vs ~1ms) — fine for our use case
- Throughput limited by Postgres connection pool (~100s/sec) — fine for one streamer
- Lock contention possible if many workers poll the same queue (mitigated by visibility timeout)

## At-least-once semantics

Every job has `idempotencyKey`. Worker SELECT FOR UPDATE on `processed_keys` table before executing. Replays no-op.

Retry policy per queue, defined in `packages/jobs/queues.ts`. Failed jobs after max retries → DLQ (per-queue dead-letter pgmq queue named `<queue>__dlq`).
