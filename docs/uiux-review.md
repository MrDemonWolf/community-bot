# UI/UX Review: Community Bot dashboard

**Reviewed:** 2026-10-15 · **Input:** commit `4088b2f`, GitHub CI screenshots, browser traces, and source · **Method:** NN/g heuristic evaluation + guideline review

## Executive summary

- The dashboard supports its core setup and control tasks. No severity 3–4 problems were observed in the reviewed flows.
- The clearest remaining issue is technical validation output: an invalid command prefix produces a schema error instead of a useful correction.
- Selected mobile navigation text narrowly misses the normal-text contrast threshold. The overview title also gives less orientation than the navigation label.
- Removing the cyan selection stripe is the creator's visual preference, not an accessibility requirement.

**Findings:** 🟥 0 catastrophic · 🟧 0 major · 🟨 3 minor · ⬜ 1 cosmetic

Evidence baseline: [CI run 38765715377](https://github.com/MrDemonWolf/community-bot/actions/runs/38765715377) passed all five browser journeys. Reviewed screenshots include desktop overview/settings/features, phone overview/features/More at 390 × 844, and phone forms at 360px. Chromium and iPhone 13 WebKit automation covered touch, keyboard focus boundaries, Escape, backdrop dismissal, offline controls, and the production offline page. These are browser-engine checks, not a physical iPhone test or a complete accessibility audit.

## Findings

### 🟨 Severity 2 — Minor

#### 1. Command-prefix errors expose implementation details

- **What:** Saving a prefix containing a space returns a JSON-style Zod issue with `invalid_format`, a regex, and `Invalid input`. The user must infer the allowed format.
- **Where:** Settings → Community preferences; `packages/api/src/validation.ts` and the `save.error.message` feedback in `apps/web/src/components/settings-panels.tsx`.
- **Guideline:** Help users recognize, diagnose, and recover from errors.
- **Evidence:** [Error-Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/) recommends familiar language and a precise explanation that helps users correct the issue. An archived browser trace from run `38757638700` records the HTTP 400 response; the same validator and error rendering remain in the reviewed baseline.
- **Fix:**
  - [ ] Show “Use 1–5 characters without spaces” for the prefix failure.
  - [ ] Associate the error with the prefix input and preserve the entered value.

#### 2. Selected mobile labels fall just below text contrast requirements

- **What:** Small active labels use `#0878ab` on `#eaf6fc`: **4.45:1**, calculated from sRGB relative luminance. The mobile tab label is 11px, so the large-text exception does not apply. A threshold cannot be rounded up.
- **Where:** Selected mobile tabs and selected links in More, in the baseline navigation CSS.
- **Guideline:** WCAG 2.2 SC 1.4.3, Contrast (Minimum).
- **Evidence:** [Understanding Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) specifies at least 4.5:1 for normal text and explains that values below the threshold do not pass through rounding.
- **Fix:**
  - [ ] Darken the selected-label text and measure the resulting pair at ≥4.5:1.
  - [ ] Keep the selected background and `aria-current` state so selection remains recognizable.

#### 3. The overview heading does not name the current page

- **What:** The main heading says “Hey, Nathanial.” while the selected navigation says Overview. Returning users scanning for connection status get a greeting before a task-oriented page label.
- **Where:** Dashboard overview, desktop and mobile; `apps/web/src/app/dashboard/dashboard.tsx`.
- **Guideline:** Use meaningful headings and support scanning. This is an orientation improvement, not a claim that a greeting alone establishes a WCAG failure.
- **Evidence:** [How Users Read on the Web](https://www.nngroup.com/articles/how-users-read-on-the-web/) recommends meaningful headings and concise, scannable text. [Understanding Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html) explains the role of descriptive headings in understanding content.
- **Fix:**
  - [ ] Use “Overview” as the h1, matching navigation.
  - [ ] Keep setup guidance short and subordinate to the page title and connection status.

### ⬜ Severity 1 — Cosmetic

#### Reviewer judgment (no NN/g citation)

#### 4. The cyan selection stripe conflicts with the requested quieter style

- **What:** The desktop active navigation item has a cyan inset left stripe. The creator explicitly prefers a cleaner selection treatment. The stripe itself was not shown to impede a task.
- **Where:** Desktop sidebar selected item, baseline `box-shadow: inset 3px 0 0` treatment.
- **Guideline:** Creator preference and consistency with the requested product style; no research-backed defect is claimed.
- **Evidence:** Actual desktop overview screenshot and source at `4088b2f`.
- **Fix:**
  - [ ] Remove the stripe; preserve a clearly selected background, readable text, and `aria-current`.

## Unverified (needs a different input to check)

- The new personal staff picture picker, cropper, and private-image isolation are outside this baseline. They need the next migration, integration fixture, and browser run. Staff pictures must remain private even when the creator enables the public channel page.
- The pending hierarchy, neutral selection, shared-modal, and contrast changes need fresh screenshots and interaction regression checks; source changes are not visual proof.
- Screen-reader announcements, OS text enlargement, physical-device safe areas, and installed PWA behavior need assistive-technology/device testing.
- Live Discord/Twitch account linking and Dokploy rollout were not exercised. All provider integration fixtures use mocked traffic.

## What's working well

- Overview separates current service status from application settings; guided setup has a concrete next action.
- Mobile bottom navigation keeps the main destinations available, with secondary tools in More. Tested focus boundaries and dismissal behavior passed in both browser engines.
- The 360px/390px forms remained within the viewport; primary controls met the project's 44px touch-target check.
- Offline controls failed immediately without replaying writes after reconnect, and the production offline page did not cache private API responses.

## Quick wins

- [ ] Replace the technical prefix error with a field-specific correction.
- [ ] Measure and darken selected mobile labels.
- [ ] Rename the page heading to Overview and remove the stripe as requested.
- [ ] Verify the revised shell and profile editor in fresh desktop and phone browser artifacts.
