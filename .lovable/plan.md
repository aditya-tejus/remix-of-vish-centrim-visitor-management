# Stage 0 — Audit and Verified Baseline

No code, schema, settings or behaviour was changed. This is the verified baseline record. (Documentation file `VISITOR_MANAGEMENT_BASELINE.md` was not created because plan mode only permits writing this plan file; approve and I will save the same content as that file in Stage 0.5.)

## Executive summary

The prototype is far more real than a typical demo: ~41k lines across 5 pages groups, 49 database migrations, 35 tables, and essentially every screen reads and writes live data. There is no mock data layer, no fake persistence, and no simulated async work.

The problems are structural, not cosmetic:

1. **It is single-site.** `branches` has 0 rows, all 132 visit records have no site, `wings` is never filtered by site, and no "current site" concept exists anywhere. Every setting is one global row in a key-value `settings` table; "per person type" and "per branch" are faked by name conventions in the key string.
2. **It duplicates platform concepts.** Residents, staff, wings/stages, suppliers, contractor people, files, notifications and audit are all owned locally rather than sourced from Centrim Life.
3. **Anonymous access is very wide.** 26 of 35 tables allow unrestricted read; kiosk-facing tables (`visitors`, `contractor_people`, `contractor_credentials`, `evacuation_drills`, `evacuation_attendance`) grant anonymous access, exposing resident and visitor personal data to anyone who can reach the kiosk origin.
4. **Alerts do not leave the app.** No email/SMS/push code exists anywhere. Overdue-resident, watchlist and return notifications are in-app counters only, while the settings screens imply delivery.
5. **Only one user account exists and roles are barely enforced.** 1 row in `user_roles`; the governance/lock settings are written but never enforced.
6. **Surface area is too wide for the promise of simplicity** — 30+ routes, 5 person types, 15 settings sections, keys, food, feedback, GDPR, evacuation, coverage checklist.

## Screen inventory

Staff (all behind auth, no role gating except a few admin checks):
`/` Visit List · `/visitors` Profiles · `/visitors/:id` Profile detail · `/residents` · `/food-register` · `/keys` · `/calendar` · `/gdpr` · `/audit-log` · `/evacuation` · `/coverage` · `/settings` · Reports hub `/reports` with analytics, evacuation, presence, trends, feedback responses, feedback reports. Nine legacy routes redirect (check-in, group check-in, QR fast lane, leave requests, resident leave, dashboard, etc.).

Kiosk (public, unauthenticated): attract, home, check-in, check-out, resident leave, QR scan, staff-PIN evacuation. Plus `/public-checkin`.

Largest components (complexity hot spots): AddVisitDialog 1369, KioskCheckIn 1284, VisitorProfilePage 825, ResidentOutingDialog 765, Evacuation 737, KeysRegister 697, CheckOutSheet 651.

Settings: 5 person-type sections + 9 global sections; roughly 60 distinct keys.

## Data and integration inventory

35 public tables. Core: `visitors` (single table for visitors, contractors, volunteers, staff *and* residents — 82/31/6/3/10 rows), `resident_details`, `staff_members`, `wings`, `branches` (empty), `suppliers_min`, `contractor_people`, `contractor_credentials`, `credential_types`, `contractor_questions`/`_answers`, `property_keys`/`key_issues`, `food_register`, `evacuation_drills`/`_attendance`/`_points`, `visitor_watchlist`, `leave_requests`/`leave_types`, `resident_incidents`, `feedback_*`, `form_fields`/`health_questions`/`vaccination_fields`, `settings`, `audit_log`, `profiles`/`user_roles`, `kiosk_security`, `gdpr_requirements`, `branch_notification_settings`.

Should come from Centrim Life, not here: residents and resident clinical/mobility/DoLS data; staff directory; properties, rooms, wings/stages; suppliers and contractor workers with their compliance documents; authentication, roles and permissions; notification delivery; file storage; audit logging; next-of-kin contacts.

Two edge functions (`auto-checkout`, `cleanup-visitors`) are real, server-only, driven by pg_cron; never invoked from the app. Whether the cron jobs are actually scheduled is unverified.

## Mock and placeholder inventory

- `src/pages/CoverageChecklist.tsx` — hand-maintained internal build-status list, reachable at `/coverage`. Remove from the product.
- `DraftAcceptDialog.tsx:49` — hardcoded `imported@clinical.system` written into real records.
- Written but never read (dead settings): `printer_ip`, `print_on_checkin`, `badge_include_photo`, `badge_include_qr`, all `lock_*`, `require_change_reason`, `audit_settings_changes`, all `integration_*`, and the photo/signature enable/default keys (check-in never consults them).
- `branch_notification_settings.branch_id` is always null in practice; email recipients are captured but never used to send.
- `NotificationBell` items are non-clickable.
- Everything else checked (hooks, dialogs, GDPR erasure/SAR, screening, keys, evacuation) is genuinely persisted.

## Permission, privacy and safety risks

1. Anonymous read on `visitors` and evacuation tables exposes resident names, rooms, mobility/DoLS and contact data at the kiosk.
2. Contractor personal credential rows are anonymously accessible.
3. No tenant/site isolation: one dataset for all sites; an AU and a UK deployment could not share a server safely today.
4. `has_role` exists but almost nothing enforces it; only 1 role row exists; governance locks unenforced.
5. Kiosk PIN uses unsalted MD5 in a security-definer function callable anonymously.
6. Retention is per person type and global; legal hold exists, but erasure is column-level and unverified against evacuation/food/keys copies of the same personal data.
7. Emergency safety: evacuation depends on the same anonymous tables and on kiosk PIN; no offline fallback and no verified printed fallback roll call.
8. Overdue-resident alerts never leave the screen — a real clinical/regulatory risk if staff believe they are notified.
9. 13 outstanding backend security-linter warnings.

## UI/UX and information-architecture problems

- Too many routes and settings sections for a front-desk tool; reports split across six pages.
- One `visitors` table forced to represent five very different person types makes lists, filters and profiles ambiguous.
- Resident leave/return, keys, food and feedback each add a parallel mental model on top of check-in.
- Settings scope is invisible to the user: nothing indicates whether a change is global, per site or per person type.
- Kiosk check-in is a 1,284-line multi-branch flow — the highest-risk screen for real users.
- Duplicated actions across list, profile and checkout; dialogs and sheets are still inconsistent in places.
- Terminology differs by market (wing/stage, DBS/police check) but is only partly driven by `site_structure`/`jurisdiction`.

## Minimum safe core vs optional extensions

Core: person identification and check-in/out (visitor, contractor, volunteer, staff), companions, who they are visiting, screening questions, terms/privacy, badge, watchlist block, evacuation roll call, presence list, audit trail, retention. 

Optional extensions (later, per site): keys and fobs, food register, feedback surveys, resident leave/return, contractor credential management, printing hardware, analytics, GDPR self-service, integrations.

## Recommended staged remediation sequence

1. **Tenancy and identity model** — introduce organisation/site/area, make site mandatory on every record, add a site context, scope RLS by site and role. Blocks everything else.
2. **Lock down access** — remove anonymous reads, replace with narrow kiosk RPCs; salt/hash the kiosk PIN; enforce roles.
3. **Platform reuse** — define read-only integration contracts for residents, staff, properties/areas, suppliers, auth, files, notifications, audit; stop writing local copies.
4. **Domain split** — separate `people`/`visits`; stop storing residents as visitors.
5. **Core product reset** — rebuild check-in/out and evacuation as the minimum safe core with a single settings model that shows scope.
6. **Notifications** — real delivery through the platform, with escalation.
7. **Extensions re-added** — keys, food, feedback, leave, credentials, printing, each toggleable per site.
8. **Jurisdiction configuration** — one code base, AU/UK content and terminology by configuration.

## Explicit unknowns needing technical verification

- Centrim Life APIs available for residents, staff, properties, suppliers, auth/permissions, notifications, files, audit — and whether they are read-only.
- Whether AU/UK servers share one schema and one release, and how tenants map to sites.
- Whether pg_cron jobs for auto-checkout and cleanup are actually scheduled.
- Which identity provider will own staff login, and the real role set.
- Kiosk device identity: how a device is bound to a site/entrance.
- Email/SMS provider and who is accountable for overdue-resident escalation.
- Legal retention periods required in AU and UK, and whether erasure must cascade into evacuation/food/keys records.
- Printer models actually in use on site.
