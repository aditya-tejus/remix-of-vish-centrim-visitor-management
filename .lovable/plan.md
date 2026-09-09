# Phase 7F — Increment 2C: shell and landmarks for reports, privacy, audit, emergency and coverage

Baseline: Increment 2B verified on `6d9de66c4049375e844c8419bfc9fff5e2ae704c`. This increment converts the remaining staff routes in scope to the shared `AppShell` pattern. Presentation and accessibility only — no data, permission, workflow, emergency-logic, export, print-template, schema, RLS, RPC or settings change.

## Routes in scope

| Route | File | Current wrapper | New shell |
|---|---|---|---|
| `/reports` | `src/pages/ReportsHome.tsx` | SidebarProvider + SidebarInset + private header + `<main>` | AppShell |
| `/reports/analytics` | `src/pages/Reports.tsx` | same | AppShell |
| `/reports/on-site` | `src/pages/OperationsReport.tsx` | local `Shell()` helper: SidebarInset + AppHeader + `<main>` | AppShell (delete local Shell, keep the same three call sites) |
| `/reports/evacuation` | `src/pages/EvacuationReport.tsx` | same as ReportsHome | AppShell |
| `/gdpr` | `src/pages/GDPR.tsx` | same, dialogs outside SidebarInset | AppShell |
| `/audit-log` | `src/pages/AuditLog.tsx` | same, count badge in header | AppShell |
| `/evacuation` | `src/pages/Evacuation.tsx` | same, large action cluster in header, fixed mobile bar and three dialogs inside SidebarInset | AppShell |
| `/coverage` | `src/pages/CoverageChecklist.tsx` | same | AppShell |

Out of scope and untouched: kiosk, public check-in, registers, Residents, check-in/checkout, `App.tsx` routes, print templates.

## Findings from inspection

1. **Every one of the eight routes renders two `main` landmarks today.** `SidebarInset` itself renders a `<main>`, and each page renders its own `<main>` inside it. This is the same defect fixed in 2A/2B and is the main reason for the conversion.
2. **No page in this batch has a single `aria-label`.** Icon-only control found: the Audit Log refresh button (`size="icon"`, `title="Refresh"` only) — it needs an accessible name.
3. **Heading levels are already sane** below the h1: GDPR, Evacuation and Coverage use `h2` for section headings, so removing the private page header leaves one h1 (from AppShell) plus existing `h2`s.
4. **Print templates contain their own `h1`/`h2`** (`Evacuation.tsx` roll-call sheet, `EvacuationReport.tsx` report sheet). These are strings written into a new print window, not the app DOM. They stay byte-identical.
5. **`AppHeader.title` is a string**, so the destructive `Shield` icon currently shown beside the Emergency Roll Call and Evacuation Report h1 has no place to go. See "Shell API" below.
6. **Evacuation's header action cluster is workflow-critical** — event class select, Start drill/emergency, Pause/Resume, assembly point select, CSV, Print sheet, All safe, Reset, End roll call — each already permission-gated by `canActivate` / `canMark` / `canExport`. It moves verbatim into `AppShell actions`.
7. **Evacuation's fixed mobile action bar and its three dialogs** (close, start prompt, correction) currently sit inside `SidebarInset` after `</main>`. GDPR's SAR, erasure and export-confirm dialogs sit after `SidebarInset` inside the provider.
8. **OperationsReport** already uses `AppHeader` with a title/subtitle and an export action, and it renders `LoadingState` and `PermissionDeniedState` through the same Shell. That behaviour is preserved exactly.
9. **Audit Log** shows an entry-count badge in the header — moves into `AppShell actions`.

## Shell API

`AppShell` gains one optional, presentational prop: `titleIcon?: LucideIcon`, forwarded to `AppHeader`, rendered before the title text and marked `aria-hidden`. This preserves the existing emergency visual cue on `/evacuation` and `/reports/evacuation` without a second heading. No other shell behaviour changes. Files: `src/components/AppShell.tsx`, `src/components/AppHeader.tsx`.

If this prop is unwanted, the fallback is to drop the icon from the heading and leave the emergency cue to the in-page status strip.

## Route-by-route landmark map

Every converted route: one skip link (shell), one `nav aria-label="Main"` (shell sidebar), one `<h1>` (shell header), one `<main id="main-content">` (shell).

- `/reports` — h1 "Reports"; card grid in main.
- `/reports/analytics` — h1 "Reports & Analytics"; stats, charts, tables in main.
- `/reports/on-site` — h1 "Who is on site"; export action in header; loading and permission-denied states render inside the same main.
- `/reports/evacuation` — h1 "Evacuation Report" with optional shield icon; compliance note, drill list, detail and print action unchanged in main.
- `/gdpr` — h1 configuration-driven ("GDPR & Privacy" UK / "Privacy & Compliance" AU); tabs and section `h2`s in main; dialogs rendered inside main (portalled, so no visual change).
- `/audit-log` — h1 "Audit Log"; entry-count badge and a labelled refresh button in header actions.
- `/evacuation` — h1 "Emergency Roll Call" with optional shield icon; full action cluster in header actions; roll-call groups (`h2`), mobile bar and dialogs inside main.
- `/coverage` — h1 "Coverage Checklist"; summary and list in main.

## Preserved behaviour and permission constraints

- All permission gates untouched: `canView`, `canExport`, `canActivate`, `canMark`, `permsLoading`, the Evacuation read-only banner, and the GDPR/audit access paths.
- All emergency state logic untouched: activation, pause/resume, drill vs real, mark-safe, reset, corrections, offline queue and retry, close-event flow, closed-event protections.
- Exports (CSV, PDF, print windows) and their audit-trail side effects unchanged; print HTML strings unchanged.
- Report filters, date ranges, tabs, search, action filter, charts and tables unchanged.
- `/` stays the Visit List; no route table changes.
- AU/UK wording continues to come from the existing configuration hooks; no literal AU/UK strings are added.
- No emojis or decorative Unicode; Lucide icons only; icon-only controls get accessible names.

## Accessibility fixes included

- Remove the duplicate `main` on all eight routes.
- `aria-label="Refresh audit log"` on the Audit Log refresh button (keeping the existing `title`).
- Keep the `h2` section headings; no heading downgrades or additions beyond the shell h1.

## Risks

| Risk | Mitigation |
|---|---|
| Emergency page is high-pressure; a layout regression is operationally serious | Move the header cluster verbatim, change no handler, verify start/pause/mark/close and mobile bar in the browser at 768 and 1280 |
| Dialog focus behaviour changes when dialogs move inside `main` | Radix portals to `body`; verify open/close/focus-return for all Evacuation and GDPR dialogs |
| OperationsReport's local `Shell` is used by three return paths | Convert all three (loading, denied, normal) in the same edit and test each |
| Sticky header offsets differ slightly from the private headers | Visual check at 768/1024/1280/1440 |
| Print output drift | Print template strings are not edited; verify one drill print and one roll-call print still open and render |

## Acceptance tests

1. All eight routes load with exactly one `main`, one `h1`, one main `nav`, one skip link; skip link moves focus to content.
2. Sidebar shows the correct active item (`aria-current`) on each route.
3. `/reports/on-site`: loading, permission-denied and normal states all render in the shell; export button appears only with export permission and still records the audit toast.
4. `/evacuation`: start drill and start real emergency prompts, pause/resume, assembly point select, mark all safe, reset, correction dialog, end roll call, offline banner and retry, CSV, print sheet — all present, permission-gated and working; mobile action bar still fixed at the bottom below `lg`.
5. `/reports/evacuation`: drill list, detail and print still work; printed sheet identical.
6. `/gdpr`: tab switching, SAR dialog, erasure dialog and export confirmation open, close and return focus; heading text follows AU/UK configuration.
7. `/audit-log`: search, action filter, refresh (with accessible name) and entry count work.
8. `/coverage` renders unchanged content.
9. `/` still opens the Visit List; kiosk, registers, Residents, check-in unchanged.
10. No new horizontal overflow at 768/1024/1280/1440 on converted routes.
11. Typecheck and build pass; security linter stays at exactly 47 warnings; no temporary data.

## Tracked, not touched here

- Residents horizontal overflow at 768 and 1024.
- Settings preview column overflow at ~1024.
- Prototype status: these are accessibility and layout improvements in a prototype; nothing here constitutes certified regulatory or emergency-response compliance.

## Rollback

Each file is an isolated presentational conversion. Revert per file, or revert the whole increment, to return to `6d9de66c4049375e844c8419bfc9fff5e2ae704c` behaviour. The `titleIcon` prop is additive and optional, so reverting a page needs no shell revert.

## Blocked items

- None. Emergency behaviour will be exercised in the preview with whatever account state is available; if activation permission is unavailable to the test account, that specific control will be reported as visually verified only.

## Files to change

`src/components/AppShell.tsx`, `src/components/AppHeader.tsx` (optional title icon only), `src/pages/ReportsHome.tsx`, `src/pages/Reports.tsx`, `src/pages/OperationsReport.tsx`, `src/pages/EvacuationReport.tsx`, `src/pages/GDPR.tsx`, `src/pages/AuditLog.tsx`, `src/pages/Evacuation.tsx`, `src/pages/CoverageChecklist.tsx`, `roadmap.md`.
