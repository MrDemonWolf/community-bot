# UI/UX Review: HowlBot onboarding/setup wizard

**Reviewed:** 2026-06-22 · **Input:** Local code (`apps/web/src/app/setup/setup-wizard.tsx`, `apps/web/src/index.css`) + live render (`localhost:3001/setup`) · **Method:** NN/g heuristic evaluation + measured contrast + WCAG checks

## Executive summary

- Strong, cohesive dark-glass wizard with genuinely good system-status feedback and a clear 6-step model. No catastrophic (Sev 4) issues.
- Worst problem (now fixed): muted caption color `#5d6a8c` failed WCAG AA contrast (3.25:1 on the card surface) across hints, captions, add-on descriptions, and inactive stepper labels.
- Second (now fixed): interactive controls had no visible keyboard-focus indicator.
- Most findings were accessibility, not usability — the flow itself follows NN/g wizard guidance well.

**Findings:** 🟥 0 catastrophic · 🟧 2 major · 🟨 4 minor · ⬜ 1 cosmetic — **6 of 7 fixed in this pass.**

## Findings

### 🟧 Severity 3 — Major

#### 1. Caption/hint text below WCAG AA contrast — ✅ FIXED
- **What:** `--hb-subtle` was `#5d6a8c` → measured **3.25:1** on surface `#0c1838`, **2.98:1** on `#0c1f4a`, **3.58:1** on bg `#070d22`. Normal-size text needs ≥ 4.5:1. Used for field hints, add-on descriptions, the timezone summary, and inactive stepper labels (all information-bearing).
- **Where:** `Field` hints, `Addon` desc, stepper labels, `index.css` `--hb-subtle`.
- **Guideline:** WCAG 2.1 SC 1.4.3 Contrast (Minimum) — normal text ≥ 4.5:1.
- **Evidence:** [WCAG 1.4.3](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) — text and images of text must have a contrast ratio of at least 4.5:1.
- **Fix:**
  - [x] Changed `--hb-subtle` to `#828fb0` (measured 5.41:1 on surface, 4.96:1 on `#0c1f4a`, 5.97:1 on bg).

#### 2. No visible keyboard-focus indicator — ✅ FIXED
- **What:** The `Btn` component and the stepper `<button>`s rendered no `:focus-visible` style, so keyboard users could not see which control was focused.
- **Where:** `Btn` base classes; stepper button.
- **Guideline:** WCAG 2.1 SC 2.4.7 Focus Visible.
- **Evidence:** [WCAG 2.4.7](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html) — the keyboard focus indicator must be visible.
- **Fix:**
  - [x] Added `focus-visible:ring-2 ring-[var(--hb-accent)]/70` (+ offset) to `Btn` and the stepper buttons; added `aria-current="step"` and `aria-label` to stepper steps.

### 🟨 Severity 2 — Minor

#### 3. Steps 1–5 had no `h1` — ✅ FIXED
- **What:** Only the Welcome step exposed an `h1`; steps 1–5 led with `h2` and no page-level `h1`, weakening screen-reader document structure.
- **Guideline:** WCAG 1.3.1 Info & Relationships; NN/g heading hierarchy.
- **Evidence:** [WCAG 1.3.1](https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html).
- **Fix:** [x] Each step's primary heading is now an `h1`.

#### 4. Decorative checkmarks announced by screen readers — ✅ FIXED
- **What:** `✓` glyphs (welcome bullets, done icon) are decorative but were in the a11y tree.
- **Guideline:** WCAG 1.1.1 Non-text Content (decorative content should be hidden).
- **Fix:** [x] Added `aria-hidden` to decorative `✓` elements.

#### 5. Global header stays in the tab order behind the wizard — ⚠️ NOT FIXED
- **What:** The wizard renders as `fixed inset-0 z-50`, visually covering the app `Header` (Home / Dashboard / Sign In), but those links remain in the DOM and keyboard tab order beneath it.
- **Where:** `apps/web/src/app/layout.tsx` renders `<Header />` on every route.
- **Guideline:** NN/g — match between system and the real world / no hidden interactive traps; WCAG 2.4.3 Focus Order.
- **Evidence:** [Visibility of System Status](https://www.nngroup.com/articles/visibility-system-status/) — users should always understand what is interactive and where they are.
- **Fix:**
  - [ ] Move `<Header />` out of the root layout into a dashboard-only layout/route group so `/setup` and `/login` render without it (recommended), **or** hide it on those routes.

#### 6. Timezone is a long unsearchable native `<select>` — ⚠️ NOT FIXED
- **What:** ~400 IANA zones in a native select; slow to find one by scrolling.
- **Guideline:** NN/g wizard/form input efficiency.
- **Evidence:** [Wizards: Definition and Design Recommendations](https://www.nngroup.com/articles/wizards/) — minimize the effort of each step.
- **Fix:**
  - [ ] Default to the browser-detected zone (already prefilled) and/or swap to a typeahead combobox later.

### ⬜ Severity 1 — Cosmetic

#### 7. Step transition animation ignored reduced-motion — ✅ FIXED
- **What:** The per-step fade ran unconditionally.
- **Guideline:** WCAG 2.3.3 Animation from Interactions.
- **Fix:** [x] Moved to `.hb-step` and disabled it under `@media (prefers-reduced-motion: reduce)`.

## Unverified (needs a different input to check)
- Actual screen-reader announcement order/labels — needs a real SR pass (VoiceOver/NVDA).
- OAuth redirect round-trip UX (`Connect with Twitch`) — needs the live Twitch app + a connected account.

## What's working well
- **Visibility of system status:** mutation buttons show `Saving…` / `Finishing…` and success toasts fire on connect/save. ([Visibility of System Status](https://www.nngroup.com/articles/visibility-system-status/))
- **Wizard pattern done right:** labeled 6-step horizontal stepper + "Step N of 6", a `Back` action on every step, and a non-blocking `Skip` on the optional Add-ons step. ([Wizards](https://www.nngroup.com/articles/wizards/))
- **Error prevention:** accent hex is regex-validated and required fields disable `Continue`, preventing bad submits. ([10 Design Guidelines for Reporting Errors in Forms](https://www.nngroup.com/articles/errors-forms-design-guidelines/))
- **High contrast where it counts:** primary CTA 7.33:1, body text 15:1.

## Quick wins
- [x] Fix subtle-text contrast (#1)
- [x] Add focus rings (#2)
- [x] One `h1` per step + `aria-hidden` decorations (#3, #4)
- [x] Respect reduced-motion (#7)
- [ ] Render `/setup` and `/login` without the app header (#5)
