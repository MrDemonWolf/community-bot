# 19 — Decisions (ADR index)

Architecture Decision Records. One file per decision in `docs/adr/`.

## Index

| # | Title | Status | Date |
|---|---|---|---|
| 001 | Auth boundary — Better-Auth owns identity | Accepted | Phase -1 |
| 002 | Queue semantics — pgmq, at-least-once | Accepted | Phase -1 |
| 003 | Event pipeline — raw → normalized → action → outbox | Accepted | Phase -1 |
| 004 | Secret management — encrypted columns + key versioning | Accepted | Phase -1 |
| 005 | Flow execution — declarative first, sandbox second | Accepted | Phase 5 |
| 006 | Audit log — append-only via DB trigger | Accepted | Phase -1 |
| 007 | GDPR — streamer is data controller | Accepted | Phase 9 |
| 008 | Roles — six-role hierarchy with one-broadcaster invariant | Accepted | Phase 0 |
| 009 | Bun-only with `only-allow` enforcement | Accepted | Phase -1 |
| 010 | No Redis/BullMQ — Supabase-only architecture | Accepted | Phase -1 |
| 011 | Dokploy as deploy target (no Kubernetes) | Accepted | Phase -1 |
| 012 | discord.js v14 + @twurple v8 (locked majors) | Accepted | Phase 1 |
| 013 | Single-streamer scope (NOT SaaS, NOT multi-tenant) | Accepted | Pre-Phase -1 |
| 014 | "The Den" — sub-only page at `/den` | Accepted | Phase 6 |
| 015 | WeatherKit for `!weather` (vs OpenWeather etc.) | Accepted | Phase 2 |
| 016 | No X/Twitter API integration ever | Accepted | Pre-Phase -1 |
| 017 | AI: Gemini only (vs OpenAI/Anthropic) | Accepted | Phase 8 |
| 018 | AI Act labeling: outputs prefixed with 🤖 | Accepted | Phase 8 |
| 019 | Five-feature AI MVP cut (recap + clip titles + hype + shoutout + title gen + guardrail) | Accepted | Phase 8 |
| 020 | Title/Game SET commands deferred to Later | Accepted | Pre-Phase -1 |

Each ADR file has the standard format:

```markdown
# ADR-NNN: <Title>

- Status: <Proposed / Accepted / Deprecated / Superseded by ADR-XXX>
- Date: <YYYY-MM-DD>
- Authors: Nathanial (broadcaster)

## Context
What's the situation, what's the pressure, what alternatives exist?

## Decision
The chosen path, in one paragraph.

## Consequences
Positive, negative, and what becomes easier vs harder.
```

Phase -1 creates ADRs 001-013. Other ADRs created as their phase is implemented.
