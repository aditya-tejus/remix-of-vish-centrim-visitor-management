# Phase 7F — Increment 2D: shell and landmarks for check-in entry points and registers

Baseline: Increment 2C verified on `2d5acf0682a497a9a1f0355e79e94dc4a47140e2`. Presentation only. No schema, RLS, RPC, settings-key, permission, workflow, print-template or business-rule changes.

## Routes and files in scope

| Route | File | Guarding in App.tsx |
|---|---|---|
| `/person-type` | `src/pages/PersonTypeSelector.tsx` | staff route, no Module wrapper |
| `/group-checkin` | `src/pages/GroupCheckIn.tsx` | staff route |
| `/food-register` | `src/pages/FoodRegister.tsx` | `Staff` + `Module name="foodRegister"` |
| `/keys` | `src/pages/KeysRegister.tsx` | `Staff` + `Module name="keysRegister"` |

Supporting file, optional note only: `roadmap.md`.

All four are staff routes rendered inside the staff router, not inside `KioskLayout`. The kiosk tree (`/kiosk/*`) is untouched. `PersonTypeSelector` contains a link that navigates to `/kiosk/qr-scan`; that link's behaviour stays exactly as it is.

## Findings from inspection

1. All four pages hand-roll `SidebarProvider` + `AppSidebar` + `SidebarInset` and then render their own `<main>`. Because `SidebarInset` itself renders a `<main>`, every one of these routes currently has two main landmarks — the same defect fixed in 2A–2C.
2. `PersonTypeSelector` and `GroupCheckIn` also hand-roll a private `<header>` with `SidebarTrigger` and an `<h1>`, instead of `AppHeader`.
3. `FoodRegister` and `KeysRegister` already use `AppHeader` (correct h1 and actions) but still keep the duplicate `SidebarInset`/`main` structure.
4. `GroupCheckIn` has a permission-denied early return (`can("checkin.create")` false) that renders a `main` with no heading at all — a route with zero h1.
5. `KeysRegister` renders `PermissionDeniedState` inside its main, so its heading stays correct in the denied case.
6. Icon-only controls found: `GroupCheckIn` row remove button already has `aria-label="Remove person"`. No unlabelled icon-only controls were found in `FoodRegister` or `KeysRegister` at header level; the sweep during build will confirm any remaining ones in the keys row actions and label them without changing behaviour.
7. `min-h-screen` is used on all four wrappers; `AppShell` already uses `min-h-dvh`, so conversion removes them.
8. `GroupCheckIn` and `PersonTypeSelector` decorate their h1 with a Lucide icon (`UsersRound`). This is preserved via the existing additive `titleIcon` prop on `AppShell` (aria-hidden), so the visual cue survives without a second heading.

## Route-by-route landmark and heading map

| Route | h1 (from AppHeader) | Subtitle | Header actions | Main content |
|---|---|---|---|---|
| `/person-type` | "New Check-In" | "Select the type of person checking in" | none | person-type grid, QR fast-lane tile (only when enabled), group arrival tile; `AddVisitDialog` stays outside main as today |
| `/group-checkin` — allowed | "Group arrival" with `titleIcon={UsersRound}` | "Everyone gets their own record, so the roll call is right" | none | organiser card, attendee rows, save/print controls, watchlist dialog |
| `/group-checkin` — denied | "Group arrival" (same shell, so the route keeps one h1) | same | none | existing "You cannot sign people in" card, unchanged wording |
| `/food-register` | "Food Register" | existing subtitle | Export, Add Food (unchanged, same disabled rules) | filters card, table, record dialog |
| `/keys` | "Keys Register" | existing subtitle | Export register, still gated on `canView && canExport` | summary tiles, filters, list, or `PermissionDeniedState` |

Each converted route then has exactly one `<main id="main-content">`, one h1, one `nav aria-label="Main"` from `AppSidebar`, and one skip link from `AppShell`.

## Preserved actions and permission constraints

- `usePersonTypes` desk-type filtering, single-desk-type auto-open, `useKioskFastLane` gating, `/kiosk/qr-scan` navigation, `/group-checkin` navigation, `AddVisitDialog` with `initialType`.
- Group check-in: `submitVisitor`, watchlist check and `WatchlistAlertDialog`, organiser-declared terms via `extras.organiserDeclaredTermsEnabled`, shared `groupId`, per-attendee state machine, badge issuing, `useOperatingContext` site scoping, `can("checkin.create")` gate.
- Food register: `useFoodRegister` filters (from/to/resident/visitor name/search), site scoping including legacy null-branch rows, `exportCsvAudited` audit action and scope note, `AddFoodDialog` + `refetch`, record detail dialog.
- Keys register: all counts, filters, add key, issue sheet, return/lost flows, `canView`/`canExport` gates, audited export.
- No permission checks are added, removed, moved earlier, or relaxed.

## Tablet and kiosk implications

- No kiosk file changes. Kiosk keeps its own `KioskLayout` with no staff sidebar or admin controls.
- These four routes are staff-facing; on a reception tablet the sidebar collapses as it already does on the other converted routes.
- `AppShell` uses `min-h-dvh`, which is more correct than `min-h-screen` on tablet browsers with dynamic toolbars.

## Risks and rollback

- Risk: keys register list rows and the food table can overflow at 768 if the removed wrapper changes width constraints. Mitigation: keep the existing `mainClassName` padding identical to the current `main` classes and re-measure at all four widths.
- Risk: group check-in denied branch previously had no header; adding the shell header there is a visible change, but it is the fix for the missing-h1 defect.
- Risk: moving the group/person-type h1 into `AppHeader` slightly changes heading typography to match the rest of the app. Accepted as the point of the increment.
- Rollback: revert the four page files (and any roadmap note). No shared primitive changes are required beyond the already-shipped `titleIcon` prop, so rollback is file-local.

## Acceptance tests

1. `/person-type`, `/group-checkin`, `/food-register`, `/keys` each render with exactly one `main`, one `h1`, one `nav[aria-label="Main"]`, one skip link.
2. Skip link is first in keyboard order and moves focus to `#main-content` on each route.
3. Sidebar active state correct; focus returns to the group trigger after collapse.
4. Person type: each enabled type opens `AddVisitDialog` with the right type; single-desk-type auto-open still works; QR tile appears only when fast lane is on and still routes to `/kiosk/qr-scan`; group tile routes to `/group-checkin`.
5. Group check-in: add/remove rows, terms acknowledgement, save all, per-row failure retry, watchlist block dialog, badge print; denied account sees the denial card under a correct h1.
6. Food register: filters, clear filters, export (disabled when empty), add food refresh, record dialog open/close with focus return.
7. Keys register: counts, filters, add key, issue sheet, return, export gating for a non-export account, denied state.
8. No new horizontal overflow at 768/1024/1280/1440. Residents and Settings-preview overflow remain tracked and untouched.
9. AU residential aged care, AU retirement village and UK care home terminology unchanged and still configuration-driven.
10. Typecheck, build pass; security linter stays at exactly 47 warnings; no temporary data or settings created.

## Blocked items and known limitations

- Permission-gated paths can only be exercised at the test account's permission level; denied states will be verified by forcing the render path in the browser only if the account allows, otherwise reported as blocked.
- Tracked prior defects stay open: Residents horizontal overflow, Settings preview overflow near 1024.
- `leave_types` stored symbols are not touched in this increment.
- This is prototype-grade accessibility work; it is a design target, not an accessibility or regulatory certification.
