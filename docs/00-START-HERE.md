# 🐺 community-bot — Start Here

> One page. Read first. Skim, don't study. When you're lost mid-phase, come back here.

## What this project is

A **self-hosted** Twitch + Discord community bot for ONE streamer (Nathanial / `mrdemonwolf`) and his mod team. Replaces Fossabot + StreamElements + Nightbot with one stack he fully owns. Not multi-tenant. Not a SaaS.

## TL;DR (30 seconds)

- **Stack:** better-t-stack scaffold → Bun + TanStack Router + Hono + tRPC + Better-Auth + Drizzle + Supabase + Turborepo + Fumadocs + PWA
- **Bots:** `apps/twitch` (@twurple v8 + EventSub WS) and `apps/discord` (discord.js v14)
- **Visual flow builder:** `@xyflow/react` v12 + `quickjs-emscripten` for sandboxed JS
- **AI addon (optional):** Gemini 3 Flash via `@google/genai`
- **Deploy:** Dokploy (Docker Swarm + Traefik) on a VPS

## The 10 commandments

1. Bun only. No npm/yarn/pnpm.
2. TypeScript strict. No `any`.
3. shadcn/ui + Tailwind only. Mobile-first.
4. Brand colors: navy `#091533`, cyan `#0FACED`.
5. Read the relevant phase file before writing any code.
6. PR per ticket. No one-shot mega-commits.
7. Audit log every staff action. Append-only.
8. Encrypt at-rest secrets in Postgres. Never in env vars after Phase -1.
9. GDPR boundaries from day one. Even pre-launch.
10. When in doubt: do the boring secure thing.

## The phases (in order)

| #   | Phase                              | What ships                                            | Doc                                     |
| --- | ---------------------------------- | ----------------------------------------------------- | --------------------------------------- |
| -1  | **Foundation**                     | ADRs, CI, secrets, RBAC, audit log, backups           | `phases/phase--1-foundation.md`         |
| 0   | **Setup wizard**                   | First-run flow → broadcaster locks in                 | `phases/phase-00-setup-wizard.md`       |
| 1   | **Discord MVP**                    | `apps/discord` + public `/commands` page              | `phases/phase-01-discord-mvp.md`        |
| 2   | **Twitch MVP**                     | `apps/twitch` + commands/timers + 12 MVP commands     | `phases/phase-02-twitch-mvp.md`         |
| 3   | **Moderation & quotes & counters** | Filters, quotes, counters, plugin scaffold            | `phases/phase-03-moderation.md`         |
| 4   | **Loyalty (Brain Cells)**          | Currency, leaderboard, ledger                         | `phases/phase-04-loyalty.md`            |
| 5A  | **Flow builder — declarative**     | Visual graph editor with safe nodes only              | `phases/phase-05a-flows-declarative.md` |
| 5B  | **Flow builder — JS sandbox**      | QuickJS sandbox for custom JS nodes                   | `phases/phase-05b-flows-sandbox.md`     |
| 6   | **Role sync + Discord activity**   | Twitch sub → Discord role, activity rotation, The Den | `phases/phase-06-role-sync.md`          |
| 7   | **Import wizard**                  | SE + Nightbot + Fossabot importers                    | `phases/phase-07-import.md`             |
| 8   | **AI (Gemini)**                    | Shoutout / title gen / recap / hype + guardrail       | `phases/phase-08-ai.md`                 |
| 9   | **GDPR + release polish**          | `!forgetme`, `!mydata`, retention, sub-processors     | `phases/phase-09-gdpr-release.md`       |
| 10+ | **Roadmap**                        | Song requests, giveaways, raid AI, etc.               | `phases/phase-10-plus-roadmap.md`       |

## How to work each phase

1. Open `PLAN.md` → mark the phase 🟡 In progress with date + branch
2. Open the phase markdown → read scope-IN, scope-OUT, acceptance criteria
3. Start a fresh Claude Code session per phase. Paste the phase prompt.
4. Implement on a `phase-X/<short-slug>` branch off `develop`
5. PR per ticket; squash-merge to `develop`; promote to `main` after acceptance
6. Update `PLAN.md` checklist when phase is 🟢 Done
7. Close the corresponding Jira tickets

## Brand identity

- **Codename:** HowlBot (the project's nickname in docs and decisions)
- **Repo/product:** `community-bot` (canonical name)
- **Display name in UI:** "community-bot" — configurable; can be set to "HowlBot" via settings
- **Mascot:** wolf 🐺 — used sparingly, never spammy

## Where things live

```
community-bot/
├── apps/
│   ├── web/       Dashboard (TanStack Router + Tailwind + shadcn/ui)
│   ├── server/    Hono + tRPC API
│   ├── docs/      Fumadocs site (public docs, GitHub Pages)
│   ├── twitch/    Twitch bot worker (Phase 2)
│   └── discord/   Discord bot worker (Phase 1)
├── packages/
│   ├── db/        Drizzle schemas (Phase -1)
│   ├── shared/    Zod schemas, template engine, types
│   ├── jobs/      pgmq wrappers, worker base
│   ├── flow-engine/ (Phase 5A)
│   ├── sandbox/   (Phase 5B)
│   ├── ai/        (Phase 8)
│   └── plugins/   Plugin host (Phase 3+)
├── docs/          THIS PACK — read first every session
├── docker/        Compose files for Dokploy
└── PLAN.md        Live progress tracker
```

## Read this next

- `01-architecture.md` — how all the pieces fit
- `09-dokploy-guide.md` — when you're ready to deploy
- `phases/phase--1-foundation.md` — the first session after scaffolding
