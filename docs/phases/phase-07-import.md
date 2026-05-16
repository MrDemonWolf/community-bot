# Phase 7 — Import wizard (StreamElements, Nightbot, Fossabot)

**Goal:** Broadcaster uploads a JSON export from their old bot, our import wizard maps variables and creates equivalent commands/timers in community-bot.

---

## Scope — IN

- [ ] `/setup/import` route (accessible after main wizard)
- [ ] Tabs for each supported source: StreamElements, Nightbot, Fossabot
- [ ] File upload (drag-drop) + format validation
- [ ] Parse to common intermediate representation (IR)
- [ ] Variable compatibility matrix (see `docs/04-import-wizard.md`)
- [ ] Dry-run preview: show every command/timer that will be created, what gets transformed, what gets flagged (unsupported variable like `${lasttweet}`)
- [ ] User picks per-row: import / skip / edit
- [ ] Idempotency: re-running on same file with same hash skips already-imported rows
- [ ] Audit log: every import action

## Scope — OUT

- ❌ Mod actions / regex filters import (post-MVP)
- ❌ Loyalty data migration (Brain Cells is fresh; do not migrate StreamElements points)
- ❌ Quote DB import (Quotes are in Later set; deferred)

---

## Acceptance criteria

1. Upload SE commands.json → see preview with all transformed commands
2. `${lasttweet}` flagged as UNSUPPORTED with "remove or skip"
3. Skip unsupported, import rest → commands appear in DB with original metadata
4. Re-upload same file → all rows show "already imported" with hash match

## Test plan

- Fixtures in `docs/fixtures/streamelements/`
- Snapshot tests on IR transformation
- E2E: upload → preview → confirm → assert DB state

## Run plan

Same.

---

## Risks

- **Variable drift** — keep the compat matrix updated as SE adds new vars
- **Large files** — cap at 10MB; stream parse if needed

## Definition of Done

PR merged. Tag `v0.7.0-import-wizard`.
