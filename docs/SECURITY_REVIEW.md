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
2. Phase 9A continuation (22 October 2026): name-only returning lookup now returns a masked mobile hint and suppresses email, address, destination, resident identifiers, reusable QR and visit metadata. Both compatibility and new device-bound RPCs use the protected projection. Authenticated live checks verified name-only, valid-name/invalid-code, mobile, QR, cross-site and invalid-device cases; the card-to-check-in prefill flow was checked in the UI. Residual risks remain: name recognition reveals a previous visit, and a mobile match (inherited minimum six digits) is not proof of ownership or OTP verification. An independent privacy/security assessment is still required.
3. Real retention periods, controller and privacy-officer details are unset.
4. No email/SMS delivery exists; notifications are in-app and audit only.
5. ~~Kiosk devices are not bound to a site~~ — superseded by Phase 8D device binding (`kioskd_*` functions take a device token and resolve the site server-side). Not independently re-tested.
7. Linter now reports roughly 105 findings (was 43 at this review); not yet re-classified.
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
- Kiosk site binding is `?site=` plus device memory. Pilot-grade only, not production-grade; production requires an administrator-provisioned, cryptographically bound kiosk device credential. Also requires an
  administrator-provisioned, cryptographically bound device credential before wider rollout.
- `kiosk_resident_directory` / `kiosk_staff_directory` are not yet site-parameterised.
- Database linter baseline is now 47 warnings: 1 public extension, 17 anonymous-callable
  SECURITY DEFINER functions (the intentional kiosk surface, now including `kiosk_log_event`) and
  29 signed-in SECURITY DEFINER functions. No new class of warning was introduced.

## Phase 7B hardening — site-scoped kiosk directory helpers

Five anonymous kiosk helpers were recreated with an optional site parameter, fixed `search_path`,
explicit `REVOKE`/`GRANT`, input validation and minimum response fields:
`kiosk_resident_directory(text, uuid)`, `kiosk_staff_directory(text, uuid)`,
`kiosk_supplier_directory(uuid)`, `kiosk_contractor_lookup(text,text,text,text,uuid)` and
`kiosk_watchlist_check(text,text,uuid)`. Old unscoped signatures were dropped. Records with no site
are returned only for the original legacy placeholder site. No tables or broad RLS policies changed.

Security linter after this change: 47 warnings — 1 extension in public, 17 anonymous-callable
SECURITY DEFINER functions (the intentional kiosk surface), 29 signed-in-callable SECURITY DEFINER
functions. Unchanged from the Phase 7B baseline.

Residual: kiosk device/site binding is pilot-grade; contractor credential verification is manual;
browser exports are not tamper-evident.


## Phase 7C — person types, volunteers and group arrivals

- Schema change was additive only: optional group, organiser, terms-confirmation, volunteer and
  "other reason" fields on the existing check-in record, plus an inactive "Other" person type.
  No new people, resident, staff or group model was introduced.
- The new fields are written only by signed-in staff. The kiosk path is unchanged and still writes
  through the restricted check-in function, so anonymous access was not widened.
- Group arrival is behind the existing check-in permission and the existing site scoping. Every
  attendee is stored as their own accountable record; the shared group reference is a label only.
- Each adult attendee confirms the terms themselves. An organiser may confirm on behalf of an
  assisted or child attendee only when a site switches that on, and it is recorded and labelled as
  organiser-declared rather than as the person's own confirmation.
- Group sign-in now waits for the site to be known before saving, so records cannot be stored
  without a site.
- Security linter after this phase: 47 warnings, unchanged in category and count from Phase 7B
  (1 extension in public, 17 anonymous-callable and 29 signed-in-callable definer functions).


## Phase 7D — emergency mode

- Emergency events and roll-call lines are always stamped with the current site; a database trigger fills the site on any roll-call line created without one. Event lists and evacuation history are filtered by the current site.
- Entry to the emergency screen is visible to signed-in staff; activating, recording outcomes, correcting, closing and exporting remain permission-gated, and users without those permissions see a read-only explanation.
- Closing a live emergency requires a written outcome and an explicit confirmation. Closed events stay immutable through the existing database guard; queued offline outcomes for a closed event are discarded rather than reopening it.
- The offline retry queue stores only a roll-call line reference, event reference, chosen status and timestamp. No names, phone numbers, room details, assistance levels or clinical notes are written to browser storage.
- Security linter total unchanged at 47 warnings: 1 public extension, 17 anonymous-callable SECURITY DEFINER functions, 29 signed-in-callable functions.

## Phase 7E — settings consolidation and configuration previews

No database migration, RLS change, permission change or settings-value change was made in this phase.

Access control
- Settings sections are gated by the existing granular permissions: `settings.administer` for most sections,
  `privacy.manage` for privacy and retention, `keys.manage` for the keys and fobs policy. No permission was
  widened and no new permission was added.
- Without the permission, values are visible and controls are disabled, with the reason stated on screen.
  This is a presentation gate; the database policies remain the enforcing layer.

Scope and storage
- Scope labels now describe how a value is actually stored. Values written with a site suffix are labelled
  "This site"; flat values shared across the account are labelled "All sites". No screen shows an inherited or
  overridden state, because no visible setting currently resolves through the scoped-settings table.

Audit coverage (gap stated openly)
- Writes an audit entry: visitor types, operating context, keys and fobs policy, kiosk staff code, privacy and retention.
- Does not write an audit entry: person-type check-in fields, check-in questions, vaccination fields, companion fields,
  photo and signature, terms per type, alerts, automation, returning visitors, resident privacy, staff privacy,
  resident leave, return notifications, food register, contractor enforcement, contractor questions, presence,
  printing and feedback surveys.
- No screen states or implies that a change is audited when it is not. Broadening audit coverage remains open work.

Previews
- Previews are read-only and use sample details only. The badge preview renders through the same code path as
  printing, with the automatic print call removed. No real person's data is used and nothing is written.

Unreachable screens
- Ten settings components remain in the project but are not reachable from Settings: Alerts, Automation, Health screening,
  Auto checkout, Feedback settings, Profiles and badges, Terms and conditions, Notifications, Leave approval and
  Site documents. Each is marked in the file as not in use. Their controls are covered by the per-visitor-type screens,
  except leave approval, whose overlap with the resident leave screen was not conclusively verified — it is therefore
  preserved rather than removed.

## Phase 7E hardening — settings access boundary
- The database remains the real boundary: RLS on `settings` accepts insert/update/delete only
  from the administrator role; signed-in staff may read settings.
- The app-level permission checks (`settings.administer`, `keys.manage`, `privacy.manage`,
  `data.export`) are a presentation gate that prevents confusing failed writes. No new
  permission, migration or RLS change was introduced in this pass.
- A shared read-only fence disables all controls in a section for users without its permission.
  Values stay visible. Panels open by default when read-only so nothing is hidden.
- Audit gap unchanged: only some settings sections write an `audit_log` entry on save
  (keys and fobs, operating context, kiosk staff code). Presence, printing, governance and
  integration saves are not yet audited.
- Save handling no longer reports success after a partial failure in Presence, Printing,
  Keys and fobs, Users and access, and Integrations.
- Known wording exception outside this pass: Resident leave types keep a user-entered symbol
  field (an icon character stored with each leave type). Changing it would alter stored data,
  so it was left as-is and is recorded here rather than silently changed.

## Phase 9C — emergency evidence boundary (25 October 2026)

This section supersedes earlier claims that a presence list proves who is physically on site,
that all non-unaccounted statuses are accounted for, or that device validation alone isolates emergency RPCs.

- Nullable evidence columns preserve legacy rows without invented verification. Physical safety requires a qualifying method; reported safety and confirmed absence have separate counts. Assistance/not-located remain outstanding.
- Server triggers validate site consistency, emergency.mark_safe, outcome/status/method combinations, corrections, confirmation actor, future timestamps and closed-event immutability. Audit inserts are atomic with attendance changes, including evidence-only changes.
- Restrictive authenticated policies constrain attendance writes, event writes and audit reads to permissions/sites. Existing table grants are not broadened. PIN-only rollcall/mark/progress execution is revoked for PUBLIC/anon/authenticated; bound device wrappers constrain attendance/event site.
- Shared PIN emergency access intentionally returns minimal response fields, including assistance level but no safeguarding flags. It identifies an authorised PIN operator, not a verified individual. Server actor UUID is authoritative for signed-in staff; kiosk actor remains “Kiosk (PIN)”. No device UUID is captured in outcome audit yet.
- Offline queue includes only identifiers, outcome/method/time and operator UUID. Evidence replay requires the same signed-in operator; closed writes are rejected. Unsynchronised outcomes are not counted as authoritative safety.
- Inventory found a pre-existing PIN-denial durability concern: denied logs written before a raised exception may roll back, defeating persistent lockout counts. Earlier claims of verified rate limiting are withdrawn pending repair and live verification.
- Report regulatory wording now references Aged Care Act 2024 / strengthened Standards effective 1 November 2025 for AU RAC; AU village and other UK nation caveats are separate. Reports do not assert legal compliance.
- Schema application verified; 141 historical attendance outcomes remain NULL. 178 unit tests passed; harness build/typecheck passed. Public unbound kiosk gate checked on desktop/mobile, not the bound PIN workflow.
- Authenticated mutation, multi-site denial, correction audit and close/replay read-back remain unverified: session mint found no matching requesting-user account. No emergency was created for verification. Activation/snapshot and closure/general-audit are still non-atomic multi-request workflows; later arrivals require explicit recording.

## Phase 9E-B / 9F-2b — visitor checkout privacy (27 October 2026)

This supersedes earlier claims that client-side search-first masking protects a
downloaded visitor directory. The applied device-bound checkout functions return
no candidate identities for names; code verification alone permits scoped canonical
party selection. UUID-only visitor sign-out is disabled. Resident-only compatibility
remains deliberately separate; overall public kiosk resident privacy is **not** resolved.

Audit, compatibility mirror and selected canonical departures are atomic, including
idempotent retries. No existing records were changed for verification. Grants,
contracts, caller inventory, exact files and independent limits are in
[`KIOSK_CHECKOUT_REVIEW.md`](./KIOSK_CHECKOUT_REVIEW.md).

No standard backend rate limiting is available; no ad-hoc limiter was introduced
without confirmation. Uniform name responses prevent name enumeration, not code
brute-force or bearer-credential abuse. Actual SQL tests use isolated PostgreSQL
and a stub device guard; mocked browser success is not live device/UAT evidence.
