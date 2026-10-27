# Phase 9E-B / 9F-2b — public visitor departures

## Caller inventory (before changes)

| Caller | Dependency | Cutover |
|---|---|---|
| `src/pages/kiosk/KioskCheckOut.tsx` | Public useVisitors directory, client name filter, UUID checkout | Purpose-scoped name/code hook and canonical selected-party submission |
| `src/pages/kiosk/KioskQRScan.tsx` | Same directory, local visit QR match, direct UUID checkout | Code lookup; shared visitor confirmation; narrow resident-code compatibility |
| `src/pages/kiosk/KioskCheckIn.tsx` | Public useVisitors solely for addVisitor; incidental directory/poll | Shared hook defaults to write-only public mode; payload/logic unchanged |
| `src/pages/kiosk/KioskResidentLeave.tsx` | Resident directory plus presence for away residents | Explicit residentMovement opt-in; existing movement semantics retained |
| `src/hooks/useKioskEmergency.ts` | Independent PIN/device rollcall/progress/mark RPCs | Untouched |
| Staff `useVisitors()` and presence metrics | Authenticated queries/realtime | Untouched |

`src/hooks/useVisitors.ts` was the sole application caller of `kioskd_presence_list`.
No other public-mode consumer or public presence metric was found. Kiosk suppliers,
staff/resident directories, watchlist, and check-in configuration are separate paths;
their policies and clinical/contractor configuration were not changed.

## Server boundary

- Live definitions/grants were inspected before migration. The bound directory
  exposed visitor names, identifiers, QR, destination and presence. The unbound
  directory was already unavailable to anon but still callable by authenticated.
- `kioskd_checkout_name` normalizes input, accepts 3–60 letters/spaces/name
  punctuation, and **never queries people**. Unknown, duplicate and resident names
  all return the same `staff_required` response. Candidate count is zero. Name
  input never authorises sign-out.
- `kioskd_checkout_lookup` requires a complete 12-character alphanumeric code,
  derives the site from the existing active-device guard, resolves at most two
  targets to detect ambiguity, and returns at most 50 scoped party references.
  Labels are `You` / `Companion N`, not names. No contact, address, destination,
  host, room, QR or check-in time is returned. Invalid/cross-site codes cannot
  reveal resident identity.
- A primary visitor's code authorises only their canonical visit's party members,
  not all records sharing a group label. A companion's code authorises only that
  companion. Visit and reusable person codes are supported; ambiguous identity
  or oversized party needs reception. Numbered companions intentionally avoid
  disclosure; when a person cannot distinguish them, use their own card or reception.
- `kioskd_checkout_submit` revalidates device, code, visit and every party ID.
  Visit row locking serializes concurrent submissions. It updates selected open
  canonical parties, mirrors compatibility fields under the existing sync guard,
  and inserts a device/site/party-count audit atomically. Retry of the same visit
  and selection returns saved with zero new departures, without duplicate audit.
  It never closes unselected parties. It uses server time, not client time.
- `kioskd_check_out` no longer accepts visitor UUID-only departures; resident-only
  compatibility is retained. The existing unbound presence directory is revoked
  from PUBLIC/anon/authenticated. Bound compatibility returns residents only,
  with visitor destinations/QR/group references removed.
- `kioskd_resident_code` preserves existing resident visit-code recognition without
  bulk loading. It returns only one verified resident reference, never a name or room.
- No public table grants/RLS were broadened; no tables or operational rows created
  by migrations. Internal target helper is not executable by anon/authenticated.

## Result/audit/feedback semantics

The old partial-companion branch did no server write, but advanced to success.
The old whole-departure branch ignored a false business result, and QR skipped
companion confirmation. Both visitor entry paths now use the same canonical
confirmation and require `saved: true`. Duplicate presses are locked locally and
server submissions are idempotent. Failure retains the code and selected parties.
Feedback begins only after confirmed departure and receives no visitor name.
Feedback loading/failure is distinct from departure success; no fake sent message
or webhook is reported. The new audit describes actual saved parties and
`delivery_state: not_configured`, not successful external delivery.

## Verification evidence

- Baseline: 222 tests before changes. Final results recorded in roadmap.
- Actual applied migration SQL runs inside isolated PGlite PostgreSQL, with fixture
  tables and a **stub existing device guard**. Tests exercise name normalization,
  uniform responses, code/party isolation, ambiguity, cap, grants, partial/final
  departures, idempotency and audit-failure rollback. Fixtures never touch Cloud.
- Existing live function/grant presence verified read-only after application.
- Mocked component tests cover short-name no request, stale results, invalid card,
  failure/retry answer retention, selected IDs, duplicate presses and false result.
- Playwright with every service response mocked at 390×844, 768×1024, 1024×1366:
  name assistance → valid card → only self → failed save → retained selection →
  successful retry. No directory/table visitor requests, page errors or document
  horizontal overflow; screenshots inspected. No real visitor checkout submitted.

## Independent limits — not a full kiosk security certification

1. Backend has **no standard rate-limit primitive**. No unapproved ad-hoc limiter
   was added. Name lookup is non-enumerating by construction; code endpoints still
   need durable infrastructure throttling/abuse controls. Request limits are not
   rate limits. Copied kiosk keys and known visitor cards remain bearer credentials.
2. Existing resident directory/movement rules still expose resident names and away
   state to a bound public device; this package intentionally does not alter them.
   Bound presence remains resident-only, not fully revoked. Therefore **all-public-
   kiosk privacy is not fixed**, even though ordinary visitor directories are removed.
3. Existing resident/PIN function refusal logging durability and shared-PIN risks
   are unchanged. Server tests stub device validation: missing/revoked/expiry cases
   verify delegation, not actual Cloud device lifecycle. No live cross-site checkout,
   live race, live audit write, camera hardware or assistive-technology UAT performed.
4. Legacy visits without canonical parties require reception; no reconciliation or
   sample visits created. Feedback remains a separate existing direct write and
   account-wide survey resolver, not a new site-scoped feedback service.
5. No health/settings, staff/group arrival, emergency evidence, resident leave rules,
   notifications or publication changed. Migrations apply immediately to the shared
   Cloud backend; an already-open old client cannot perform visitor UUID sign-out
   and needs a refresh. There was no publication action.

## Exact changed files

- `AGENTS.md`, `roadmap.md`, `docs/DESIGN_SYSTEM.md`, `docs/SECURITY_REVIEW.md`, `docs/KIOSK_CHECKOUT_REVIEW.md`
- `package.json`, `bun.lock` (isolated PostgreSQL test dependency only)
- `drizzle/migrations/0004_private_kiosk_visitor_departures.sql`, `drizzle/migrations/0005_resident_qr_compatibility_lookup.sql` and tool-managed `drizzle/migrations/meta/_journal.json`
- `src/integrations/supabase/types.ts` (tool regenerated)
- `src/lib/kioskCheckoutPolicy.ts`, `src/hooks/useKioskCheckout.ts`, `src/hooks/useVisitors.ts`
- `src/components/kiosk/KioskDepartureConfirmation.tsx`, `src/components/kiosk/KioskFeedbackScreen.tsx`
- `src/pages/kiosk/KioskCheckOut.tsx`, `src/pages/kiosk/KioskQRScan.tsx`, `src/pages/kiosk/KioskResidentLeave.tsx` (resident opt-in only)
- `src/test/setup.ts`, `src/test/kioskCheckoutPolicy.test.ts`, `src/test/kioskCheckoutServer.test.ts`, `src/test/kioskCheckoutFlow.test.tsx`

Preview route: `/kiosk/checkout` (requires a bound device; an unbound browser correctly shows setup).