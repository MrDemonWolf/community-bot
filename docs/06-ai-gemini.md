# 06 — AI addon (Gemini)

Phase 8. Optional. Toggleable. Rate-limited. Consent-aware. Cost-capped.

## SDK + models

- **SDK:** `@google/genai` (the unified GA SDK, May 2025). NOT the deprecated `@google/generative-ai`.
- **Primary:** `gemini-3-flash` — fast, cheap.
- **Classifier (guardrail + severity):** `gemini-3.1-flash-lite`.
- **Heavy weekly digest (optional, paid feature toggle):** `gemini-3-pro`.
- **Tier:** paid from day 1 (free tier may train on prompts).

## Architecture

```
packages/ai/
├── src/
│   ├── client.ts            # GoogleGenAI singleton
│   ├── queue.ts             # pgmq 'ai' queue + per-feature rate limit
│   ├── guardrail.ts         # post-gen safety filter (flash-lite)
│   ├── cost.ts              # per-call cost estimate + cumulative
│   ├── audit.ts             # writes audit_logs row for every call
│   ├── schemas.ts           # zod schemas for structured outputs
│   └── prompts/
│       ├── shoutout.ts
│       ├── title.ts
│       ├── recap.ts
│       ├── clip-title.ts
│       └── hype.ts
```

Imported by `apps/twitch` (shoutout / title / hype) and `apps/discord` (recap).

## Pipeline (every call)

```
Request → Consent check → pgmq enqueue (rate-limited) → Generate (structured output) → Guardrail check → Audit log → Deliver
```

1. Feature enabled? Check `settings.ai.<feature>.enabled`.
2. Targeted at a named viewer? → `userMeta.aiOptOut` respected.
3. Enqueue on `pgmq` queue `ai.<feature>` with `idempotencyKey`.
4. Worker calls Gemini with JSON schema enforced.
5. Output → guardrail (flash-lite). Returns `{ safe, categories, confidence }`. If unsafe → drop, log, do not post.
6. Write audit row: `{ feature, model, promptHash, outputHash, cost, durationMs }`.
7. Deliver: chat / Discord.

## Prompt templates

### Shoutout

```ts
export const SHOUTOUT_SYSTEM = `You write Twitch shoutouts in Nathanial's (MrDemonWolf's) voice.
Voice: warm, slightly chaotic, gaming-literate, inclusive. Never edgy. Never cringe.
Rules:
- 180 chars max per variant.
- Mention the target streamer's Twitch handle once, prefixed with @.
- Reference their most recent game/category if provided.
- If a clip title hints at a notable moment, nod to it — don't quote.
- No fake stats. No "GOAT/legend/king/queen" cliches. No hashtags. Max 1 emoji.
Output JSON only. Schema:
{ variants: [{ text: string, tone: "hype"|"chill"|"meme" }] }
with exactly 3 variants, one of each tone.`;
```

Inputs: `{ targetHandle, lastGame, lastTitle, recentClipTitles[], brandVoiceNotes }`. Temp `0.95`, maxTokens `400`.

### Stream title generator

```ts
export const TITLE_SYSTEM = `You generate Twitch stream titles for Nathanial.
Voice: playful, curious, a little unhinged in a fun way.
Rules:
- 95 char max. No "LIVE" / "!socials" / self-promo clutter.
- One emoji max (often zero is better).
- Skimmable at a glance in a game directory.
- No clickbait, no ALL CAPS, no clichés ("come chill", "grinding", "just vibing").
- Mix of a concrete vibe, a goal or hook, and the game.
Output JSON: { titles: string[] } with exactly 5.`;
```

Inputs: `{ theme, recentGames[], vibeKeywords[] }`.

### Recap

```ts
export const RECAP_SYSTEM = `You write a 4-7 sentence end-of-stream recap for Discord.
Voice: same as shoutouts.
Rules:
- Mention games played in order.
- Highlight 2-3 standout moments using mod-clipped titles or notable events.
- 1-2 emoji max.
- No raw viewer counts unless asked.
- Posted in #stream-archive Discord channel; assume audience is loyal sub-tier.
Output JSON: { recap: string, headline: string }`;
```

Inputs: `{ streamStart, streamEnd, gamesInOrder, modClipTitles[], topChatters: ['anon1','anon2'] }`.

### Clip title

Variant generator for mod tool when capturing a clip.

### Hype

Sub/cheer/gift hype line. Tier-aware.

## Per-feature toggles

`settings.ai`:

```ts
{
  enabled: false,                 // master switch
  budgetUsd: 25,                  // monthly cap
  labelOutputs: true,             // 🤖 prefix
  features: {
    shoutout: { enabled: false, rateLimit: { max: 5, per: '5m' } },
    title:    { enabled: false },
    recap:    { enabled: false, discordChannelId: '' },
    clipTitle:{ enabled: false },
    hype:     { enabled: false, rateLimit: { max: 10, per: '10m' } },
  },
  guardrail: { enabled: true, blockOnUnsafe: true },
}
```

All `false` by default. Broadcaster opts in feature-by-feature.

## Cost dashboard (`/dashboard/addons/ai`)

- Current month spend $ + chart vs cap
- Per-feature breakdown
- Test button per feature
- Toggle row
- Audit log of recent invocations

## Spend cap

Each call estimates cost from input/output tokens × per-model price. Cumulative spend stored in `settings.ai.spendUsdThisMonth`. If `spend + nextEstimate > budgetUsd` → skip + log + Discord DM to broadcaster.

## 12 AI feature ideas — Phase 8 cut

| # | Feature | Phase | Reason |
|---|---|---|---|
| 1 | End-of-stream auto recap | 8 | killer; cheap |
| 2 | Clip title suggester | 8 | mod tool; high value |
| 3 | Moderation severity scorer | NEVER | DPIA risk; killed |
| 4 | Chat vibe → category suggester | NEVER | killed |
| 5 | Personalised raid message | LATER | nice; not killer |
| 6 | Sub/cheer/gift hype | 8 | killer |
| 7 | On-demand chat translate | NEVER | killed |
| 8 | Weekly community digest | NEVER | killed |
| 9 | FAQ answerer | NEVER | killed |
| 10 | New-follower welcome personaliser | NEVER | killed (consent + spam risk) |
| 11 | Emote usage weekly insights | NEVER | killed |
| 12 | Content warning guardrail | 8 | not optional |

## Cost model

Rough back-of-envelope at light volume:

- Shoutout: ~$0.001 each. 1,000/mo = ~$1.
- Title gen: ~$0.001 each.
- Recap: ~$0.005 each. 30/mo = $0.15.
- Hype: ~$0.001 each. 1,000/mo = ~$1.
- Guardrail: ~$0.0001 each. Negligible.

Expected total monthly bill at active-channel volume: **~$3-5**. Cap at $25.
