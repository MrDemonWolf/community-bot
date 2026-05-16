# Phase 5A — Flow builder (declarative-only)

**Goal:** Visual drag-and-drop flow builder for triggers → conditions → actions. No custom code. Brain Cells redeem flows are the proving ground.

---

## Scope — IN

- [ ] `@xyflow/react` v12 integrated into dashboard at `/flows`
- [ ] Node catalog (rendered as sidebar with drag handles):
  - **Triggers:** `redeem.spent`, `chat.command`, `chat.cheer`, `subscription.new`, `subscription.gift`, `stream.online`, `stream.offline`, `manual` (debug)
  - **Conditions:** `if-balance >=`, `if-role-at-least`, `if-cooldown-elapsed`, `if-random-chance`, `if-stream-live`, `if-flag-set`
  - **Actions:** `say-chat`, `discord-message`, `discord-dm`, `set-twitch-marker`, `add-brain-cells`, `set-flag`, `clear-flag`, `wait <seconds>`, `webhook` (allowlisted domains only)
- [ ] Flow JSON schema (versioned)
- [ ] Server-side executor (deterministic, no JS injection)
- [ ] Per-flow audit on each execution (who triggered, which nodes ran, terminal state)
- [ ] Visual debugger: replay a previous run with node-by-node highlight
- [ ] Flow publish/unpublish (draft state vs live)
- [ ] Flow versioning (every save = new version; rollback supported)
- [ ] One template ships preinstalled: "Brain Cells redeem → say in chat → mark in mod-log"

## Scope — OUT (5B)

- ❌ Custom JS node (Phase 5B)
- ❌ Marketplace / sharing flows (post-MVP)
- ❌ Flow imports from other tools (post-MVP)

---

## Acceptance criteria

1. Drag trigger + 2 conditions + 2 actions onto canvas, connect, save → JSON persisted
2. Publish → real trigger fires real flow → action executes → audit log shows run
3. Rollback to previous version works
4. Unpublish → trigger no longer fires flow
5. Webhook action rejects non-allowlisted domain at save-time

## Test plan

- Snapshot tests on JSON schema
- Integration: trigger fires → executor runs → assertions on side effects
- E2E: build flow in UI, save, run trigger, assert

## Run plan

`bun dev` → visit `/flows`.

---

## Risks

- **Spaghetti flows** — UX hint: warn at > 25 nodes
- **Infinite loops** — executor enforces max 50 nodes per run + max wall-clock 30s

## Definition of Done

PR merged. Tag `v0.5.0-flows-declarative`.
