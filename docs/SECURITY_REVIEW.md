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
