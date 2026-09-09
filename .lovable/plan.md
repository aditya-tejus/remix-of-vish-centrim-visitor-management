# Phase 7F — Increment 2B: shell conversion for Visitors, Visitor Profile, Calendar and Settings

Baseline: Increment 2A verified on `191e15bf19cba6c979b50d6e90bc15cb0913c2d6`. `AppShell` + `SkipToContent` + `AppHeader` + `AppSidebar` is live on Visit List, Today and Residents.

This increment converts four more staff routes to the same frame. Presentation only.

## What inspection found (current state)

All four routes hand-roll their own frame: `SidebarProvider` > `AppSidebar` > `SidebarInset` > a private sticky `<header>` with its own `SidebarTrigger`, its own `<h1>` and its own `<main>`.

- `src/pages/Visitors.tsx` — private header, `h1` "Visitor Profiles", `main.p-4 sm:p-6 space-y-4`, `min-h-screen`. Search box, tabs (by person type + watchlist), quick check-in buttons, "Add to watchlist" dialog, `VisitorProfile` slide-over. The slide-over and watchlist dialog sit **outside** `SidebarInset` but **inside** `SidebarProvider`.
- `src/pages/VisitorProfilePage.tsx` — two returns. The "Visitor not found" branch renders a sidebar shell with **no `main` and no heading at all**. The main branch has `h1` "Visitor Profile", a back button, check-in/check-out buttons, print badge, and a "more" dropdown (feedback, edit, CSV, PDF, delete) with admin-gated items. Several dialogs after `SidebarInset`.
- `src/pages/Calendar.tsx` — `h1` "Visit Calendar", `main` is the two-column flex container itself (`p-6 flex flex-col lg:flex-row gap-6`); month `h2` and day `h3` inside. Type filter, month navigation, day detail panel.
- `src/pages/Settings.tsx` — `h1` "Settings" plus a **second** heading treatment inside: `SettingsPageHeading` renders `h2` for the active section (correct level, keep). The route header also renders its own `SiteSwitcher compact`, which `AppHeader` already provides — converting removes the duplicate. Wrapped in `SettingsAccessProvider` and `PersonTypesDraftProvider`, which must stay outermost.

Existing defects to fix as part of the conversion:
- No skip link and no labelled navigation landmark on any of the four routes (the sidebar `nav` labelling added in 2A comes from `AppSidebar`, so conversion fixes this automatically).
- Visitor Profile "not found" state has no landmark, no heading — a keyboard user lands nowhere.
- Visitor Profile back button and the "more" dropdown trigger are icon-only with no accessible name.
- `min-h-screen` on all four (should be `min-h-dvh`, already handled by `AppShell`).
- Settings renders two site switchers once converted, unless the page-level one is removed.

## Route-by-route landmark map after conversion

| Route | Shell title (the one h1) | Subtitle | main | Header actions |
|---|---|---|---|---|
| `/visitors` | Visitor Profiles | All contacts by type and watchlist | `p-4 sm:p-6 space-y-4` | Add to watchlist |
| `/visitors/:id` | Visitor Profile | `{first} {surname}` | `p-6` | Back, Check in again / Check out, Print badge, More menu |
| `/visitors/:id` (not found) | Visitor Profile | — | `p-6` | Back |
| `/calendar` | Visit Calendar | Daily visit overview — select a date to see details | `p-6 flex flex-col lg:flex-row gap-6` | Type filter (stays in body if it reads better) |
| `/settings` | Settings | Decisions administrators make for this site. | `p-4 sm:p-6` | none (site switcher comes from AppHeader) |

Each route ends with: one `main#main-content`, one `h1` (from `AppHeader`), one labelled `nav` (from `AppSidebar`), one skip link. Section headings inside pages stay at `h2`/`h3` — `SettingsPageHeading`'s `h2` is left exactly as is.

## Files to change

- `src/pages/Visitors.tsx` — replace wrapper with `AppShell`; keep dialogs as siblings after the shell content.
- `src/pages/VisitorProfilePage.tsx` — replace both wrappers with `AppShell`; move the header button cluster into `actions`; give the back button and the more-menu trigger `aria-label`.
- `src/pages/Calendar.tsx` — replace wrapper with `AppShell` using `mainClassName` for the two-column layout.
- `src/pages/Settings.tsx` — replace wrapper with `AppShell` inside the two existing providers; drop the page-level `SiteSwitcher`.
- `roadmap.md` — record increment 2B.

No other files. No new components: `AppShell`, `AppHeader`, `PageHeader` and the Increment 1 tokens already cover this. `PageHeader` is **not** added to these routes, because `AppHeader` already renders the single `h1` — adding it would duplicate the heading.

## Explicitly preserved

Data hooks, react-query calls, permissions (`isAdmin` gating on edit/delete), settings values and storage keys, `SettingsAccessProvider` / `PersonTypesDraftProvider` order, tabs and tab state, search, filters, month navigation, quick check-in, watchlist add/remove, badge printing, CSV/PDF exports, feedback and edit dialogs, delete confirmation, `VisitorProfile` slide-over, preview panel, and the `/` Visit List default route. No route table edits at all.

## Out of scope

Kiosk, public check-in, auth, emergency, registers, reports, Residents (its known ~27px/142px horizontal overflow stays tracked and untouched), `leave_types` symbol data, schema, RLS, RPCs, notification delivery.

## Risks

- **Provider nesting (Settings).** `AppShell` owns `SidebarProvider`; the settings providers must wrap it, not the reverse, or context breaks. Low risk, easy to verify by loading each section.
- **Dialog placement.** Dialogs currently sit inside `SidebarProvider`. Moved as siblings of `AppShell` they lose that context; none of them use sidebar context, but each dialog must be opened once during verification.
- **Calendar layout.** `main` doubles as the flex container; passing the classes through `mainClassName` preserves it exactly, but the two-column break at 1024 must be re-checked.
- **Sticky offsets.** Settings uses `lg:top-20` sticky columns tuned to the old 56px header; `AppHeader` height is similar but must be visually confirmed.
- **Header crowding at 768.** Visitor Profile has five header controls; they may need to collapse into the more-menu at small widths, or wrap.

## Acceptance tests

1. Each of the four routes: exactly one `main`, one `h1`, one `nav[aria-label]`; skip link is the first tab stop and moves focus into `main`.
2. Sidebar shows the correct active item with `aria-current="page"` on each route; focus is restored after collapsing/expanding a group.
3. Visitors: search filters, every tab renders, quick check-in works, watchlist dialog opens and adds, profile slide-over opens and closes returning focus.
4. Visitor Profile: loads a real visitor; back, check in / check out, print badge, feedback, edit (admin), CSV, PDF and delete (admin) all still reachable and named; the not-found branch shows a heading, a `main` and a working Back action.
5. Calendar: month navigation, type filter and day selection all work; two-column layout intact at 1280.
6. Settings: every section in the nav loads, read-only fences and denied reasons unchanged, preview panel appears for its sections, exactly one site switcher on screen, no settings value written by the conversion.
7. `/` still renders Visit List; `/today`, kiosk, emergency and reports untouched.
8. 768 / 1024 / 1280 / 1440: no new horizontal overflow beyond the tracked Residents issue.
9. AU residential, AU retirement village and UK care home terminology still comes from configuration.
10. Typecheck and build pass; security linter stays at exactly 47 warnings.

## Rollback

Four self-contained page files plus `roadmap.md`. Reverting any single page restores its previous shell independently; no shared component or route changes to unwind.

## Blocked / not claimed

- No production compliance claim. This is accessibility and consistency work, not certification.
- Residents overflow is not fixed here; it remains a tracked prior issue for a later increment.
- Restricted-role settings paths still cannot be exercised end to end without a restricted test account; permission code is preserved unchanged rather than re-verified.

## Open question

Calendar's type filter: keep it in the page body (safest, zero layout risk) or lift it into the header actions area for consistency with other routes? Default assumption unless told otherwise: keep it in the body.
