# Phase 7F — Design System, Accessibility and Interaction Polish (Plan Only)

Baseline confirmed: current commit `536390e0d4307e678f6cc29e4ec2e74d5bf589c1`. No business rules, schema, RLS, permissions, settings storage, notification delivery or integrations change in this phase. Presentation, wording, icons, focus, states and layout only.

## A. What inspection found (verified in code and data)

Design tokens
- A full semantic token set already exists in `src/index.css` (light and dark): background, foreground, card, primary, secondary, muted, accent, destructive, success, warning, checkout, info, border, input, ring, radius 0.5rem, sidebar palette, chart palette, shadows, Inter font.
- Missing: a dedicated emergency role, defined focus-ring rules, a documented density/spacing scale, and contrast targets.

Typography
- Consistent Tailwind steps are used 1,466 times, but arbitrary pixel sizes are used ~1,050 times: `text-[11px]` 296, `text-[10px]` 263, `text-[13px]` 231, `text-[12px]` 178, plus `[9px]`, `[14px]`, `[15px]`, `[16px]`, `[17px]`, `[18px]` across 40+ files. `text-[9px]` and `text-[10px]` are too small for reception and kiosk use.

Colour usage
- Feature code is clean: only 4 hardcoded-colour hits, all inside stock shadcn overlays (`ui/sheet.tsx`, `ui/drawer.tsx`, `ui/dialog.tsx`, `ui/alert-dialog.tsx`) plus `VisitorBadge.tsx` and `BadgePreview.tsx` print surfaces (intentional for paper) and `KioskSuccessScreen.tsx`.

Accessibility defects (static inspection)
- 55 of 61 icon-only buttons have no accessible name. Worst: `settings/CompanionFieldsManager.tsx` (6), `feedback/SurveyBuilder.tsx` (5), `settings/FeedbackSettingsTab.tsx` (4), `settings/FeedbackSettingsPerType.tsx` (4), `Calendar.tsx` (3), `DashboardHeader.tsx` (3), `settings/ContractorQuestionsTab.tsx`, `ContractorEnforcementTab.tsx`, `HealthQuestionsManager.tsx`, `VaccinationFieldsManager.tsx`, `FormFieldsManager.tsx` (3 each). `AuditLog.tsx:125` has `title` only, which is not an accessible name.
- Landmarks: no `<main>` in all seven kiosk pages, `Residents.tsx`, `NotFound.tsx`. Two `<h1>` on `PublicCheckIn.tsx`, `EvacuationReport.tsx`, `Evacuation.tsx`. No `<h1>` on `VisitList.tsx`, `KeysRegister.tsx`, `Index.tsx`, `HomeWorkbench.tsx`, `OperationsReport.tsx`, `FoodRegister.tsx`.
- Unlabelled inputs: `kiosk/KioskCheckIn.tsx` (16 fields, none labelled), `PresenceLog.tsx` (17), `ResidentLeave.tsx:118`, `kiosk/KioskResidentLeave.tsx:251,292`, `kiosk/KioskEvacuation.tsx:112`. `kiosk/KioskCheckOut.tsx:263` is the correct pattern.
- 39 uses of `h-screen`/`min-h-screen`, zero `h-dvh`.
- 111 files use transitions/animations; reduced motion is honoured only by one rule in `src/App.css:30`; framer-motion PIN dots in `KioskPinPad.tsx` are ungated.
- Click handlers on non-interactive elements acting as real controls: `AddVisitDialog.tsx:789,795`, `ResidentLeaveDialog.tsx:483,489`, `ResidentOutingDialog.tsx:711,717`, `feedback/SurveyBuilder.tsx:206`.
- Kiosk targets are mostly 56px, but `kiosk/KioskEvacuation.tsx:156,160,164` are 40px.

Symbols and emoji (must be removed from UI)
- Emoji picker data: `ResidentLeaveDialog.tsx:30-36`, `ResidentOutingDialog.tsx:49+` (24 symbol hits), `AddVisitDialog.tsx` (15), `DraftAcceptDialog.tsx:133-139`, `QuickAwayDialog.tsx` (8), `ResidentLeave.tsx` (5), `ResidentDirectoryTable.tsx:46`, `Reports.tsx` (9), `settings/LeaveTypesTab.tsx` (3), `settings/ReturnNotificationSettingsTab.tsx` (4), `feedback/SurveyBuilder.tsx`, `FeedbackDialog.tsx`, `checkin/StepScreening.tsx`, `useKeyboardShortcuts.tsx:23,28,33`.
- Tick/cross/warning glyphs used as status: `kiosk/KioskCheckIn.tsx:1043,1053,1057,1256,1264,1299`, `kiosk/KioskCheckOut.tsx:142,281`, `VisitorProfilePage.tsx:460,472,522`, `SARDialog.tsx:213`, `KeysRegister.tsx:409,808`, `Evacuation.tsx`.
- `ResidentLeaveDialog.tsx` and `QuickAwayDialog.tsx` are not referenced by any other file (orphans) — leave on disk, mark not in use, do not spend polish effort there.

Stored symbol data
- The only symbol column in the database is `leave_types.emoji`. The table currently holds zero rows, so nothing is at risk. The plan therefore removes the symbol input from the UI and renders a fixed display-only Lucide mapping by leave-type name, with a neutral fallback icon. The column itself is left untouched (no schema change), and any future stored value is ignored for display. This is documented rather than migrated.

## B. Design system definition

Tokens to add in `src/index.css` / `tailwind.config.ts` (additive only, no renames)
- `--emergency` / `--emergency-foreground` (distinct from destructive, reserved for live emergency mode), `--emergency-muted` for surfaces.
- `--focus-ring` alias of `--ring`, with a shared `:focus-visible` rule: 2px ring, 2px offset, never removed.
- Density spacing scale documented as: page padding 16/24, card padding 12/16, row vertical padding 8 (compact) or 12 (comfortable), control gap 8, section gap 24.
- Radii: controls `rounded-md`, cards/sheets `rounded-xl`, pills `rounded-full`. No new values.
- Typography scale locked to: 12 (meta), 14 (body/table), 16 (default form/kiosk body), 18 (card title), 20/24 (page title), 30+ (emergency totals and kiosk only). Arbitrary sizes below 12px are removed; `text-[9px]`/`text-[10px]` are replaced by `text-xs`.
- Contrast targets: body and control text 4.5:1, large text and non-text state indicators 3:1, focus ring 3:1 against adjacent colours. Verified for both themes with a scripted token contrast check.

Status semantics (colour never alone; always icon + word)
- Expected, On site, Overdue, Checked out, Flagged, Blocked, Safe, Not located, Assistance required, Off site — each gets a fixed token, fixed Lucide icon and fixed text label defined once in a new `src/lib/statusPresentation.ts`.

## C. Scope by area

1. Navigation and layout
   - Reception-first: `/` stays Visit List; Today, Overdue, Presence remain grouped; advanced modules (contractors, volunteers, keys, food, emergency, administration) stay in progressive-disclosure groups. No dashboard.
   - One `<main>` per route, single `<h1>` per route, `h-dvh` for shells, visible current-site context in the header on every desktop route.
   - Breakpoints: 768 tablet (single column, sticky action bar), 1024 (two-pane where already present), 1280/1440 (max content width, no stretched tables).
   - Kiosk keeps its own layout with no staff/admin navigation surfaces.

2. Visit List
   - Priority order preserved; overdue first, then expected, then on site.
   - Row density: comfortable default, compact toggle is out of scope; consistent 14px row text, tabular numerals for times and counts.
   - Search and filters get a single visible "Clear filters" control that resets chips, search and date together, with a live-region count of matching rows.
   - Primary action per row is one labelled button (Check out / Check in); secondary actions move into a labelled overflow menu with accessible names.
   - Checkout keeps its existing confirmation sheet; add explicit success and failure text with retry, no silent success.
   - Empty, loading (skeleton, no layout shift), error, offline and permission-denied states are already present — restyle only, keep wording truthful.

3. Check-in and checkout
   - Step header shows "Step X of Y" with a text progress label, not colour alone.
   - Every field gets a real label; the ordinary visitor flow keeps its current minimal field set unchanged.
   - Focus moves to the step heading on step change; Enter advances; Escape asks before discarding.
   - Validation messages sit next to the field, referenced by `aria-describedby`, announced politely.
   - Privacy and terms wording hierarchy: what is collected, why, who confirms it, then the confirmation control. No compliance claims.

4. Kiosk
   - Minimum 56px targets everywhere; fix the three 40px buttons in `KioskEvacuation.tsx`.
   - Label all 16 `KioskCheckIn` inputs and the unlabelled search boxes.
   - Reset/timeout messaging states plainly what will happen and how long is left.
   - QR Fast Lane keeps identity-only prefill; screening and terms remain explicit steps with worded outcomes replacing tick/cross glyphs.
   - Destination selection stays privacy-safe (no room numbers in show-all).
   - Site binding notice stays worded as pilot-grade only.

5. Emergency and evacuation
   - Large totals row with word labels; outstanding-first ordering retained; Off site stays collapsed with a visible count.
   - Live emergency start and resolve keep explicit confirmation and reason.
   - Print output for A4 must be byte-for-byte equivalent in structure; only spacing/typography of the print sheet may be touched, verified before and after.
   - No decorative elements, no animation in emergency mode beyond a subtle updating indicator that respects reduced motion.

6. Settings
   - Keep the Phase 7E structure, scope labels, read-only fence and truthful save states. Polish only: section heading hierarchy, consistent row layout, accessible names for the ~30 unlabelled icon buttons in settings managers, and preview labelling wording consistency.

7. Tables, registers and reports
   - Shared table shell: same header treatment, same row height, same empty/loading/error components, same filter bar layout, same "Clear filters" behaviour across visitors, contractors, keys, food, audit and reports.

8. Iconography inventory
   - Replacement mapping (symbol to Lucide, with a visible text label where the item is an action or status): tick to `Check`, cross to `X`, warning triangle to `AlertTriangle`, arrow to `ArrowRight`, family to `Users`, person to `User`, clinician to `Stethoscope`, transport to `Bus`, hospital to `Building2`, walking to `Footprints`, group to `Users`, garden to `Trees`, shops to `ShoppingCart`, keyboard shortcut toasts drop the symbol entirely, leave types to a name-based map with `CalendarDays` fallback.
   - Rules: decorative icons get `aria-hidden="true"`; icon-only controls get `aria-label`; no critical action is icon-only (check-in, check-out, resolve emergency, save settings, export all keep visible text).

9. Accessibility (WCAG 2.2 AA oriented, not certified)
   - Keyboard path through every core flow; visible focus everywhere; logical tab order in sheets and dialogs; focus restoration on close.
   - Semantic landmarks and heading order; form labels; `aria-live="polite"` for list counts, save results and roll-call totals; `aria-live="assertive"` reserved for emergency state changes.
   - `motion-reduce:` variants on transitions in high-traffic components and a reduced-motion guard for the framer-motion PIN dots.
   - Status never colour-only; screen-reader wording uses the same words as the visible label.

10. Performance and visual QA
   - Skeletons match final row heights (no shift), no new animation libraries, no route-level layout jump, and no horizontal overflow at 768, 1024, 1280 and 1440 on every route.

## D. Files expected to change

Tokens/config: `src/index.css`, `tailwind.config.ts`, new `src/lib/statusPresentation.ts`, new `src/components/ui/status-badge.tsx`, new `src/components/ui/page-header.tsx`, new `src/components/ui/data-table-shell.tsx` (presentation only).
Shell/nav: `src/components/DashboardHeader.tsx`, `src/components/AppSidebar.tsx`, `src/components/ui/sidebar.tsx` (labels only), `src/pages/NotFound.tsx`, `src/components/RequireAuth.tsx`.
Reception: `src/pages/VisitList.tsx`, `src/components/VisitorTable.tsx`, `src/components/CheckInSheet.tsx`, `src/components/CheckOutSheet.tsx`, `src/components/checkin/*`, `src/pages/Visitors.tsx`, `src/pages/HomeWorkbench.tsx`, `src/pages/Index.tsx`, `src/pages/PresenceLog.tsx`.
Kiosk: `src/pages/kiosk/KioskLayout.tsx`, `KioskHome.tsx`, `KioskCheckIn.tsx`, `KioskCheckOut.tsx`, `KioskQRScan.tsx`, `KioskEvacuation.tsx`, `KioskResidentLeave.tsx`, `KioskAttract.tsx`, `src/components/kiosk/*`.
Emergency: `src/pages/Evacuation.tsx`, `src/pages/EvacuationReport.tsx`.
Registers/reports: `src/pages/KeysRegister.tsx`, `src/pages/FoodRegister.tsx`, `src/pages/Residents.tsx`, `src/pages/AuditLog.tsx`, `src/pages/Reports.tsx`, `src/pages/OperationsReport.tsx`, `src/components/ResidentDirectoryTable.tsx`, `src/components/ResidentPresenceTable.tsx`.
Settings: icon-label fixes in `CompanionFieldsManager.tsx`, `FeedbackSettingsTab.tsx`, `FeedbackSettingsPerType.tsx`, `ContractorQuestionsTab.tsx`, `ContractorEnforcementTab.tsx`, `HealthQuestionsManager.tsx`, `VaccinationFieldsManager.tsx`, `FormFieldsManager.tsx`, `LeaveTypesTab.tsx`, `ReturnNotificationSettingsTab.tsx`, `ComplianceTab.tsx`, `feedback/SurveyBuilder.tsx`.
Symbol removal: `AddVisitDialog.tsx`, `DraftAcceptDialog.tsx`, `ResidentOutingDialog.tsx`, `ResidentDirectoryTable.tsx`, `SARDialog.tsx`, `VisitorProfilePage.tsx`, `useKeyboardShortcuts.tsx`, `checkin/StepScreening.tsx`, `FeedbackDialog.tsx`.
Docs: `roadmap.md`, `docs/SECURITY_REVIEW.md`, new `docs/DESIGN_SYSTEM.md`.

Not touched: hooks that write data, RPCs, migrations, permissions, settings keys, `src/integrations/supabase/*`, the ten parked settings files, `ResidentLeaveDialog.tsx` and `QuickAwayDialog.tsx` beyond a not-in-use marker.

## E. AU/UK correctness
Every wording change goes through existing operating-context terminology helpers; no hardcoded "aged care", "care home", "resident" or "village" strings are introduced. Each increment is checked at Riverstone Aged Care (AU) and Willowbrook Care Home (UK), plus a retirement-village pack check where the pack differs.

## F. Acceptance tests per increment
- Keyboard-only pass of the flow touched, with visible focus at every stop.
- Accessible name present on every icon-only control in the touched files.
- One `<main>`, one `<h1>`, correct heading order on touched routes.
- No horizontal overflow at 768/1024/1280/1440.
- Status readable with colour ignored (icon + word present).
- AU and UK wording both correct.
- Regression of the flow's behaviour: reception check-in/checkout, kiosk check-in/checkout/reset, emergency drill roll call, settings save/read-only, badge print, A4 emergency print.
- Typecheck, build, security linter at the documented 47-warning baseline, no temporary data left.

## G. Execution sequence (each increment is plan-reviewed before build)
1. Tokens, focus rules, typography scale, `statusPresentation`, `StatusBadge`, `PageHeader`, design-system doc. No page changes yet.
2. Shell and landmarks: `h-dvh`, one `main`/`h1` per route, header site context, sidebar labels, NotFound.
3. Icon and symbol removal sweep plus accessible names (all files in the inventory), including the leave-type display-only mapping.
4. Visit List and table shell polish, filters reset, live-region counts, states.
5. Check-in and checkout polish: labels, focus order, progress, validation, retry, privacy hierarchy.
6. Kiosk polish: targets, labels, timeout wording, Fast Lane clarity, site-binding notice.
7. Emergency mode polish and print verification.
8. Settings, registers and reports consistency pass.
9. Reduced motion, contrast verification, full viewport QA, documentation update.

## H. Risks, prototype-grade limits and rollback
- Prototype-grade, must not be claimed as compliance: WCAG 2.2 AA is a design target verified by inspection and scripted checks, not an audited conformance statement; no assistive-technology user testing; kiosk site binding remains URL/device-memory; notification delivery, printer hardware and external integrations remain absent; contractor verification remains manual.
- Unsafe migration explicitly avoided: `leave_types.emoji` is left in the database untouched; the UI stops offering or reading it and uses a fixed icon map instead.
- Risk: wording edits could break AU/UK terminology — mitigated by routing all copy through the context helpers and testing both sites.
- Risk: print surfaces regress — mitigated by capturing badge and A4 emergency output before and after each print-touching increment.
- Risk: token changes shift many screens at once — mitigated by making increment 1 additive only and reviewing at four viewports.
- Rollback: each increment is a separate commit; reverting one increment restores prior presentation without touching data, settings or permissions.

## I. Open questions
1. Should Visit List rows default to comfortable density on desktop and compact on 1440+, or one density everywhere?
2. Should the emergency colour role be a distinct hue from destructive red, or a deeper red variant?
3. Should the ordinary visitor check-in keep its current field set exactly, or may an optional field be hidden behind "Add more details"?
4. Should the two orphan dialogs (`ResidentLeaveDialog`, `QuickAwayDialog`) be deleted in this phase or kept parked like the ten settings files?

## J. Proposed staged build prompts
Each of the nine increments in section G becomes its own build request, in that order, each stating: scope limited to that increment, no schema/RLS/permission/settings-storage changes, professional Lucide icons with text labels and no emoji, AU and UK verification, the acceptance tests in section F, cleanup of temporary data, and a report of files changed, pass/fail/blocked and commit SHA.
