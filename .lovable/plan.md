# Phase 7F — Increment 2: Shell, landmarks and navigation accessibility

Baseline: Increment 1 verified at `e303f4e9606d0be383d016959c39d657e8530e09`. This increment touches shell and page scaffolding only — no visual redesign of Visit List, check-in, kiosk content, emergency, settings, registers or reports. No database, RLS, permission, settings-key, RPC, workflow or business-rule change.

## What is wrong today (found by inspection)

- **Missing `main` landmark** on 9 routes: `Residents`, `NotFound`, and all seven kiosk screens rely on the kiosk layout (which does supply `main`, so kiosk is covered for the outlet, but `KioskAttract` returns bare `Outlet` with no landmark at all).
- **`AppHeader` used on only 6 of 30+ staff pages** (`VisitList`, `HomeWorkbench`, `Residents`, `FoodRegister`, `KeysRegister`, `OperationsReport`). Every other staff page hand-rolls a sticky header with its own `h1`, its own `SidebarTrigger`, and no site switcher, clock, occupancy or notification bell. Result: inconsistent focus order and inconsistent heading level per route.
- **Heading gaps**: `Residents` renders `AppHeader` but the page has no `h1` at all when no title is passed; `KioskAttract`, `KioskCheckIn`, `KioskCheckOut`, `KioskQRScan`, `KioskResidentLeave`, `KioskEvacuation` have no `h1`. `PublicCheckIn` has two `h1` elements across two branches (mutually exclusive — acceptable, confirm at build time). The `h1` strings inside `Evacuation.tsx:527` and `EvacuationReport.tsx:180` are inside print HTML templates — leave untouched.
- **`PageHeader` primitive from Increment 1 is unused.**
- **Icon-only shell actions**: `SidebarTrigger` (no accessible name beyond the shadcn default), the header outbreak toggle uses `title` only, the kiosk staff-access button has `aria-label` but is a 1.2s press-and-hold with no keyboard equivalent (intentionally obscure — keep, but document).
- **Sidebar**: groups use `CollapsibleTrigger` wrapping a `SidebarGroupLabel` `div`, so no `aria-expanded` is exposed on a real button in some paths; the chevron rotation keys off `group-data-[state=open]` on a parent that does not carry the `group` class, so the indicator never rotates. Nav items are `button` + `navigate()` rather than links — no middle-click/open-in-new-tab, and no `aria-current`. "Open kiosk" uses `window.open` from a button (acceptable, needs an explicit label saying it opens a new tab).
- **`RequireAuth` loading state** is a bare spinner with no text, no landmark, no live region; no denied state exists (unauthenticated users are redirected).
- **`NotFound`** has no `main`, no site shell, and only a raw anchor back to `/`.
- **`min-h-screen`** used across shell wrappers instead of `min-h-dvh` (kiosk/tablet address-bar issue).

## Route-by-route landmark map

Every staff route resolves to exactly one `header` (shell), one `nav` (sidebar), one `main`, one `h1`. The `h1` lives in the header region via `AppHeader`/`PageHeader`; page bodies start at `h2`.

| Route | Shell | h1 source | main |
|---|---|---|---|
| `/`, `/visit-list` | staff | AppHeader "Visitor list" | exists |
| `/today` | staff | AppHeader | exists |
| `/visitors`, `/visitors/:id` | staff | convert inline header to AppHeader | exists |
| `/residents` | staff | AppHeader (add title) | **add** |
| `/food-register`, `/keys` | staff | AppHeader | exists |
| `/calendar`, `/gdpr`, `/audit-log` | staff | convert | exists |
| `/reports*` (7 routes) | staff | convert | exists |
| `/evacuation` | staff | convert (print template untouched) | exists |
| `/settings` | staff | convert | exists |
| `/person-type`, `/group-checkin` | staff | convert | exists |
| `/coverage` | staff | convert | exists |
| `/auth` | standalone | existing | verify one `main` |
| `/public-checkin` | standalone | existing (branch-exclusive) | exists |
| `/kiosk` (attract) | kiosk | visually-hidden `h1` "Welcome" | **add** |
| `/kiosk/*` (6 screens) | kiosk layout `main` | per-screen `h1` (visually hidden where the design has no title) | layout |
| `*` (NotFound) | minimal | "Page not found" | **add** |

Redirect-only routes (`/dashboard`, `/workbench`, `/check-in`, `/qr-fast-lane`, `/resident-leave`, `/leave-requests`, `/checkout-requests`, `/feedback`, `/visitor-analytics`) render nothing and are unchanged.

## Changes

### 1. Shell scaffolding
- New `src/components/AppShell.tsx`: wraps `SidebarProvider` + `AppSidebar` + `SidebarInset` + `AppHeader` + `<main id="main-content">`, taking `title`, `subtitle`, `actions` and notification counts. Pages pass content as children. This removes ~25 copies of the same wrapper without changing any page's data or behaviour.
- Add a "Skip to content" link as the first focusable element in `AppShell`, visible on focus only, targeting `#main-content`.
- `AppHeader` always renders exactly one `h1`; when a page needs richer heading content it uses `PageHeader` (Increment 1) inside `main` at `h2` level, never a second `h1`.
- Replace `min-h-screen` with `min-h-dvh` in shell wrappers only (page-level instances are later increments).

### 2. Conversion order (small, reviewable batches)
1. `AppShell` + `VisitList`, `HomeWorkbench`, `Residents` (reception-critical; Visit List stays the default `/` route).
2. `Visitors`, `VisitorProfilePage`, `Calendar`, `Settings`.
3. Reports family, `GDPR`, `AuditLog`, `Evacuation`, `EvacuationReport`, `CoverageChecklist`.
4. `PersonTypeSelector`, `GroupCheckIn`, `FoodRegister`, `KeysRegister`.
Each batch is behaviour-neutral: same components, same hooks, same order of page-specific actions.

### 3. AppSidebar
- `nav` with `aria-label="Main"`; groups become real `button` triggers exposing `aria-expanded` and a correctly rotating chevron (`aria-hidden`).
- Nav items become `NavLink`-backed `SidebarMenuButton asChild` so they carry `href`, `aria-current="page"` and support open-in-new-tab. Active detection stays exactly as today (`/` and `/visit-list` both mark Visit list active).
- Group containing the active route stays open on load (existing `isGroupActive` logic preserved).
- "Open kiosk" keeps `window.open` but is labelled "Open kiosk (new tab)".
- Collapsed state keeps the icon rail; the header `SidebarTrigger` always stays visible and gets `aria-label="Toggle navigation"`. Sub-items currently have no icon — in collapsed rail mode they show the group icon plus tooltip so nothing becomes an unlabelled blank.
- Terminology stays configuration-driven (`terms.residentPlural`, module flags for Registers) — no hardcoded AU/UK labels introduced.

### 4. Header, site switcher, focus order
Focus order becomes: skip link → sidebar trigger → h1 (not focusable) → nav → clock/occupancy (non-interactive, `aria-hidden` decorative icons) → outbreak toggle → site switcher → notifications → page actions → main.
- Outbreak toggle gains a visible text label already present plus `aria-pressed` and an accessible description; `title` is no longer the only affordance.
- Occupancy chip gets `role="status"`/`aria-label` describing count and limit in words, not colour alone.
- `SiteSwitcher` already has an `aria-label`; add `aria-haspopup="menu"` behaviour verification and focus return to the trigger on close (Radix default — verify, do not re-implement).

### 5. Kiosk separation
- `KioskLayout` stays the only kiosk shell; assert no `AppSidebar`, `AppHeader`, `SiteSwitcher`, `NotificationBell` or settings link is reachable from any `/kiosk/*` screen (grep-enforced acceptance test).
- `KioskAttract` gains its own `main` and a visually hidden `h1`.
- Each kiosk screen gains an `h1` (visible where a title already exists, visually hidden otherwise).
- Press-and-hold staff access is unchanged in behaviour; documented as prototype-grade obscurity, not a security control.

### 6. NotFound and RequireAuth
- `NotFound`: `main` + `h1` "Page not found", plain-language sentence, and two labelled Lucide actions — "Back to visit list" and "Go back". Keeps the existing console log.
- `RequireAuth` loading: `main` + `role="status"` + visible "Checking your sign-in…" text, spinner `aria-hidden`, respects reduced motion.
- Add a shared read-only/denied panel usage note: route-level denial still redirects to `/auth`; in-page permission denial keeps the existing `PermissionDeniedState`.

## Responsive behaviour

| Width | Sidebar | Header | Main |
|---|---|---|---|
| 768 | offcanvas sheet, trigger always visible, focus trapped in sheet and returned to trigger on close | clock/occupancy hidden, site switcher moves into the sidebar footer (already present) | full width, `px-4` |
| 1024 | icon rail collapsible, tooltips on | occupancy visible | `px-6` |
| 1280 / 1440 | expanded by default | all chips visible incl. outbreak control | max content width unchanged |

No layout shift: sidebar width is reserved by `SidebarProvider`; header height fixed via `min-h-14`; skip link is absolutely positioned.

## Files

New: `src/components/AppShell.tsx`, `src/components/SkipToContent.tsx`.
Edited: `src/components/AppHeader.tsx`, `src/components/AppSidebar.tsx`, `src/components/SiteSwitcher.tsx`, `src/components/RequireAuth.tsx`, `src/pages/NotFound.tsx`, `src/pages/kiosk/KioskLayout.tsx` and the six kiosk screens (heading/landmark only), plus the staff pages listed in the conversion batches. `docs/DESIGN_SYSTEM.md` gains a shell/landmark section. `roadmap.md` records the increment.
Not touched: `src/App.tsx` routes (order and redirects unchanged), all hooks, all data access, print templates, `leave_types` symbol data.

## Acceptance tests

1. Every staff route: exactly one `main`, one `h1`, one `nav[aria-label="Main"]` (scripted DOM count via Playwright over the route list).
2. `/` still renders the Visit List for a signed-in user; `/today`, `/settings`, `/evacuation`, `/kiosk` unchanged in destination.
3. Keyboard: Tab from page load reaches skip link first; Enter moves focus into `main`; sidebar fully operable by keyboard; sheet at 768 traps focus and restores it to the trigger on Escape.
4. `aria-current="page"` present on exactly one nav item per route.
5. No `AppSidebar`/`AppHeader`/settings affordance in any `/kiosk/*` DOM.
6. NotFound and RequireAuth loading expose landmark + status text.
7. No horizontal overflow at 768/1024/1280/1440 on converted routes (`/residents` pre-existing ~27px overflow is tracked separately and must not worsen).
8. Regression: check-in, checkout, emergency start/resolve, settings save, keys/food registers, reports export all behave as before.
9. `tsgo --noEmit`, production build clean, Supabase linter unchanged at the documented 47-warning baseline.

## Risks and rollback

- **Risk:** mass conversion to `AppShell` accidentally drops a page-specific header action or count. Mitigation: convert in four batches, diff each page's action props, no logic edits in the same commit.
- **Risk:** switching nav buttons to links changes navigation semantics (full reload if `href` used without `NavLink`). Mitigation: `NavLink` only.
- **Risk:** moving headings changes visual weight. Mitigation: keep existing classes; only the element/level and labels change.
- **Rollback:** each batch is an isolated commit; reverting `AppShell` adoption per page restores the prior wrapper with no data implications.

## Non-goals

Visit List/check-in/kiosk/emergency/settings/registers/reports visual refinement, the icon and text-size sweep, emoji/symbol replacement, `leave_types` data, new permissions or routes, dashboard-style additions, notification delivery. Accessibility here is a design target verified by inspection and scripted checks — not a certified WCAG or regulatory compliance claim.

## Open questions

1. Should the standalone `/auth` and `/public-checkin` pages also gain the skip link, or stay minimal? (Assumption: skip link staff shell only.)
2. `Residents` currently shows no page title in its header — confirm "Residents" (AU/UK term-driven) is the right `h1`.
