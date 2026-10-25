# Phase 9E-A / 9F-2a — staff check-in inventory

## Before this package

| Entry | Active form | Save |
| --- | --- | --- |
| Today (`/today`) | `AddVisitDialog` | `addVisitor`, optimistic/fire-and-forget |
| Visit List (`/visit-list`) | `checkin/CheckInSheet` + `useCheckInFlow` | `addVisitorAsync`, awaited/idempotent |
| Visitor profile (`/visitor/:id`) check in again | `AddVisitDialog`, contact/type prefill | `addVisitor` |
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