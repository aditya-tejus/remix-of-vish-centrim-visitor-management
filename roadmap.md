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

## Phase 7C — person types, volunteers and group arrivals (in progress)
- [ ] Type chooser skipped when only one type is enabled; fixed order; "Other" off by default
- [ ] Volunteer role, supervisor and expected finish (site-configurable, optional)
- [ ] Group arrival: organiser (name and contact required) plus individual attendee records
- [ ] Each adult attendee confirms terms themselves; organiser-declared only for an assisted/child process, clearly labelled
- [ ] Partial save with retry and no duplicates; late attendees join the same group
- [ ] Independent attendee checkout; group checkout at the front desk only
- [ ] Group-aware visit list, overdue, badges, roll call, reports and audit
