# Phase 4 — Brain Cells loyalty system

**Goal:** Viewers earn points (called "Brain Cells") for watching, chatting, subbing, cheering. Broadcaster can run redeems against them via flow builder (Phase 5) or simple `!redeem <name>`.

**Name origin:** Wolf-themed pun. "Brain Cells" the currency. Going to make the redeem prompts hilarious.

---

## Scope — IN

### Earning

- [ ] Watchtime tracker (Twitch helix `streams` + IRC chat presence; reconcile every 60s)
- [ ] `brainCellsLedger` table: append-only, every grant/spend is a row
- [ ] Per-second earn rate while watching live (configurable, default 1 per 60s)
- [ ] Chat-active bonus: viewer must have chatted in last 5 min to earn watchtime
- [ ] Sub bonus: tier 1 = 500, tier 2 = 1000, tier 3 = 2500 (configurable)
- [ ] Resub bonus same as initial sub
- [ ] Gift sub bonus to gifter: 250 per gift (configurable)
- [ ] Cheer bonus: 1 per bit (configurable rate)
- [ ] Raid bonus to raiders (Phase 8+, deferred)

### Commands (all in "Later" set seeded disabled — broadcaster enables when ready)

- [ ] `!points` / `!brain` — viewer's own balance
- [ ] `!top` — top 10 brain cell holders
- [ ] `!addpoints <user> <n>` — broadcaster only
- [ ] `!removepoints <user> <n>` — broadcaster only
- [ ] `!givepoints <user> <n>` — viewer-to-viewer transfer (toggleable, default off)

### Redeems (Phase 4 ships engine; flow builder Phase 5 builds on this)

- [ ] `redeems` table: name, cost, cooldown, enabled, requiresOnline, flowId (nullable — if null, just deducts and writes audit)
- [ ] `!redeem <name>` — viewer — runs the redeem if they have enough
- [ ] Cooldown enforcement
- [ ] Deduct-then-execute: if execution fails, refund

### Anti-abuse

- [ ] Lurker detection: stop crediting if viewer has had no chat activity for 2 hours
- [ ] Multi-account: heuristic flag for same IP-bucket via Helix (best-effort, document limits)
- [ ] Negative balance: hard-prevented at ledger insert (CHECK constraint)

## Scope — OUT

- ❌ Flow builder (Phase 5A/5B)
- ❌ Channel point integration (Twitch native CP — Phase 6+ optional)
- ❌ Leaderboard widget for OBS (Phase 6+)
- ❌ Brain Cell economy balancing tools / spend rate analytics (Phase 8+)

---

## Acceptance criteria

1. Watching live stream → balance increases on cadence
2. Stopping chat for 5+ min → earn stops; resuming chat → earn resumes
3. Subbing during stream → bonus grants in audit + ledger
4. `!points` returns viewer's current balance
5. `!top` shows top 10, excluding broadcaster
6. Negative balance attempt → rejected at DB layer (proves CHECK constraint)
7. Redeem without sufficient balance → rejected with clear message
8. Redeem cooldown enforced per-user

---

## Test plan

- Unit: ledger insert with various transaction types
- Integration: simulate 1-hour stream with N viewers, assert balance math
- Property test: balance == sum(grants) - sum(spends), never negative

## Run plan

Phase 4 doesn't ship new chat commands enabled (they're in the disabled Later set). Earning is silent in the background. Dashboard shows ledger.

---

## Risks

- **Watchtime accuracy** — Twitch `streams` is sometimes stale; reconcile via chat presence + EventSub `channel.viewers` (if available)
- **Sub event double-firing** — EventSub vs IRC USERNOTICE can both fire; dedupe via `(platform, eventId)` unique index
- **Whale accumulation** — a single sub since launch could have millions of Brain Cells; document spec, don't cap unless economy breaks

---

## Definition of Done

PR merged. Tag `v0.4.0-brain-cells`.
