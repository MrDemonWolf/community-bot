# Phase 0 — Setup wizard

**Goal:** First-run experience for the broadcaster. Land on dashboard, see a wizard, finish it, end up with a fully configured bot (minus actual bot code which comes Phase 1/2).

**Why now:** Forces us to nail down every config decision upfront. Wizard surfaces "what does the bot need to know about you?" in one place.

---

## Scope — IN

- [ ] `/setup` route, guarded so only the broadcaster can hit it
- [ ] First-time detection: if `setupComplete = false` on `appConfig` table, all dashboard routes redirect to `/setup`
- [ ] Step 1 — Welcome + name your bot (display name only; service name is locked to `community-bot`)
- [ ] Step 2 — Connect Twitch as broadcaster (OAuth, scopes from `docs/08-twitch-bot.md`)
- [ ] Step 3 — Connect Twitch as bot account (OAuth, choose: same account or separate bot account)
- [ ] Step 4 — Connect Discord (OAuth + bot invite link with computed permissions)
- [ ] Step 5 — Choose Discord server (only servers where broadcaster has Manage Server)
- [ ] Step 6 — Map Discord roles to community-bot roles (broadcaster auto-assigned; user picks which Discord roles map to mod/vip/sub/viewer)
- [ ] Step 7 — Configure stream alerts (which Discord channel? embed style? @everyone toggle?)
- [ ] Step 8 — Configure bot mode in chat (single-account mode or separate account)
- [ ] Step 9 — Review + confirm; flip `setupComplete = true`; redirect to dashboard
- [ ] Wizard state persisted server-side (resumable; survives browser refresh)
- [ ] Audit log entries for every setup step completion

## Scope — OUT

- ❌ Adding mods / editors (Phase 6)
- ❌ Configuring commands (Phase 2 ships defaults; tuning happens via dashboard later)
- ❌ Configuring timers (same as commands)
- ❌ Brain Cells loyalty config (Phase 4)
- ❌ AI features (Phase 8)
- ❌ Import from StreamElements (Phase 7)

---

## Acceptance criteria

1. Fresh DB → log in → see /setup
2. Refresh mid-wizard → resume from same step
3. Twitch broadcaster account stored with refresh token (encrypted)
4. Twitch bot account stored separately
5. Discord guild ID, channel ID for alerts, and role mappings all in `appConfig`
6. After completion, hitting `/setup` redirects to dashboard
7. Audit log shows 8+ entries (one per step)

---

## Test plan

```bash
bun test apps/web/src/routes/setup/*.test.tsx
bun test:e2e setup-wizard.spec.ts
```

E2E covers: fresh DB → wizard → completion → audit log assertions.

## Run plan

```bash
bun dev
# Visit http://localhost:3000
# Twitch OAuth requires tunnel: cloudflared tunnel run community-bot-dev
```

---

## Risks

- **Twitch dual-OAuth on same browser** — Twitch single-sign-on means second login may auto-pick same account. Wizard must explicitly say "log out of Twitch first, or open incognito"
- **Discord bot invite scope creep** — request only what we need at THIS phase (Manage Roles, Send Messages, Read Message History, Use Slash Commands)

---

## Definition of Done

Setup wizard ships behind `/setup`. PR merged to develop after green CI. PLAN.md updated.
