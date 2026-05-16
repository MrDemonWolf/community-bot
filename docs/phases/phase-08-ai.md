# Phase 8 — AI features (Gemini)

**Goal:** Six AI-augmented features. Per-feature toggle. Cost cap $25/mo. EU AI Act labeling everywhere AI output reaches viewers.

---

## Scope — IN

### Six features

- [ ] **Smart shoutout** — broadcaster types `!so @user` → bot fetches user's last stream category/title + last clip → Gemini generates a 1-2 sentence shoutout matching MrDemonWolf's voice → posts in chat with `[AI]` prefix
- [ ] **Title suggester** — dashboard button: "Suggest stream title" → uses last 5 stream titles + currently set category → Gemini drafts 3 options → broadcaster picks
- [ ] **Stream recap** — on stream offline → Gemini summarizes chat highlights (filtered to mod-approved messages) + clip titles → posts to Discord as recap embed
- [ ] **Clip titler** — on clip created → Gemini suggests title → broadcaster confirms in dashboard
- [ ] **Hype train co-pilot** — during Twitch hype train → Gemini suggests rallying messages to bot → bot posts on broadcaster's manual approval (NOT auto-post)
- [ ] **Guardrail** — every AI output passes a safety check via Gemini's safety settings + custom prompt-injection-resistance prompt before display

### Infra

- [ ] `@google/genai` SDK
- [ ] Gemini 3 Flash for high-quality outputs (shoutout, title, recap)
- [ ] Gemini 3 Flash-Lite for fast safety checks (guardrail)
- [ ] Cost tracker: every API call logs prompt + completion token counts + cost estimate
- [ ] Monthly cost cap: $25/mo (configurable); when 80% hit → warning email; at cap → AI features auto-disable
- [ ] Per-feature toggle in dashboard
- [ ] Prompt templates in `packages/ai/src/prompts/` with version control
- [ ] EU AI Act labeling: every AI-generated output that reaches viewer eyes is prefixed `[AI]` or labeled in embed

## Scope — OUT

- ❌ AI moderation (explicitly won't do)
- ❌ Auto-DM AI (privacy + spam risk)
- ❌ Voice cloning / TTS (post-MVP, separate phase if ever)

---

## Acceptance criteria

1. `!so @target` posts a shoutout with `[AI]` prefix; Gemini cost logged
2. Title suggester returns 3 options in < 5s
3. Stream recap posts to Discord after stream offline
4. Clip title appears in dashboard for broadcaster approval
5. Hype train messages NEVER auto-post (require approval)
6. Cost cap auto-disables features when reached
7. Prompt injection attempts in user-supplied content (target username, clip title) are caught by guardrail
8. Output respects label requirement (no AI output reaches viewers without `[AI]`)

## Test plan

- Unit: prompt template render
- Integration: full pipeline with mocked Gemini
- Evals: golden-output regression suite (10 representative prompts per feature)
- Cost test: simulate 1000 calls, assert cost tracker accuracy

## Run plan

Phase 8 features disabled by default. Broadcaster enables per-feature.

---

## Risks

- **Prompt injection via Twitch username** — usernames are user-controlled; sanitize aggressively
- **Hallucinations** — guardrail catches some; broadcaster approval gates risky ones (hype train); shoutout has lowest stakes
- **Cost runaway** — cap is hard at $25/mo

## Definition of Done

PR merged. Tag `v0.8.0-ai-features`. DPIA reviewed (see `docs/05-gdpr.md`).
