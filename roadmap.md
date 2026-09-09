# Centrim Life Visitor Management — staged reset

## Stage 0 — Audit (done)
Baseline recorded in the approved plan document.

## Stage 1 — Shared contract and safe foundation (done, with documented blockers)
- [x] A. Site/tenancy foundation: organisations, branches as sites, wings as areas,
      `branch_id` on operational tables, `user_site_access`, legacy placeholder site,
      `SiteProvider` current-site context.
- [x] B. Typed Centrim Life contracts + explicitly named `LocalPrototype*` adapters
      (`src/services/`), documented in `docs/INTEGRATION_CONTRACTS.md`.
- [x] C. Domain boundary: `people`, `visits`, `visit_parties`, person type / visit status
      reference tables, compatibility view. No tables dropped.
- [x] D. Access control: anonymous access removed from sensitive tables; kiosk moved to
      narrow RPCs; bcrypt kiosk PIN with legacy upgrade.
- [x] E. Settings scope: `settings_scoped`, `resolve_setting`, `src/lib/settingsScope.ts`.
- [x] F. Typecheck and build pass; migration audit events recorded.

### Stage 1 open items carried to Stage 2
- [ ] Kiosk visitor creation still inserts into `visitors`; move behind a `kiosk_check_in` function.
- [ ] Kiosk contractor screening should rely solely on `kiosk_contractor_lookup` outstanding
      checks instead of credential tables.
- [ ] Kiosk evacuation still reads through shared hooks after PIN entry.
- [ ] Notifications have no delivery channel — intent is recorded in audit only.
- [ ] 34 Supabase linter warnings remain: 1 extension in public, 13 anon-executable and
      20 authenticated-executable SECURITY DEFINER functions (kiosk RPCs and RLS helpers).
- [ ] Real Centrim Life integration APIs, kiosk-to-site binding and retention rules unknown.

## Stage 2 — Information architecture and visual shell (done)
- Root `/` now renders the staff workbench (Today); `/visit-list` and `/dashboard` preserved via direct route/redirect.
- Sidebar regrouped: Today, Visitor operations, People and movements, Registers, Reports, Administration, plus distinct emergency + kiosk entries.
- Header and sidebar footer show live current-site context (SiteSwitcher) instead of a hardcoded facility name.
- Settings regrouped by administrator decisions with visible scope badges.
- Shared loading/empty/error/permission/offline states added at `src/components/states`.
- No schema, RLS, or workflow changes in this stage.
- Stage 2 correction: `/` now opens the Visit List (daily operations); the workbench moved to `/today` with `/dashboard` and `/workbench` redirecting there. Sidebar shows Visit list and Today as primary items with correct active state.

## Stage 3 — Core daily visitor workflow (complete)
- Kiosk check-in now goes through the restricted `kiosk_check_in` server function; anon table access to `visitors` removed (verified: direct select/insert denied).
- `sync_visit_from_visitor()` mirrors legacy visitor rows into people/visits/visit_parties, with individual companion checkout timestamps.
- New visit statuses: draft, auto-checked-out, cancelled, incomplete.
- Visitor List: expected checkout / overdue column, loading, error and offline states with retry.
- Staff check-in skips person-type screen when only one type is enabled.
- Kiosk confirm step guarded against double-tap duplicate check-ins.
- Known limitations: kiosk key-overdue blocking is inert (kiosk can no longer read key tables — needs a purpose-specific RPC); external notification delivery still not implemented; 36 Supabase linter warnings remain (mostly SECURITY DEFINER functions, incl. the intentional anon kiosk RPCs).

## Stage 4 — AU/UK and segment configuration (done)
- Segment packs: AU residential aged care, AU retirement village, UK care home (src/lib/segmentPacks.ts).
- Operating context resolved per site (staff) and per kiosk `?site=` (src/contexts/OperatingContext.tsx).
- Settings show what they control, where they apply, who may change them, kiosk/desk effect and record impact.
- Person types: enabled, staff-visible, kiosk-visible, destination, screening, privacy, badge, roll call — per site, admin-only.
- Registers switched off by the pack disappear from navigation and routes.
- Open: retention periods and controller details are configuration placeholders only; person-type site overrides use `key@siteId` rows in `settings` because the kiosk cannot read authenticated scoped settings.

## Stage 5 — safety, privacy, permissions and audit (in progress)
- Emergency events now have states (draft/active/paused/resolved/reviewed), a snapshot time, drill vs real, full outcome set (safe, safe elsewhere, not located, assistance required, off-site) and reason-required corrections written to `emergency_actions`.
- Kiosk roll call reads and writes only through `kiosk_emergency_rollcall` / `kiosk_emergency_mark` with the verified PIN; it cannot start or close an event.
- Action permissions live in `role_permissions`; exports and emergency activation are permission gated in the UI and functions.
- Privacy notice details and per-record-class retention are configurable in Settings > Privacy and retention. No legal periods are supplied; nothing is deleted until switched on; legal holds are always skipped. Automated handlers exist for visits and the food register only.
- Notification settings now state plainly that no email/SMS is sent; alerts are in-app and audited only.
- Known: 47 database linter warnings remain — 18 intentionally anonymous kiosk RPCs, 28 staff RPCs that enforce permissions internally, and 1 extension in `public`. These need a documented review before go-live.

## Stage 5 hardening review (done — not production-ready)
- Default `PUBLIC` execute revoked on every database function; each function granted only
  to the roles that need it. Unused `kiosk_prefill_visitor` (name -> contact details) removed
  from the app surface.
- Linter: 43 warnings — 1 extension in public, 15 anon-callable kiosk functions,
  27 signed-in-callable functions. All classified and justified in `docs/SECURITY_REVIEW.md`.
- Kiosk now blocked from reading settings whose key mentions email, recipient, phone,
  contact or pin. Anonymous reads of visitors, residents, contractor credentials and all
  emergency tables verified as denied (401).
- Retention: `effective_retention_policy()` resolves site rule -> all-sites default and reports
  the scope; `run_retention(record_class, branch_id)` is site-scoped, permission gated,
  site-access checked, skips legal and safeguarding holds, and is audited.
  Automated handlers: visits and food register only. Every other class is labelled
  "Manual process only" or "Not supported yet" in Settings. No legal periods are supplied.
  Legacy GDPR-page retention wording corrected — nothing is deleted on a schedule.
- Emergency snapshots: a resolved or reviewed event rejects any new or changed roll call row,
  so a closed event keeps its point-in-time record. Verified end to end with temporary records
  (activation snapshot of 2, all outcome types, correction with reason, 7 audit actions,
  closed-event insert and update both rejected, event resolved then reviewed). All temporary
  records were deleted afterwards (verified 0 remaining).
- Kiosk emergency model documented: shared bcrypt PIN, read/mark only, minimum fields,
  5 failures in 15 minutes locks out, every attempt logged. Printed roll call is a fallback
  only and is not synchronised.

### Still open after this pass
- [ ] No independent security or privacy review.
- [ ] Returning-visitor lookup by exact name alone still returns that person's contact details.
- [ ] Real retention periods, data controller and privacy contact details are unset.
- [ ] No email or SMS delivery; notifications are in-app and audited only.
- [ ] Kiosk devices are not bound to a site by a device credential.
- [ ] Real Centrim Life integration APIs are unknown; adapters remain local prototype only.

## Stage 6A — contractor operations and keys / fobs register

- Nine action permissions added and enforced in the register UI and in RLS.
- Keys and handovers are site-scoped (`branch_id`) on both read and write.
- Items now carry a serial or engraved number, and can be reported damaged with an
  optional replacement copy ("awaiting replacement" when no copy is made).
- Every key action is audited.
- Site-specific mandatory contractor credentials (`contractor_mandatory_credentials@<site>`),
  used by both kiosk screening and the staff contractor profile panel.
- Supplier and person credential access narrowed to the contractor credential permissions,
  with site checks on person records.
- Kiosk key checks now go through `kiosk_open_key_holds` (counts only); the kiosk makes no
  denied reads of the key tables.
- Verified in the browser: add key with serial, report damaged with replacement copy,
  site-scoped list, kiosk check-in and check-out clean. Test records removed afterwards.

### Still open after Stage 6A
- [ ] Credential documents are not verified against any issuing authority.
- [ ] `keys.export` exists as a permission but there is no dedicated export file yet.
- [ ] Everything under "Still open" above Stage 5 remains open.

## Stage 6B — badges/QR, conditional food register, notifications, reporting

Done
- Badges: one badge model (the visit). `src/lib/badgeIssue.ts` wraps the existing print
  view, applies the site privacy rule `badge_show_destination` (drops resident/room when
  off), decides issued vs reprinted from `visitors.print_status`, supports void, and writes
  `badge_issued` / `badge_reprinted` / `badge_voided` to the audit trail. Browser print
  dialog only — no printer hardware integration is claimed. Setting added to Printing tab.
- Food register: site-scoped reads (legacy rows without a site stay visible), site stamped
  on every write (kiosk, front desk, manual), error state on the page, and an audited CSV
  export. Still gated per person type by `food_register_checkin_{type}` and absent from
  check-in when off. This is the local prototype register, not a Centrim Dining replacement.
- Notifications: honest delivery states (created / queued / delivered / failed / not
  configured) in `src/lib/notificationDelivery.ts`, surfaced in the Notifications settings
  tab. No external channel is configured, so only "In-app only" is possible.
- Reporting: `/reports/on-site` — who is on site, people over their expected time, and visit
  history by date and person type. Site-scoped, `presence.view` to open, `data.export` to
  download, export written to the audit trail via `src/lib/exportAudit.ts`.
- Keys/fobs export implemented behind `keys.export` with an audited CSV (closes the Stage 6A gap).

Open
- No email/SMS/push/Teams adapter; nothing is actually sent.
- Exports are browser downloads and are not tamper-evident.
- Contractor credential document verification still manual.
- Security linter unchanged at 45 warnings (1 extension, 16 anonymous, 28 signed-in
  SECURITY DEFINER functions) — same intentional set documented in docs/SECURITY_REVIEW.md.

## Stage 6C — final UX, regression and pilot readiness

Done
- Closed the anonymous `settings` read hole and all anonymous configuration writes
  (health questions, form fields, vaccination fields, feedback questions and surveys);
  contractor answers are authenticated-only. Details and evidence in docs/SECURITY_REVIEW.md.
- Responsive fixes for phone and tablet: shared header, Visit List command bar, summary
  cards, Settings navigation, Keys cards, People tabs, Operations report table and every
  page shell (`min-w-0` on the content area). Zero horizontal overflow at 390px on all
  reviewed routes.
- Regression evidence: kiosk check-in and check-out run end to end with no failed backend
  requests and correct site stamping; site filtering keeps legacy null-site rows with the
  legacy site only. Test data purged.
- Typecheck and build pass. Security linter unchanged at 45 warnings (1 extension,
  16 anonymous kiosk SECURITY DEFINER functions, 28 signed-in ones) — the same intentional
  set, with no new warning introduced by the lockdown migration.

Pilot controls (how to disable a module)
- Badges: Printing tab — turn off badge printing; `badge_show_destination` hides the
  resident and room line.
- Food register: `food_register_checkin_{type}` off removes it from check-in; the page is
  hidden when the module is off in the operating-context pack.
- Contractor enforcement: per-site `contractor_mandatory_credentials@<site>` — empty list
  means no credential blocks anyone.
- Keys/fobs: hidden without `keys.view`; issuing needs `keys.issue`.
- External notifications: none exist to disable; the UI states "In-app only".

Blockers before production
- Fix now: none outstanding from this review.
- Technical spike: tamper-evident export, kiosk device identity and site binding, a real
  notification adapter.
- Discover first: Centrim source-of-truth and sync ownership for people, residents, staff,
  suppliers and properties.
- Pilot control: manual contractor document verification, operator-set retention periods,
  printed emergency roll-call fallback.

Stage 6C recovery pass
- Closed emergencies are now fully immutable apart from the post-event review; reopening or
  editing a resolved/reviewed event raises an error (verified by test). This was the one
  "fix now" item the review turned up.
- Temporary test records for this stage purged (evacuation drill, visitor, derived rows).

## Phase 7A — reception workflow and Visit List (in progress)

Tasks:
- [ ] Visit List views: On site now, Overdue, Recent activity, Scheduled (limited, resident leave returns only)
- [ ] Person-type chips (reset to All each session), search with useful no-match panel, last-updated marker
- [ ] Primary vs secondary row actions; delete stays admin-only
- [ ] Responsive card layout at 375px / 768px
- [ ] Duplicate-submit prevention and save-failure retry preserving entered data
- [ ] Check-out failure retry
- [ ] Privacy-safe destination display
- [ ] Docs update (roadmap, SECURITY_REVIEW)

### Phase 7A follow-up (this pass)
- Removed all emoji from check-in and public check-in type tiles, confirmation badge and Check-In page; replaced with lucide icons (User, Wrench, HeartHandshake, Briefcase, UserPlus).
- Typecheck clean after change.

### Phase 7A verification pass — resident destination selection (2026-09-09)
- Root cause of the earlier stalled walkthrough: automated test targeting only. With fields addressed by placeholder and names entered before opening the destination selector, Next enables correctly and the selector offers Resident / Staff Member.
- Verified end to end at the front desk: check-in completed (visitor appeared in On site now), then checked out with duration shown. No failed network calls; no console errors beyond pre-existing React ref warnings.
- Real defect found and fixed: `useResidents` loaded residents with no site filter, so residents from the original site were offered at Riverstone (AU) and Willowbrook (UK). Now filtered by current site; records with no site remain visible only on the original/legacy site.
- Resident selector now shows "No residents recorded for this site yet" instead of an empty control. Confirmed at Riverstone, where no residents are recorded.
- Layout: no horizontal overflow at 768px.
- Temporary test visitor and derived visit rows purged.
- Still outstanding for Phase 7A closure: returning-visitor lookup, companion individual departure, duplicate-submit and forced save/checkout failure retry are code-reviewed but not yet click-tested; security linter unchanged from the documented 45-warning baseline.

### Phase 7A closure verification (2026-09-09)
All five remaining checks run against the live preview with temporary records, then purged (zero test rows remain in visitors, people, visits, visit parties).

| Check | Result | Evidence |
| --- | --- | --- |
| Returning-visitor lookup | Pass (after fix) | Past visitor found by name, shown with name only, requires explicit selection, then details are carried forward and the visit records against the current site. |
| Returning lookup site isolation | Pass (fix applied) | The lookup previously searched every site. Now scoped to the current site; the same person returned "No matches found" at the second site. |
| Companion staying behind | Pass | Untick a companion: warning shown, main person recorded as left, visit stays open, companion count preserved. Success message now states how many are still on site. |
| Forced check-in save failure and retry | Pass | Visitor insert blocked at browser level; sheet stayed open, entered details preserved, clear failure message, no record created; retry after unblocking created exactly one record. |
| Forced checkout failure and retry | Pass | Visitor update blocked; person stayed on the on-site list with a clear message; retry recorded a single departure. |
| Double submit (check-in and checkout) | Pass | Second rapid click rejected while saving; one insert and one update observed. |

Failures were simulated with test-only browser request blocking. No production code, permissions, policies or server functions were weakened for testing; the exact blocked request was recorded in each run.

## Phase 7B — Kiosk experience and card Fast Lane (built)

Done:
- Kiosk welcome/attract and home now show the configured site name instead of a hard-coded one.
- Card/code recognition (`/kiosk/qr-scan`) rewritten: a code only *recognises* a person and pre-fills
  their name and contact details. Screening questions, terms and acknowledgements remain explicit steps.
- Someone already on site who scans their card is offered check out (with a retry if the save fails).
- Camera failure falls back to typing the code; an unrecognised or out-of-site code offers ordinary check-in.
- The card tile is hidden on the kiosk home, check-in and check-out screens when the site does not
  issue cards (`kiosk_fast_lane_enabled`, per site, editable under Returning Visitors settings).
- Kiosk on-site list and returning-person lookup are now site-scoped, so one kiosk never sees another site's people.
- Kiosk no longer writes to the audit table directly; blocked screenings are recorded through a narrow
  kiosk event log (purpose, outcome, site only).
- Removed the unrouted, unsafe duplicate QR page (`src/pages/QRFastLane.tsx`), which re-checked people in
  without screening or terms.
- Replaced the emoji satisfaction scale with professional icons.

Not done / limitations:
- Site is still chosen by `?site=` and remembered on the device. This is a pilot arrangement, not secure
  device binding; production needs an administrator-provisioned, cryptographically bound kiosk credential.
- No external notification delivery, printer hardware, pre-registration or invitations (out of scope).

## Phase 7B hardening — site-scoped kiosk directory helpers (complete)
- [x] Resident, staff, supplier, contractor and watchlist kiosk helpers now take a site and filter to it
- [x] Kiosk hooks, local adapters and contracts pass the kiosk site through
- [x] Records with no site are shown only at the original legacy site, never mixed into newer sites
- [x] Room numbers are hidden when a visitor browses the resident list; shown only after a deliberate search
- [x] The dead card-lane route on the person-type screen now points at the supported kiosk code screen
- [x] Pilot-grade site-binding wording aligned in roadmap and security review

Verified: anonymous calls at Riverstone return no Willowbrook people (and the reverse) for all five
helpers; legacy no-site records appear only at the legacy site; both kiosks show only their own
residents; resident leave, reception visit list and reports unchanged; kiosk network trace shows no
direct reads of visitor, resident, staff, supplier, contractor or alert tables; typecheck and build
pass; security linter unchanged at 47 documented warnings (1 extension in public, 17 anonymous
SECURITY DEFINER kiosk functions, 29 signed-in SECURITY DEFINER functions). All temporary test
records purged and verified at zero.

Known limitations:
- Site selection is still `?site=` plus device memory. This is pilot-grade only; production requires an
  administrator-provisioned, cryptographically bound kiosk device credential.
- With no-site records now excluded from newer sites, kiosks at a new site show nothing until that
  site's residents, staff and suppliers are assigned to it. Reception (signed-in) behaviour is unchanged.
- Contractor credential verification is still a manual staff action; no external notification delivery.

## Phase 7C — person types, volunteers and group arrivals (complete)
- [x] Type chooser skipped when only one type is enabled; fixed order; "Other" off by default
- [x] Volunteer role, supervisor and expected finish (site-configurable, optional)
- [x] Group arrival: organiser (name and contact required) plus individual attendee records
- [x] Each adult attendee confirms terms themselves; organiser-declared only for an assisted/child process, clearly labelled
- [x] Partial save with retry and no duplicates; late attendees join the same group
- [x] Independent attendee checkout; group checkout at the front desk only
- [x] Group-aware visit list, overdue, badges, roll call, reports and audit

Tested at Riverstone Aged Care: chooser order with "Other" hidden, volunteer optional fields,
a group of five saved as five individual records, a forced failure on person three retried without
creating a duplicate, a late arrival joining the same group, individual sign-out and whole-group
sign-out from the front desk. Temporary Ztemp records were removed and none remain.

Known limits after Phase 7C:
- Whole-group sign-out is front desk only; the kiosk still signs people out one at a time.
- Roll call lists every group member individually with the organiser's name and contact; this was
  reviewed in code rather than by starting a live emergency.
- Badges still print through the browser; no label-printer hardware is connected.

## Phase 7D — emergency mode and evacuation report (complete)
- [x] Focused Emergency Mode with drill vs live distinction and permission-gated actions
- [x] Explicit start step — marking a person can no longer silently declare a live emergency
- [x] Site stamping and site isolation for events, roll-call lines and history
- [x] Priority ordering (outstanding first), large totals, search/filter, jump to next
- [x] Snapshot vs late arrivals; off-site collapsed by default with count visible
- [x] Corrections with reasons; live resolve needs a reason and explicit confirmation; closed events immutable in the database
- [x] A4 paper fallback with drill/live banner; minimal offline retry queue (IDs and status only)

Known Phase 7D limitations:
- Offline queue holds only a roll-call line reference and status; if browser storage is unavailable the outcome is not queued.
- Roll call was verified with temporary drill data at one site; no live emergency was run against real operations.
- Second-person approval for closing an emergency is intentionally out of scope.

## Phase 7E — settings consolidation and configuration previews (complete)
- [x] Ten unreachable settings screens identified and left in place, clearly marked as not in use; navigation shows one home per decision
- [x] Plain-language section header on every settings section: purpose, who can change it, where the values are stored
- [x] Scope labels corrected to match real storage (site-saved vs one account-wide value); no false "override" is shown
- [x] Read-only experience for people without the needed permission — values visible, controls disabled, reason explained
- [x] Previews for kiosk sign-in, badge, visitor-type chooser and check-in questions, built from live configuration
- [x] Badge preview uses the same code that prints the real badge
- [x] Reset to default, unsaved-changes warning, validation, save failure with retry and a saved confirmation on the visitor types screen
- [x] Existing granular permissions kept; no new permission, key, table or policy

Known limits after Phase 7E:
- Settings values were not migrated: they still live in the flat settings table, some per site and some account-wide.
  Because of that, true inheritance ("inherited from organisation") is not shown anywhere — labels describe actual storage only.
- Audit entries are written by some settings screens (visitor types, operating context, keys policy, kiosk code, privacy)
  but not all. The screens that do not write one are listed in docs/SECURITY_REVIEW.md; no screen claims to be audited when it is not.
- The unsaved-changes warning and the full save/retry pattern are implemented on the visitor types screen; other screens keep
  their existing save behaviour unchanged.
- The ten unreachable screens are preserved on disk, not deleted.

## Phase 7E hardening (settings permissions, truthful saves, draft preview)
- Every live settings section is wrapped in a shared read-only fence. Someone without the
  section's existing permission sees all values but cannot change or save anything.
  Audit and exports is excluded from the fence because it saves nothing; its export keeps
  its own narrower `data.export` permission.
- Visitor types no longer bypasses the permission check for the administrator role, and
  Operating context and the kiosk staff code card now use the same shared check.
- Presence, Printing, Keys and fobs, Users and access, and Integrations now collect every
  write result. A failed or partly failed save keeps the values on screen, names what failed
  and offers a retry. Success is only shown when every write succeeded.
- Scope wording now matches actual storage: operating context is stored on the site record;
  visitor type availability is stored per site with an account-wide fallback; everything else
  (presence, printing, keys, governance, integrations, per-type settings) is account-wide.
- Visitor types passes its unsaved rows into the preview, labelled as unsaved. All other
  previews state that they show saved settings.
- Limitation: only Visitor types has a live draft preview. Other sections need a save first.
- Limitation: read-only behaviour is code-verified only; no restricted account exists to test with.

## Phase 7F increment 1 (design tokens, status model, shared building blocks)
- Added an emergency colour role (separate from error red), focus-ring tokens, radius roles,
  row-height and touch-target tokens. Existing brand tokens are unchanged.
- Focus is now visible on every control by a single global rule, and the operating system
  reduced-motion setting now switches off animation and transitions across the product.
- Added one shared status model: every status has a word, a plain-language description,
  a Lucide icon and a colour tone, so status can be read with colour ignored.
- Added three shared building blocks: StatusBadge, PageHeader and DataTableShell. They frame
  existing components rather than replacing them.
- Added docs/DESIGN_SYSTEM.md covering colour roles, type scale, spacing, radii, focus,
  motion, icon rules, accessibility rules and responsive principles.
- No page, route, data, settings, permission or database change in this increment.
- Limitation: existing screens still use arbitrary text sizes, h-screen, unlabelled icon
  buttons and symbol glyphs. Those are addressed in later increments.

## Phase 7F — Increment 2A (shell, landmarks, navigation) — done
- Added AppShell + SkipToContent; converted Visit list (`/`, `/visit-list`), Today (`/today`) and Residents (`/residents`).
- AppShell renders a plain content column (not SidebarInset) so each converted route has exactly one `<main id="main-content">`.
- AppSidebar: single labelled `nav`, real router links with `aria-current="page"`, group triggers expose `aria-expanded`, kiosk link labelled "Open kiosk (new tab)".
- AppHeader: sidebar trigger labelled, occupancy exposed as a status with a spoken count, outbreak toggle exposes pressed state.
- Verified: one main/h1/nav per converted route, skip link first in tab order and focuses main, no page errors, typecheck+build OK, Supabase linter unchanged at 47 warnings.
- Known defect carried forward (pre-existing, not introduced here): `/residents` horizontal overflow — 27px at 768 and 142px at 1024. To fix in a later increment with the register/table work.

## Phase 7F — Increment 2B (shell conversion batch 2) — done
- Converted Visitors, Visitor Profile (incl. not-found), Calendar and Settings to the shared AppShell.
- One main, one h1, one labelled main nav and one skip link per route; Settings keeps a single site switcher (header only).
- Named the icon-only back, more-actions and calendar month/close controls.
- Tracked, pre-existing: Residents horizontal overflow; Settings preview column overflow at 1024px (body layout, deferred to the Settings visual increment).

## Phase 7F — Increment 2C (reports, privacy, audit, emergency, coverage) — done
- Converted /reports, /reports/analytics, /reports/on-site, /reports/evacuation, /gdpr, /audit-log, /evacuation and /coverage to the shared AppShell.
- Removed the duplicate main landmark each of these routes had (SidebarInset main + page main).
- Added optional presentational titleIcon/titleIconClassName to AppShell/AppHeader (aria-hidden) to keep the emergency shield cue.
- Named the Audit Log refresh control; no other icon-only controls found on these routes.
- Print templates and export logic untouched; emergency roll-call print verified working.
- Still tracked, untouched: Residents overflow (768/1024) and Settings preview overflow (~1024).
- Known: the GDPR export confirmation is opened from state, so focus is not restored to the trigger on close (pre-existing).

## Phase 7F — Increment 2D (check-in entry points and registers) — done
- Converted /person-type, /group-checkin, /food-register and /keys to the shared AppShell.
- Removed the duplicate main landmark on all four routes (SidebarInset main + page main).
- Group arrival now has one h1 on both the permission-denied and normal branches, with the UsersRound cue as an aria-hidden title icon.
- Workflows, permissions, filters, exports, dialogs, sheets and data hooks unchanged; ordinary visitor check-in untouched; leave_types symbols untouched; kiosk routes untouched.
- Verified: one main / one h1 / one labelled main nav / one skip link per route; skip link moves focus to main-content; Add Food dialog, person-type check-in dialog and group attendee rows all work; no overflow at 768/1280/1440.
- Shared-component findings deferred to a later increment (not introduced here, present on earlier converted routes too): header action buttons push ~25-85px of horizontal overflow at 1024px on routes with header actions (same on /reports/on-site), and one unlabelled icon-only control in AppHeader.
- Still tracked, untouched: Residents overflow (768/1024) and Settings preview overflow (~1024).

## Phase 8A — Companion and attendance integrity (in progress)
- Canonical attendance: `visit_parties` per person, written only through the visitors trigger; parent visit state derived from its parties.
- Idempotent staff check-in via `check_in_party` with a per-attempt request key on visitors and visits.
- Companions can be linked to an existing person at the current site or explicitly recorded as new; name-only matches require staff selection.
- Visit List shows each companion as an individually accountable person with their own sign-out.
- Directory de-duplication no longer collapses blank-contact or same-name people.
- Outstanding in 8A: emergency roll call / presence log / badges / exports still read legacy visitor rows; the integrity report and historical reconciliation RPCs exist but have no admin screen yet; no party ordinal unique index until duplicates are reviewed.
- Security linter: 51 warnings (baseline 47). The 4 new warnings are the four staff-callable attendance routines, which enforce permissions internally.

- Phase 8A: added Settings > Audit "Attendance record check" (report + rehearsal repair, blocked when duplicates exist); companion departure times now mirrored from canonical attendance into the older visit record so roll call, exports and history agree. Still open: emergency/badge/export readers still read the mirrored older record rather than attendance rows directly; legacy "Unassigned" site holds 12 older arrivals with companions that need the repair run per site.
- Phase 8A: roll call now reads canonical attendance rows (companions appear individually and disappear when signed out on their own); verified with a retry-safe test arrival plus companion, then cleaned up. Remaining: badges, exports and profile history still read the older visit record, which is kept in step by the attendance mirror rather than read directly.

## Phase 8A — closure and hardening — done (with documented limits)
- Direct writes to `visits`, `visit_parties` and `people` are refused for signed-in users (grants revoked, broad write policies dropped). Reads stay site-scoped. All attendance changes go through the permission-checked routines (`check_in_party`, `check_out_party`, the visitors trigger). Verified live: POST to `visit_parties`/`visits` returns 403; `check_in_party` still succeeds and stays idempotent on retry; companion-only sign-out leaves the main visitor on site.
- Settings > Audit "Attendance record check": per-site counts, "View examples" per finding (`visit_integrity_samples`), duplicate-position review (`duplicate_party_details`), audited "Move to next position" (`renumber_visit_party`, logs `attendance_party_renumbered`), rehearsal-first repair with an explicit confirmation dialog. Apply is never automatic and stays disabled until a rehearsal has run and no duplicate positions remain. Verified: rehearsal run twice gives the same result; no console errors.
- Presence log now lists each companion as their own row tagged "With <main visitor>", from canonical attendance, falling back to saved companion names for older arrivals. CSV export gained a "With" column.
- Visitor CSV export writes one line per person, companions tagged with who they arrived with.
- Companions can be badged individually from the Visit List (desktop row and phone card), showing their own name.
- Visitor history is now explicitly scoped to the current site (legacy site also matches unassigned records).
- Check-in field configuration changes (create / edit / delete, including companion fields) are written to the audit trail.
- No unique index on `(visit_id, companion_index)` yet: it is only safe once every site reports zero duplicate positions. Current sites report zero, but historical reconciliation has not been applied, so the index is deliberately deferred.
- Historical reconciliation has NOT been run. The legacy "Unassigned" site still holds older arrivals with companions that are only counted. An administrator must rehearse and apply per site.
- Security linter: 54 warnings (was 51). The 3 new ones are the new administrator-only routines, which check `settings.administer` internally before doing anything.
- Prototype limits: badge printing is browser print only; the profile history view still reads the older visitor record (kept in step by the attendance mirror); none of this constitutes production compliance evidence.

## Phase 8B-1 — Configuration-aware main visitor form (complete)
- `src/lib/checkInFields.ts` is the single resolver for "what does this site ask?" — label, help text, input type, requiredness, editability, ordering. First name and surname are always asked and always required.
- Reception check-in (`StepDetails` / `useCheckInFlow`) and the kiosk (`KioskCheckIn` / `useKioskCheckInFlow`) both build the details step and its validation from that one resolver, so they cannot drift apart. The kiosk's old hard-coded Email/Mobile fallback is gone.
- Switched-off details are not shown, not validated and not written to the arrival record (email, mobile, address are cleared at save). Values captured before a field was switched off remain on the stored record and stay visible on the profile.
- Required configured fields block Continue with a field-specific message.
- Companion fields keep their existing path; screening rules, companion identity and profile changes are out of this slice.
- Tests: `src/test/checkInFields.test.ts` (8 passing) covers email disabled, address disabled, required mobile, type-specific fields, and no optional fields. Typecheck and build pass; live check confirms a visitor is asked only for name, mobile and comments.

## Phase 8B-2 — Configurable screening outcomes and settings enforcement (complete)
- `src/lib/screeningPolicy.ts` is the single rule for whether a site asks a person type check-in questions, vaccination details and a privacy acknowledgement. Reception and the kiosk both read it, so they cannot drift apart. Switched off means: no step, no validation, nothing new written.
- Reception no longer invents fever/cough/consent questions when none are configured, and no longer forces the privacy step. Answers saved before a change stay readable and old arrivals are never re-judged.
- Each check-in question can now carry optional rules: the expected answer, answers that raise a concern, how serious it is (for information / warning / critical), a message for staff, and what happens (record only / warn staff / block the sign-in). Questions with no rules behave exactly as before. Editable in Settings > check-in questions under "What happens with a concerning answer".
- `src/lib/screeningOutcome.ts` works out one clear result per arrival (clear / flagged / blocked). Only the result and the question reference plus severity are stored (`visitors.screening_outcome`, `visitors.screening_flags`) — the answers themselves are not duplicated. The 37.8 degree temperature limit is unchanged.
- A blocked sign-in stops at reception. A supervisor with the administer-settings and screening permissions can approve it with a written reason of at least 10 characters, recorded through the server-side routine `override_screening_block`. The kiosk has no override and directs the person to a staff member.
- Configuration changes to check-in questions, vaccination fields, check-in fields and the screening / privacy / person-type settings are now recorded by the database itself, with who, when, before and after, and a reason where one is given. The old browser-side recording was removed, so there is exactly one record per change (verified live).
- Check-in step numbers now follow the steps actually shown.
- Tests: `src/test/screeningOutcome.test.ts` (11 passing) covers switched-off policy, no configured step, questions without rules, warning/flag, critical/block, several questions at once, missing answers, record-only, and temperature. Full suite 20 passing; typecheck and build pass; live check-in screen verified.
- Security linter: 56 warnings (was 54). The 2 new ones are the supervisor-approval routine and the audit helper; both refuse to act without the right permission and are not callable anonymously.
- Prototype limits: rules are per question, not per site (a question belongs to a person type); severity wording is staff guidance only; none of this is production compliance evidence.

## Phase 8B-3 (slice 1) — Canonical accountable-person reader and consumer cutover (complete)
- `src/lib/accountablePeople.ts` is the one read model for "who was actually here": one row per person (the person who signed in, plus each companion), never merged by name, email, phone or personal code. Two people with no contact details recorded stay two rows.
- Attendance records win. An arrival with no attendance records falls back to the saved visitor record and its saved companion names, and is labelled "older record" so the evidence quality is obvious. Headcount-only arrivals still show one row per person, read-only.
- `src/hooks/useAccountablePeople.ts` applies the current site (legacy site also matches unassigned records).
- Visit List rows and phone cards, badge printing and the visitor CSV export all read through the shared model. Companion badges now print a "With <main visitor>" line. The CSV gained a "Record" column (attendance record / older record).
- Visitor history now looks for the person's attendance records first and shows every visit they were on, whether they signed in themselves or came with somebody else; the older name/phone match is only used when there are no attendance records.
- Companion-only sign-out is unchanged and is only offered where an attendance record exists; older companion lines are read-only, with no "add name" action.
- Nothing was written, merged, renamed or reconciled. No schema, access-rule or settings change.
- Tests: `src/test/accountablePeople.test.ts` (7 passing) covers two blank-contact arrivals, primary plus companions, companion-only sign-out, attendance-versus-older fallback, site isolation, export row counts and no merging. Full suite 27 passing; typecheck and build pass; live Visit List verified (companion shown as their own line "With Adam John").
- Still open: the wider profile foundation, contractor profile view, weekly report, kiosk binding, contractor verification queue and historical reconciliation apply.

## Phase 8B-3b — Visitor and contractor profile foundation (complete)
- The profile page is now one ordered story: who this is and where they are, what needs attention, this visit, details, visit history, activity. Everything below "this visit" is collapsed until asked for. Route, navigation and reception actions (check out, check in again, badge, feedback, edit, export, delete) are unchanged.
- `src/lib/profileSections.ts` composes the sections from data already loaded — nothing is written, created or repaired. Covered by `src/test/profileSections.test.ts` (17 passing).
- Needs-attention items are words plus a Lucide icon, never colour alone: restricted access, watchlist, screening warning, screening block, keys held or overdue, contractor documents outstanding.
- Companions come from canonical attendance: each shows their own arrival and departure time, "With <main visitor>", and a sign-out button only where an attendance record exists. Older companion lines are read-only and marked "older record".
- Contractor profiles show company, work type, work location, screening result and a read-only compliance document list (`ContractorCredentialSummary`) built from the existing credential tables. No uploads, no confirmations, no queue, and no new contractor, supplier or person records.
- Details follow the check-in field configuration for that person type. A switched-off field is never shown as current; a value kept from before the change appears only in the collapsed "Historic information no longer collected" block, visible to administer-settings holders.
- Screening detail needs the screening permission, keys need the keys permission, contractor documents need the contractor documents permission, activity needs the export permission.
- Activity is built from this person's own arrivals at the current site. The audit log itself carries no site column, so it is deliberately not shown on the profile; the audit page remains the place for it.
- Visit history is paged 20 at a time.
- No schema, migration, access-rule, RPC or seed-data change.
- Verified live (signed in): visitor with a companion at Riverstone shows "Came with Adam" and a sign-out button; a contractor shows company/work fields, "Documents outstanding" and read-only document states; opening another site's person shows "Visitor not found". Full suite 44 passing; typecheck and build pass.
- Prototype limits: a profile only resolves for records the visit list loads (today's arrivals and anyone still on site), so an older visit opened directly reports "not found" — unchanged from before this stage. Food register context matches on the recorded name for non-residents. Keys are matched through this person's own arrivals at the current site rather than a key-level site filter. Contractor company shows only where a supplier is linked on the arrival. None of this is production compliance evidence.

## Phase 8C Part 1 — Visitor Report screen and exports (complete)
- New Reports card and route `/reports/visitor-report`. Nothing else in navigation moved.
- Defaults to the current Monday–Sunday week worked out in the site's own time zone, with previous/next week and an optional custom date range capped at 31 days (the end date is shortened and the screen says so).
- Users with more than one site get a site picker on the report only; it does not change the site selected everywhere else. Single-site users see their current site.
- Attendance records are authoritative. A saved visitor record is used only where that visit has no attendance record, and every such line reads "Older record".
- One line per accountable person per visit. Companions have their own line, their own arrival and departure, and read "With <main visitor>".
- "Still on site" (arrived today, no sign-out) is never confused with "No sign-out recorded" (arrived on an earlier day, never signed out).
- Search, person-type filter, missing-sign-out filter, four totals, an empty-week message, and 100 lines at a time with "Show more".
- CSV and print (browser print to PDF) are available only with the export permission, and both carry site, period, time zone and generated-at.
- The check-in question column shows a status only (Clear / Needs attention / Blocked) and only for staff with the screening permission. Answers, temperatures and vaccination details are never included anywhere in this report.
- `src/lib/weeklyReport.ts` is the one composition used by the screen, the CSV and the printable page, so the three cannot disagree.
- Tests: `src/test/weeklyReport.test.ts` (16 passing) covers week boundaries and time zones, the 31-day cap, companions, still-on-site vs missing sign-out, legacy marking, canonical taking precedence, unnamed companions, site isolation, empty weeks, screening permission gating, filters and export shape. Full suite 60 passing; typecheck and build pass; live check verified on a real week.
- Prototype limits: attendance-record rows carry no screening status of their own yet, so the check-in question column reads "Not recorded" for them; sites with no time zone recorded fall back to the device time zone with a visible note; the report reads at most 2,000 rows per period; "printable PDF" is the browser's own print dialog.
- Not in this slice (Phase 8C Part 2): weekly email subscriptions, recipients, scheduled sending and delivery records. No sender domain is configured for this project, so no email can be sent until the customer sets up a domain they own.

## Phase 8D — Kiosk devices set up by staff (complete)
- A tablet no longer decides which site it belongs to. `?site=...` and the old remembered site value are gone; the site now comes from the device itself, worked out on the server on every request.
- Staff add a kiosk in Settings > Governance > Kiosk devices for the site they are working in, give it a friendly name and receive a 12-character setup code. The code is shown once, can be used once, and lasts 15 minutes.
- The tablet asks for the code once. In exchange it stores an opaque device key in IndexedDB, falling back to browser storage on older devices. Clearing storage sends the tablet back to the setup screen — it never picks another site.
- Setup codes and device keys are stored only as hashes. Neither ever appears in the activity records, the address bar or ordinary screens. Device keys last 365 days.
- Staff can rename, issue a new code, pause, resume, turn off and replace a kiosk, and see status, last seen, last check-in and app version. Every one of those actions is written to the kiosk activity records and the audit log.
- Every kiosk read and write (check-in, sign-out, on-site list, resident/staff/company/contractor lookups, watchlist, returning visitors, key holds, resident leave and return, emergency roll call and marking) now goes through device-bound functions that ignore any site sent by the tablet. The old site-taking versions are no longer available to unauthenticated devices.
- Invalid, paused, turned-off or expired keys fail closed with a plain "Kiosk unavailable" screen; a network problem keeps the bound site and shows the existing offline behaviour. Repeated bad codes are rate limited.
- Check-in questions, privacy, vaccination and companion behaviour from Phase 8B are unchanged, and a kiosk still has no supervisor override.
- Tests: `src/test/kioskDevice.test.ts` (6 passing) covers a fresh tablet being unset, remembering its site, returning to setup when storage is cleared, and every refusal reason. Database checks confirmed activation, refused replay, refused unknown code, refused paused and expired keys, site derived from the device, hashed key storage and no code in the activity records. Full suite 66 passing; typecheck and build pass. Live check: an unset kiosk with a false site in the address bar showed the setup screen, accepted the code, bound itself to its real site and loaded that site's on-site list.
- Prototype limits: the device key sits in ordinary browser storage, so a tablet with no device management or kiosk lock can still have it copied off — real deployments need managed devices. The separate public check-in link still uses the older site-in-the-link flow. Setup codes are read out by staff rather than scanned. Clock skew is handled only by server-side times. The database advisor still reports the expected warnings for functions kiosks must reach without signing in. None of this is production security or compliance evidence.

## Phase 8E — Contractor document verification (complete)
- Documents supplied by a contractor or their company are now evidence awaiting a decision. Nothing counts as verified until an authorised reviewer says so — there is no automatic and no silent approval.
- New records: `contractor_documents` (one current version per site, per document type, per holder, with earlier versions kept as superseded), `contractor_document_reviews` (append-only decision history: who, when, reason, notes) and `contractor_document_requirements` (what each site insists on).
- Files stay in the existing private storage area under a site-first path. Reading a document produces a link that dies after 120 seconds and is only issued to staff with the contractor documents permission who work at that site. There are no public links, and paths never appear in the activity records.
- New screen: Reports > Contractor documents. Filters by status, document type, how long it has waited and free text; one document is decided at a time. Approve, reject or mark not required; a rejection needs a reason or notes. No bulk approve.
- Settings > Compliance now has "Contractor document rules": per site, per document type — required or not, grace period in days, and whether an outstanding document stops work or only flags it. Everything starts switched off, grace 0, and background or health evidence stays inactive until the operator turns it on.
- The contractor profile list is read-only and shows the server's own verdict, so it can no longer disagree with what happens at the desk. Reception check-in and kiosk contractor check-in both ask the server for that same verdict; a blocked verdict cannot be cleared by anything the tablet or browser sends.
- Site isolation, existing permissions (`contractor.credentials.view` / `.manage`), audit logging of submission, viewing, decisions and rule changes all reuse the existing patterns. No document contents, file paths or links are written to the audit trail.
- Tests: `src/test/contractorDocuments.test.ts` (16 passing) covers pending never counting as verified, approve, reject, supersede, expiry and grace boundaries, missing, not required, reviewer decision rules, queue filters and age, and path secrecy. Full suite 82 passing; typecheck and build pass.
- Live check on the real database: required document missing blocks; awaiting review still blocks; approved clears; expired blocks; a grace period keeps it covered; a resubmitted version returns to awaiting review while version 1 is kept as superseded; a rejection blocks again; the same person at another site is unaffected by that site's rules. Every test record was removed afterwards and the audit trail contains no paths or file names.
- Prototype limits and decisions the client must make: no reminder emails in this phase — reviewers must open the queue; expiry checking happens when a status is read, not on a schedule; no OCR, no external contractor portal and no automatic import of documents; retention and deletion of stored files still follow the existing retention settings and are not yet document-type specific; supplier (company) documents are shared by that company across the sites the reviewer can see, which suits a single operator but not shared contractors across separate organisations; whether police or background checks and vaccination or health evidence may lawfully be collected, how long they may be kept, and whether an outstanding document blocks or only flags a contractor are configuration choices for the operator and are deliberately not hard-coded; the database advisor still reports the pre-existing warnings for functions that kiosks reach without signing in. None of this is production security or compliance evidence.
