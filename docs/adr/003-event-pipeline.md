# ADR-003: Event pipeline — raw → normalized → action → outbox

- Status: Accepted
- Date: Phase -1
- Authors: Nathanial (broadcaster)

## Context

Many Twitch + Discord events fire per stream. Each can spawn multiple side effects (chat, Discord, DB, audit, AI). Tangling event handling with side effects creates fragile code.

## Decision

Four-stage pipeline:

1. **Raw event** → written to `events` table immediately (immutable, retention `eventsDays`)
2. **Normalizer** → reads `events`, produces shape-agnostic `actions` outbox rows
3. **Action** → workers consume from `actions`, perform side effects
4. **Audit** → every action writes an `audit_logs` row

Workers are dumb. Each handles one action type. Add new effects by adding new action types + workers, no changes to upstream.

## Consequences

- Replayable: re-run normalizer on raw events to recompute actions
- Testable: each stage isolated
- Observable: every step queryable in DB

* More DB writes per event (~5x raw)
* Latency added: event → action is ~100ms p95
