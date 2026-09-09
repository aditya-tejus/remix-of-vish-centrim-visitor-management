# Phase 7B Hardening — Directory Site Scope and Linter Delta (review only)

Reviewed at the current working tree (Phase 7B implementation). No code, schema, permission or policy
was changed. Findings below are each backed by a read of the function definitions in the database, the
migration files and the calling code.

## Findings

### 1. Kiosk resident directory returns residents from every site — High. Blocks closure.
`kiosk_resident_directory(p_search text)` has no site parameter and no site filter. It is executable by
`anon` and returns resident first name, surname, **room number**, **area/wing name** and status for up to
300 residents across all sites. A kiosk at Riverstone (or anyone calling the public API unauthenticated)
can retrieve Willowbrook residents and their room numbers.
Call sites: `src/hooks/useResidents.ts` (public mode), `src/services/adapters/local/index.ts`
(`searchResidentsPublic`). Neither supplies a site because the function accepts none. Used by
`useKioskCheckInFlow` and `KioskResidentLeave`.

### 2. Kiosk staff directory returns staff from every site — Medium. Blocks closure.
`kiosk_staff_directory(p_search text)` is `anon`-executable, has no site parameter, and returns name and
department for up to 300 active staff across all sites. Call sites: `useStaffMembers` (public mode),
`LocalPrototypeStaffDirectory.searchStaffPublic`, consumed by `useKioskCheckInFlow`.

### 3. Supplier and contractor helpers are also unscoped — Medium (contractor), Low (supplier).
`kiosk_supplier_directory()` lists every active supplier name across sites.
`kiosk_contractor_lookup(mobile, qr, first, last)` matches contractor people across all sites and returns
identity, supplier and outstanding credential labels. A contractor known at one site is recognised at
another site's kiosk, and the code can be used unauthenticated as a mobile-number/name recognition oracle.
Call sites: `useSuppliers`, `useContractorPeople.findWorker`, `LocalPrototypeSupplierDirectory`.

### 4. Watchlist decision helper is unscoped — Low.
`kiosk_watchlist_check(first, last)` is `anon`-executable and returns a match decision across all sites.
It exposes only a boolean plus alert type — no reason, instructions or register — so the disclosure is
minimal, but it is a cross-site name-guessing oracle. Recommend scoping in the same pass, not separately.

### 5. Information beyond minimum kiosk need — Medium, part of finding 1.
Room number and area name are the only fields returned by any kiosk directory that are not needed to
*choose* a person. They are needed for the staff-side destination display, not for the resident-leave and
"who are you visiting" pickers, where a name (and room only when the site's lookup mode requires
disambiguation) is enough. No contact, clinical, risk, DoLS or emergency-contact data is exposed by any
kiosk helper — that was checked field by field.

### 6. Security-linter delta 45 to 47 — Informational. Does not block closure.
Current: 1 extension in public, 17 anonymous-callable SECURITY DEFINER functions, 29 signed-in-callable
SECURITY DEFINER functions. The full `pg_proc` inventory shows all 17 anonymous entries are `kiosk_*`
functions. `kiosk_presence_list` and `kiosk_returning_lookup` were *replaced* with site-aware versions, so
they carry their existing single count each. The only function added in Phase 7B is `kiosk_log_event`,
which is counted once in the anonymous lint and once in the signed-in lint. That is the entire +2:
45 = 1 + 16 + 28, 47 = 1 + 17 + 29. No new class of warning, no newly exposed table.

### 7. Orphaned navigation after deleting `QRFastLane.tsx` — Low. Does not block closure, but is a dead end.
The component was removed and `/qr-fast-lane` redirects to `/` in `src/App.tsx`, so nothing is broken at
build time. However `src/pages/PersonTypeSelector.tsx:28` still navigates to `/qr-fast-lane`, which now
silently lands the user on the visit list, and `src/pages/CoverageChecklist.tsx` still lists that path
twice as a live feature. No permission or grant changed as a result of the deletion.

### 8. Kiosk logging change — no orphaned calls, no permission regression. Informational.
`kiosk_log_event` is called only from `src/pages/kiosk/KioskCheckIn.tsx`. Execute is revoked from PUBLIC
and granted to `anon, authenticated, service_role`, matching the existing kiosk pattern. It writes to
`kiosk_access_log` only, which stays admin-read with no anonymous select. The kiosk's former direct
`audit_log` insert is gone with no remaining references.

### 9. Site binding documentation — Low. Wording should be tightened.
`roadmap.md` describes the `?site=` plus device-memory arrangement as "a pilot arrangement, not secure
device binding". `docs/SECURITY_REVIEW.md` says "Not production-grade" but does not use the word pilot in
the Phase 7B section. The claim is present and honest; it should be made explicit and identical in both.

## Remediation plan (smallest correct change)

**A. Add an optional site parameter to the five unscoped kiosk helpers.** One migration, following the
pattern already used for `kiosk_presence_list` and `kiosk_returning_lookup`: `p_branch_id uuid DEFAULT NULL`,
filter `(p_branch_id IS NULL OR <table>.branch_id = p_branch_id)`, keep `SECURITY DEFINER`,
`SET search_path = public`, `REVOKE ALL ... FROM PUBLIC`, re-grant to `anon, authenticated, service_role`.
Null keeps existing behaviour for legacy/all-site callers, so nothing regresses.

- `kiosk_resident_directory(p_search, p_branch_id)` — filter on `visitors.branch_id`, tolerating legacy
  null-site residents exactly as the Phase 7A desktop hook does.
- `kiosk_staff_directory(p_search, p_branch_id)` — filter on `staff_members.branch_id`.
- `kiosk_supplier_directory(p_branch_id)` — filter on `suppliers_min.branch_id`.
- `kiosk_contractor_lookup(p_mobile, p_qr, p_first, p_last, p_branch_id)` — filter on
  `contractor_people.branch_id`.
- `kiosk_watchlist_check(p_first, p_last, p_branch_id)` — filter on `visitor_watchlist.branch_id`,
  keeping entries with a null site visible to every site (a group-wide alert must not be silently dropped).

Old signatures are dropped in the same migration so no unscoped overload stays callable.

**B. Pass the kiosk's site at every public call site.** No new site plumbing is invented; the site already
resolved by `useOperatingContext()` / `useSite()` is threaded through the existing `publicMode` options.

- `useResidents({ publicMode, siteId })`, `useStaffMembers({ publicMode, siteId })`,
  `useSuppliers({ publicMode, siteId })` gain an optional `siteId` and forward it.
- `useKioskCheckInFlow` passes its existing `siteId` to residents, staff and the watchlist check.
- `KioskResidentLeave` passes its site to `useResidents`.
- `useContractorPeople.findWorker` and the local adapter's public directory methods accept and forward a
  site.
- `useWatchlist({ publicMode })` gains a site for `checkVisitorRemote`.

**C. Trim room and area to what the picker needs.** Keep room in the returned row (the resident-leave
confirmation and search-first disambiguation rely on it), but confirm no kiosk screen renders area/room for
residents the person has not searched for. If the "show all" resident lookup mode lists rooms for every
resident, suppress the room column in that mode and keep it in search-first results only.

**D. Clear the dead Fast Lane path.** Point `PersonTypeSelector` at `/kiosk/qr-scan` (or remove the branch)
and mark the two `CoverageChecklist` rows as superseded by the kiosk scan screen.

**E. Align documentation.** State in both `roadmap.md` and `docs/SECURITY_REVIEW.md`, in the same words,
that site selection by URL plus device memory is pilot-grade only and that production requires an
administrator-provisioned, cryptographically bound kiosk device credential.

## Expected files, migrations, RLS and RPC changes

- One migration: recreate the five helpers with `p_branch_id`, drop the old signatures, re-apply
  revoke/grant. No table, RLS policy or grant on any table changes. No destructive statements.
- `src/hooks/useResidents.ts`, `useStaffMembers.ts`, `useSuppliers.ts`, `useWatchlist.ts`,
  `useContractorPeople.ts`, `useKioskCheckInFlow.ts`.
- `src/services/adapters/local/index.ts` and the matching service contract signatures.
- `src/pages/kiosk/KioskResidentLeave.tsx`, `src/pages/PersonTypeSelector.tsx`,
  `src/pages/CoverageChecklist.tsx`.
- `roadmap.md`, `docs/SECURITY_REVIEW.md`.
- Expected linter outcome: unchanged at 47. Rewriting existing anonymous kiosk functions does not add
  warnings; no function is added or removed.

## Tests required

1. Direct anonymous calls to each of the five helpers with Riverstone's site: no Willowbrook person,
   staff member, supplier, contractor or watchlist match is returned, and vice versa.
2. Anonymous call with no site: legacy behaviour unchanged (no error, results returned).
3. Riverstone kiosk resident picker, staff picker, contractor recognition and supplier list show only
   Riverstone entries; repeat at Willowbrook.
4. Watchlist: a Riverstone entry does not trigger at the Willowbrook kiosk; a group-wide (null-site)
   entry triggers at both.
5. Resident-leave flow still finds and marks a resident away and back.
6. Search-first and show-all resident lookup modes both behave, with room shown only where intended.
7. Signed-in reception behaviour from Phase 7A is unchanged: visit list, check-in destination picker,
   staff and supplier lists.
8. `/qr-fast-lane` no longer reachable from the person-type screen; the kiosk scan screen still works.
9. Typecheck, build and security linter; confirm 47 with the same three categories.
10. All temporary test records purged and verified at zero.

## Closure assessment

- Findings 1 and 2 (and the contractor part of 3) block Phase 7B closure: a kiosk in one care home can
  currently retrieve residents, room numbers and staff from another, which is exactly the cross-site
  isolation guarantee this phase claims.
- Findings 4, 7, 9 do not block closure but should be fixed in the same pass because they are one-line
  changes in files already being touched.
- Findings 6 and 8 are informational; the linter delta is fully accounted for and needs no work.
