# Security review — Stage 5 hardening pass

Last reviewed: 8 September 2026. This is an internal engineering review of a prototype.
It is **not** a legal or independent security assessment, and the product is **not**
production-ready while the items under "Open blockers" remain.

## 1. Database linter status

Total warnings: **43**

| Type | Count | Classification |
| --- | --- | --- |
| Extension in public schema (`pgcrypto`/`pg_*`) | 1 | Accepted — platform-managed, used only by `crypt()`/`gen_salt()` inside SECURITY DEFINER functions |
| Anonymous can execute SECURITY DEFINER function | 15 | Intentional kiosk API surface (list below) |
| Signed-in user can execute SECURITY DEFINER function | 27 | 15 kiosk functions (also usable by staff app) + 12 staff helpers |

Default `PUBLIC` execute was revoked from **every** function in `public`; each function is
now granted only to the roles that need it. Unused `kiosk_prefill_visitor` (name → contact
details) has had all app grants removed.

Verified by anonymous REST calls: `evacuation_drills`, `evacuation_attendance`,
`emergency_actions`, `visitors`, `resident_details`, `contractor_credentials` all return
`401`. `settings` is readable by the kiosk but a policy now excludes any key containing
`email`, `recipient`, `phone`, `contact` or `pin`.

## 2. Anonymous kiosk functions — threat model

Threat model: the kiosk runs unattended in a public foyer. The anon API key is
extractable from the device, so every anon function is treated as internet-exposed.
Each one is `SECURITY DEFINER`, has `SET search_path = public`, validates its inputs,
returns a fixed narrow column list, and is row-capped.

| Function | Returns | Why it is acceptable |
| --- | --- | --- |
| `kiosk_check_in(jsonb)` | new visit id + badge QR | Write-only; validates type and mandatory names; cannot set holds, compliance status or another site's data implicitly |
| `kiosk_check_out(uuid, timestamptz)` | boolean | Only flips an already checked-in row to checked-out; discloses nothing |
| `kiosk_presence_list()` | name, type, status, times, host, group, QR | Needed for self check-out. No contact details, health answers, holds or clinical data. Capped at 500 |
| `kiosk_resident_directory(text)` | first/last name, room, area, status | Gated in the UI by the resident privacy setting (search-first). No contacts, DoLS, mobility or care data |
| `kiosk_staff_directory(text)` / `kiosk_supplier_directory()` | name, department / company name | Destination pickers only; no phone or email |
| `kiosk_returning_lookup(...)` | one prior visit's contact + host details | Requires QR, full mobile (≥6 digits) or exact first **and** last name; single row. Residual risk: a known name returns that person's own contact details — accepted for prototype, flagged for review |
| `kiosk_contractor_lookup(...)` | person, supplier, outstanding credential labels | Labels only — never documents, references, expiry files or verification notes |
| `kiosk_watchlist_check(text,text)` | boolean + alert type | Deliberately returns no reason, instruction, photo or safeguarding narrative |
| `kiosk_resident_leave` / `kiosk_resident_return` | boolean | Movement only, resident rows only |
| `kiosk_pin_is_set()` | boolean | Reveals only whether a PIN exists |
| `kiosk_emergency_rollcall/progress/mark(p_pin …)` | roll call minimum fields | PIN-gated, rate-limited and logged (below) |

Not granted to anon: `kiosk_emergency_gate` (internal), `kiosk_prefill_visitor` (removed),
`run_retention`, `effective_retention_policy`, `set_kiosk_pin`, `log_audit`,
`record_privacy_ack`, `resolve_setting`, all RLS helpers and all trigger functions.

## 3. Kiosk emergency access model

- **Chosen model: shared site PIN, deliberately.** In a real evacuation staff cannot be
  expected to type an email and password on a foyer screen. The PIN is bcrypt-hashed
  (`kiosk_security`), set only by an administrator, and is **not** the only control:
  - the kiosk can only *read and mark* a roll call — it cannot activate, pause, resolve,
    review or export an emergency;
  - the returned fields are limited to name, type, location label, contact phone,
    status, assistance level and timestamp — no safeguarding notes, no DoLS/risk flags,
    no medication or care detail, no contractor credentials;
  - every attempt (granted, denied, locked out) is written to `kiosk_access_log`;
  - **rate limiting:** 5 denied attempts within 15 minutes locks the emergency functions
    and records a `locked_out` event;
  - each mark is attributed (`Kiosk (PIN)` or a typed name) in `emergency_actions`.
- **Residual risk:** anyone holding the PIN can see who is on site during an active
  emergency. Accepted for life-safety reasons; mitigated by audit and PIN rotation.
- **Printed fallback** is described in the kiosk as a printed roll call sheet to use when
  the system is unavailable. It is a configured fallback and is *not* synchronised —
  anything marked on paper must be re-entered on the staff computer.

## 4. Retention and holds

- Policies live in `retention_policies`, one row per record class, `branch_id NULL`
  meaning "all sites"; a site row overrides it.
- `effective_retention_policy(record_class, branch_id)` resolves site → all sites and
  reports the scope it used; the settings screen shows the scope on each rule.
- `run_retention(record_class, branch_id)` requires the `privacy.manage` permission,
  checks site access, skips every record with `legal_hold` or `safeguarding_hold`,
  writes a `retention_runs` row (including the scope) and an audit event.
- Automated handlers exist for **visits** and **food register** only. Every other class
  is labelled "Manual process only" or "Not supported yet" in the UI.
- **No legal retention periods are supplied.** All values start empty and disabled.

## 5. Open blockers (must be resolved before any real deployment)

1. Independent security and privacy review has not been done.
2. `kiosk_returning_lookup` name-only path still returns a returning visitor's own
   contact details; consider requiring mobile or QR at sites with higher privacy needs.
3. Real retention periods, controller and privacy-officer details are unset.
4. No email/SMS delivery exists; notifications are in-app and audit only.
5. Kiosk devices are not bound to a site by a device credential (`?site=` only).
6. Emergency exports rely on browser print/CSV; no tamper-evident export format.

## 6. Contractors and the keys / fobs register (Stage 6A)

- **Action permissions.** Nine new permissions gate this area: `contractor.view`,
  `contractor.manage`, `contractor.credentials.view`, `contractor.credentials.manage`,
  `keys.view`, `keys.issue`, `keys.return`, `keys.manage`, `keys.export`. The register
  shows a permission-denied panel to anyone without `keys.view`, and every action button
  is gated by its own permission rather than by a broad "staff" role.
- **Site isolation.** `property_keys` and `key_issues` carry `branch_id`; policies require
  both the permission and `user_can_access_site(branch_id)`. The app filters reads by the
  current site and stamps new rows with it.
- **Credential policy is the operator's, not the law.** The credentials a site insists on
  are stored per site in `contractor_mandatory_credentials@<site>`; wording throughout the
  settings screen states these are the operator's own policy choices. Nothing is presented
  as a legal requirement in either jurisdiction.
- **Contractor evidence.** Supplier and person credential rows are now readable only with
  `contractor.credentials.view` and writable only with `contractor.credentials.manage`;
  person credentials additionally require access to that person's site. The kiosk may only
  insert a self-uploaded credential with `verification_status = 'pending'` — it cannot
  read, verify or amend evidence.
- **Kiosk and keys.** The kiosk has no access to the keys tables. Check-in and check-out
  call `kiosk_open_key_holds(p_person_qr)`, a SECURITY DEFINER function that matches a
  person code and returns two numbers — open items and overdue items. It never returns key
  labels, properties, holders or dates. Verified: both kiosk screens now make no denied
  requests to `property_keys` or `key_issues`.
- **Audit.** Adding, issuing, returning, extending, reporting lost and reporting damaged all
  write an `audit_log` entry naming the staff member, the item and any reason given.
- **Not covered.** Nothing verifies that a credential document is genuine; expiry dates and
  references are staff-entered. Replacement items inherit no serial number by design.

## Stage 6B additions

- Badge printing records `badge_issued` / `badge_reprinted` / `badge_voided` in `audit_log`
  with visitor id, person type and site. The site setting `badge_show_destination` removes
  the resident name and room from printed badges where privacy requires it.
- All CSV exports added in this stage (`operations`, `food_register_export`,
  `keys_register_export`) go through `exportCsvAudited`, which records the action, site,
  scope note and row count. Exports remain browser downloads and are not tamper-evident.
- Food register reads and writes are site-scoped; rows created before site scoping have a
  null site and remain visible to avoid silent data loss.
- Notification delivery state is explicit and honest: no external channel is configured, so
  the only reachable state is "In-app only". No delivery is claimed anywhere in the UI.
- Anonymous kiosk requests were re-checked after these changes: the kiosk check-in route
  reads only `settings` and the narrow kiosk RPCs; it does not read `key_issues`,
  `property_keys` or `food_register` directly.
- Linter unchanged from the Stage 6A baseline: 45 warnings (1 extension in public,
  16 anonymous SECURITY DEFINER kiosk functions, 28 signed-in SECURITY DEFINER functions).

## Stage 6C — pilot readiness review

### Fixed in this stage
- **Anonymous settings read closed.** `settings` carried an unrestricted public SELECT
  policy that ORed away the narrow kiosk filter, so an unauthenticated client could read
  every setting row including notification recipients. Public SELECT is now removed;
  signed-in staff read all settings, and the kiosk keeps only its narrow non-contact
  policy. Verified anonymously: 44 keys returned, none matching email / recipient /
  phone / contact / pin.
- **Anonymous configuration writes removed.** INSERT / UPDATE / DELETE policies and table
  privileges for `anon` were dropped on `health_questions`, `form_fields`,
  `vaccination_fields`, `feedback_questions` and `feedback_surveys`. Verified: anonymous
  insert and delete now return HTTP 401 / `42501 permission denied`.
- **Contractor answers.** The public read policy on `contractor_question_answers` was
  replaced with an authenticated-only policy. Verified anonymously: empty result.

### Verified by test in this stage
- Kiosk check-in end to end (type, destination, companions, screening, terms, confirm)
  writes one visitor row stamped with the current site; no failed backend requests.
- Kiosk check-out by name completes and sets `status = checked-out` with a timestamp.
- Kiosk still functions with the tightened policies — question and field configuration
  still loads anonymously (read-only).
- Site scoping in `useVisitors`: non-legacy sites filter strictly on `branch_id`; the
  legacy site additionally includes null-site rows so pre-site data is never orphaned and
  never appears under a newer site.
- Responsive review at 390px: Visit List, Today, Settings, Keys, People, Residents,
  Food Register, Evacuation and On-site report all have zero horizontal overflow.
- Temporary test records purged; `visitors` count for the test surname is 0.

### Still true and not fixed
- Browser CSV exports are not tamper-evident.
- No email, SMS, push or Teams channel is configured; all alerting is in-app only.
- Contractor credential documents are verified manually by staff; nothing checks
  authenticity or expiry against an issuer.
- Kiosk devices are not individually credentialled or bound to a site.
- Retention periods and data-controller details are operator inputs; none are invented and
  no jurisdiction period is asserted by the product.
- Broad legacy public read policies remain on reference tables (`branches`, `person_types`,
  `wings`, feedback configuration). These carry no personal data and are required by the
  kiosk before sign-in.

### Stage 6C recovery pass — closed emergency records

A gap was found and fixed: the roll call of a closed emergency was already immutable
(`trg_guard_closed_emergency` on `evacuation_attendance`), but the event row itself could
still be edited or reopened. `guard_closed_drill()` now runs before every update on
`evacuation_drills`: once an event is `resolved` or `reviewed`, the only permitted change
is adding the post-event review (and `resolved -> reviewed`). Reopening, retiming,
re-siting or changing counts raises an error. Verified by test: an edit to the people count
was blocked, a reopen to `active` was blocked, and adding a review note succeeded. The
trigger function is not executable by `anon` or `authenticated`; linter is back to the
documented 45-warning baseline with no new warning.

## Phase 7A verification pass (2026-09-09)

- **Resident directory site isolation (fixed).** The authenticated resident query in `src/hooks/useResidents.ts` previously returned residents from all sites. It now filters on the current site, and records with no site are visible only on the original/legacy site so they are never mixed into newer sites. This affects every signed-in surface that lists residents: check-in destination, residents, food register, keys, evacuation.
- The kiosk resident directory is unchanged and still goes through the restricted `kiosk_resident_directory` function returning name, room and area only.
- No database, policy, grant, permission or settings changes were made in this pass. Security linter remains at the documented baseline.

## Phase 7A closure verification (2026-09-09)

- **Returning-visitor lookup site isolation (fixed).** The front-desk returning-visitor search in `src/components/checkin/useCheckInFlow.ts` queried past visitors across all sites. It is now scoped to the current site, with no-site records visible only on the original/legacy site. Verified in the interface: a person known at one site returns no matches at another.
- The lookup shows name, and phone/email only where already held for that person at that site; no destination, resident or screening information is exposed at this step.
- Failure testing used browser-level request blocking in the test session only. No production code, permission, policy or server-function change was made for testing, and no kiosk access path was altered.
- Remaining limitation: this lookup matches on name and phone text; there is no verified identity check, so staff confirmation remains the control.

## Phase 7B — kiosk access review

Changes:
- `kiosk_presence_list(p_branch_id)` and `kiosk_returning_lookup(..., p_branch_id)` replaced their
  unparameterised versions. Called with the kiosk's site they return that site's rows only; called with
  no site they behave as before (legacy compatibility). Execute revoked from PUBLIC and granted to
  `anon, authenticated, service_role`, matching the existing kiosk function pattern.
- New `kiosk_log_event(p_purpose, p_outcome, p_branch_id, p_detail)` writes to `kiosk_access_log` only.
  The kiosk's direct `audit_log` insert was removed, so unauthenticated devices no longer write personal
  details into the audit record.
- Removed `src/pages/QRFastLane.tsx`: unrouted, authenticated-context duplicate that checked people in
  with `healthDeclaration: false` and no terms. Confirmed unused before deletion.
- Card/code recognition is prefill-only. Screening, terms and privacy acknowledgement remain explicit
  user actions and cannot be satisfied by scanning.

Verified by browser test (temporary records, purged afterwards):
- Unknown code, cross-site code and own-site code paths behave correctly; a Willowbrook code at the
  Riverstone kiosk is not recognised.
- Kiosk network trace during scan, recognition, check-out and check-in showed zero direct requests to
  `visitors`, `property_keys`, `key_issues`, `food_register`, `contractor_credentials`, `audit_log` or
  `resident_details`.
- Idle reset after 90 seconds returns to the attract screen and clears entered personal details.
- With `kiosk_fast_lane_enabled` off, no card option appears on home, check-in or check-out.

Known limitations (unchanged or new):
- Kiosk site binding is `?site=` plus device memory. Not production-grade; requires an
  administrator-provisioned, cryptographically bound device credential before wider rollout.
- `kiosk_resident_directory` / `kiosk_staff_directory` are not yet site-parameterised.
- Database linter baseline is now 47 warnings: 1 public extension, 17 anonymous-callable
  SECURITY DEFINER functions (the intentional kiosk surface, now including `kiosk_log_event`) and
  29 signed-in SECURITY DEFINER functions. No new class of warning was introduced.
