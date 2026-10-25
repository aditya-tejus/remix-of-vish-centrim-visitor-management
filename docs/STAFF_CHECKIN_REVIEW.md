# Phase 9E-A / 9F-2a — staff check-in inventory

## Before this package

| Entry | Active form | Save |
| --- | --- | --- |
| Today (`/today`) | `AddVisitDialog` | `addVisitor`, optimistic/fire-and-forget |
| Visit List (`/visit-list`) | `checkin/CheckInSheet` + `useCheckInFlow` | `addVisitorAsync`, awaited/idempotent |
| Visitor profile (`/visitors/:id`) check in again | `AddVisitDialog`, contact/type prefill | `addVisitor` |
| Person type (`/person-type`) | `AddVisitDialog`, initial type | `addVisitor` |
| Group (`/group-checkin`) | `GroupCheckIn` | Separate per-attendee retry/terms workflow; not merged |

`AddVisitDialog` is 1,437 lines. The Visit List sheet is already split into
Identify, Details, Screening and Confirm but Details still combines photo,
configured fields, destination, companion fields and person lookup.

## Authoritative configuration and identified differences

- `usePersonTypes`: visitor, contractor, volunteer, staff, other, resident;
  **professional is not a stored person type**. Professional visitors use visitor
  or an existing configured label; no type is invented. Site overrides win over
  account/default settings. Residents have a separate movement workflow.
- `useFormFields` / `resolveCheckInFields`: name required, configured optional
  fields and requiredness; `mergeCompanionFields` supplies individual details.
  Legacy dialog instead requires email/destination regardless of configuration.
- `useCheckInFlow` returning lookup is site-filtered (including null-site rows
  only for legacy site); legacy lookup lacks an explicit branch filter.
  Both deduplicate by name/email, an existing identity limitation.
- Destination uses current-site resident/staff hooks. Staff sees room/wing;
  public search-first privacy controls belong to kiosk, which is untouched.
  The newer flow links residents by selected display name, a same-name gap.
- Companions retain explicit `person_id` / `create_person`, normalised names
  and contact, independent attendance through existing `check_in_party`.
- Newer food step is configured per type and only visitor/volunteer visiting a
  resident; food writes happen separately after arrival, not atomically.
- Newer screening uses `resolveScreeningPolicy` and `evaluateScreening`;
  legacy fallback questions and three-character overrides differ. Newer warning
  needs a ten-character staff reason; blocked outcome needs server approval.
  Required question/vaccination completion was not enforced by newer step gate.
- Both reuse `ContractorScreening` and its server document verdict. Its existing
  worker discovery may create a contractor profile before final arrival and
  credential/owner answers may save immediately. No live contractor walkthrough
  or write is permitted for this package; use mocked tests only.
- Legacy offers volunteer extras, Other reason and outstanding-key guard;
  newer flow omitted those extras and contractor supplier payload fields.
- Newer sheet prints a badge only after confirmed save; legacy closes immediately.
  Photo preview/capture is present but no photo/signature field exists in Visitor
  save contract. Do not claim photo persistence or invent signature storage.
- Terms content resolves site/account/pack; privacy requirement comes from person
  type. Legacy always requires acknowledgement; newer confirmation displays it
  even when switched off. Newer consent lacks explicit confirmer metadata.
- Newer request key survives save retries; submission ref blocks rapid second
  taps; failure leaves answers intact. Existing server/RPC remains authoritative.

## Boundary

Canonicalise ordinary staff arrivals on the newer sheet with small extractions
and existing settings/hooks, preserving explicit resident movement and separate
group organiser/individual terms semantics. No public kiosk, RLS, permission,
schema, RPC, notification or emergency changes. No live save tests.

## Implemented and verified

Today, Visit List, non-resident profile repeat arrival and type preset now use
`CheckInSheet` with awaited `addVisitorAsync`. `AddVisitDialog` remains for resident
profile movement/legacy code; `GroupCheckIn` remains independent. Its organiser
consent and partial-arrival retry need a separate parity review before any merge.

Presentational extractions: `ConfiguredDetails`, `Destination`, `AdditionalPeople`,
`VisitPurpose`, `ReviewAction`. Required-answer/readiness rules are pure in
`staffCheckInRules`; existing configuration hooks and persistence RPC untouched.
Configured destination, required question/vaccination completion, Other reason,
outstanding-key override, volunteer extras, supplier answers and explicit terms
attribution are retained/connected in the canonical staff form. No automatic
approval of flagged answers. Approval is invalidated if screening answers change.
Unselected site and site changes block saving; returning search stays site-filtered.

Baseline: 182 tests before edits. Final: 219 tests in 22 files, including 37 new
staff tests (12 pure, 25 hook/component). They cover five types, configured fields,
consent, companions, food/key/block rules, contractor gate/payload, fresh profile
declarations, request-key retry, double submission, config failure/loading,
site lookup/change and screening approval invalidation. Mocked component submit
proves confirmed success/read-back and preserved answers after failure; not a live
credential or server permission verification. Harness typecheck/build: build OK.

Playwright at 390/768/1024/1440 on `/person-type`: opened Visitor staff sheet,
entered names, checked terms, inspected screenshots, verified no horizontal sheet
overflow, one main/h1, disabled save without site, Escape dismissal, no page errors.
All service requests mocked; no operational records created. Authenticated Today/
Visit List/profile rendering, configured contractor UI, dark-mode and assisted
technology UAT remain unverified (this package uses mocked checks only).

## Remaining functional gaps — not represented as fixed

- Field configuration hook is person-type filtered, not explicitly site-filtered;
  configuration permissions/query architecture were not broadened here.
- Resident selection still resolves display names; same-name residents require
  a separate ID-selection correction. Returning search is last ten arrivals and
  name/email deduplicated; it is not canonical person lookup. Profile prefill does
  not carry reusable QR identity through its current caller.
- Custom detail values, photo/signature and dedicated vaccination-date properties
  are not mapped by existing persistence. Configured vaccination answers travel
  in `health_answers` only when screening is enabled; vaccination-only storage
  remains an existing gap. File answers keep local file metadata, not uploaded
  credential evidence. No persistence claim is made for these controls.
- Food record and warning/key audit are separate follow-up requests; not atomic
  with arrival and not guaranteed if those requests fail. Supervisor-block audit
  continues through existing server approval. No new audit/server contract.
- Contractor discovery/credential edits can write before arrival in the existing
  component. No live contractor path was exercised. Server permission/site
  enforcement remains authoritative; this package does not certify it anew.

## Exact package files

- `src/components/checkin/{CheckInSheet,useCheckInFlow,StepIdentify,StepDetails,StepScreening,StepConfirm,ConfiguredDetails,Destination,AdditionalPeople,VisitPurpose,ReviewAction}.tsx`
  (`useCheckInFlow` is `.ts`, not `.tsx`).
- `src/lib/staffCheckInRules.ts`
- `src/test/staffCheckInRules.test.ts`, `src/test/staffCheckInFlow.test.tsx`
- `src/pages/HomeWorkbench.tsx`, `src/pages/VisitorProfilePage.tsx`,
  `src/pages/PersonTypeSelector.tsx` (Visit List already used the shared sheet).
- `AGENTS.md`, `roadmap.md`, `docs/DESIGN_SYSTEM.md`, this review.

Preview: `/today` and `/visit-list` Check In; `/person-type` is the mocked browser
inspection route. Stop after this package; kiosk, group, resident, emergency,
notifications, routes, permissions, schema and published app unchanged.