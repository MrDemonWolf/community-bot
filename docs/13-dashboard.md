# 13 — Dashboard (apps/web)

TanStack Router. Tailwind + shadcn/ui. Mobile-first. Brand: navy/cyan.

## Top-level routes

```
/                          marketing landing (public)
/login                     Better-Auth login (Twitch + Discord providers)
/setup                     Phase 0 wizard (one-time, locks after)
/dashboard                 overview (mod+)
/dashboard/commands        list/edit/create (mod+)
/dashboard/timers          list/edit/create (mod+)
/dashboard/quotes          (Phase 3, mod+)
/dashboard/counters        (Phase 3, mod+)
/dashboard/moderation      filter config + recent actions (mod+)
/dashboard/loyalty         Brain Cells admin (Phase 4, editor+)
/dashboard/flows           visual flow builder (Phase 5, editor+)
/dashboard/audit           audit log viewer (mod+, partial)
/dashboard/import          import wizard (Phase 7, editor+)
/dashboard/addons/ai       AI settings (Phase 8, broadcaster)
/dashboard/discord/activity   activity rotation (Phase 6, editor+)
/dashboard/discord/roles   role map (Phase 6, editor+)
/dashboard/discord/streamlive   stream-live config (Phase 6, editor+)
/dashboard/roles           promote/demote users (broadcaster)
/dashboard/integrations    Twitch + Discord auth status (broadcaster)
/dashboard/settings        general settings (broadcaster)
/commands                  public command list (everyone)
/leaderboard               public top 20 Brain Cells (Phase 4)
/den                       sub-only page (Phase 6)
/den/locked                preview + "subscribe to view"
/privacy/me                GDPR data subject portal (everyone)
/legal/privacy             privacy policy (Fumadocs)
/legal/sub-processors      sub-processor list
```

## Layout

- Top nav: logo (navy/cyan wolf), search, user menu
- Side nav: collapsed by default on mobile; visible on `md:` and up
- Content area: max-width, mobile-first padding
- Mobile bottom nav: quick links to Commands, Mod, Audit

## Components inventory (shadcn/ui-based)

Initial:

- `<Button>`, `<Input>`, `<Textarea>`, `<Select>`, `<Switch>`, `<Checkbox>`
- `<Table>`, `<Dialog>`, `<Sheet>`, `<DropdownMenu>`, `<Tooltip>`
- `<Tabs>`, `<Toast>`, `<Card>`, `<Badge>`
- `<Avatar>`, `<Skeleton>`, `<Separator>`

Custom on top:

- `<CommandsTable>` — list with inline edit, enable toggle
- `<TimersTable>`
- `<TemplateEditor>` — monaco-lite for chat command templates, with variable autocomplete
- `<RoleBadge>` — styled per role (broadcaster cyan, editor blue, mod purple, etc.)
- `<AuditRow>` — collapsible
- `<WolfMark>` — small wolf logo
- `<BrainCellChip>` — for Phase 4

## Theming

CSS variables in `packages/ui/src/styles/globals.css`:

```css
:root {
  --brand-navy: #091533;
  --brand-cyan: #0FACED;
  /* shadcn tokens map onto these where appropriate */
}
```

Tailwind v4 uses `@theme inline` to expose `--color-brand-navy` / `--color-brand-cyan` as Tailwind utilities (`bg-brand-navy`, `text-brand-cyan`).

Dark mode default, toggle in user menu.

## Mobile-first patterns

```tsx
// good
<div className="p-4 md:p-8 lg:p-12">
  <h1 className="text-xl md:text-2xl lg:text-3xl">

// bad
<div className="lg:p-12 md:p-8 p-4">
```

ESLint rule (added in Phase -1): mobile-first ordering of Tailwind classes via `eslint-plugin-tailwindcss` `classnames-order`.

## Realtime hooks

`packages/shared/src/realtime.ts`:

```ts
export function useRealtimeBroadcast(channel: string, event: string, onPayload: (p: any) => void) { ... }
```

Used in dashboard pages to live-update tables (commands, audit log, mod actions).

## State management

- TanStack Query for server state (via tRPC)
- React local state for UI
- No Zustand / Redux / Jotai unless something needs cross-cutting state

## PWA

Service worker handles offline shell for public pages (commands, leaderboard, privacy). Dashboard requires online.
