# Keys: a simpler register and a proper issue/return page

Two things: make adding a key quick, and give staff one clear place to hand keys out and take them back — with every handover tied to the visit log where a visit exists.

## 1. Simpler key creation

Today adding a key asks for six things at once (name, type, property/unit, copy number, resident, where it's kept, notes), and it mixes retirement-village language ("property / unit") with aged care language ("resident, room"). Most of it is guesswork for the person at reception.

New "Add key" form, three questions on one short screen:

- **What is the key for?** One picker that covers both worlds: a resident/unit (from the resident list, showing room or unit) **or** a shared area typed in free text (Main gate, Laundry, Medication room).
- **What kind of key?** Front door, mailbox, garage/shed, access fob, master, other. Six taps, no typing.
- **How many copies?** A number. Entering 3 creates three keys automatically, named "copy 1, 2, 3" — instead of adding the same key three times by hand.

Everything else becomes optional and tucked behind a single "More details" line: where it's kept, and notes. Key name is filled in automatically from the area plus the kind of key ("Unit 12 — front door"), and can still be typed over.

## 2. Keys Issue page

A new page, **Keys Issue**, under Visitor Management next to the register. The register answers "what keys do we own"; this page answers "who has what right now".

- Top of the page: everything currently out, newest first, overdue rows first and marked in red — key, who has it, since when, due back, and who handed it over.
- **Issue a key** from here in one flow: pick the person, then pick the key.
  - The person picker starts with everyone **currently checked in** (visitors, contractors, family) straight from the visit log, so a handover is linked to that visit automatically. Below that, staff from the staff list, then residents, then free text for anyone else.
  - The key picker only offers keys that are in the cabinet, searchable by resident, unit or area.
  - Then: due back (with quick "2 hours / end of day / tomorrow" buttons), who is handing it over, and optional notes.
- **Return** on any row: who received it, condition notes, done.
- Every issue and return keeps its full record — who took it, who handed it over, when out, when back, who received it — visible in a history panel per key and per person.
- Where the holder came from the visit log, their name links to that visit record, and the visit already shows the "Key issued" marker built earlier. Staff-held keys stay independent of the visit log, as before.

## 3. Filters that actually cover the work

Applied on both pages, as a single row of controls:

- Search across key, area/unit, resident and holder name (already there).
- Status: available, issued, overdue, lost, retired.
- Kind of key: front door, mailbox, garage, fob, master, other.
- Who holds it: staff, contractor, visitor/family, resident, anyone.
- Resident or area, and wing (aged care) — a dropdown built from the resident and wing lists.
- Time out: due today, overdue, out more than 24 hours, out more than a week.
- A "clear filters" chip row showing what is currently applied, and the result count.

Filter choices stay in the page address, so a filtered view can be bookmarked or shared.

## Technical notes

- No schema change needed: `property_keys` and `key_issues` already carry key type, property label, resident link, copies, holder type, `visitor_id`, `issued_to_staff_id`, expected/actual return and notes. Wing filtering joins through `resident_details`.
- New `src/pages/KeysIssue.tsx` plus a `/keys/issue` staff-only route and sidebar entry; issue and return forms lifted out of `KeysRegister.tsx` into shared `src/components/keys/IssueKeySheet.tsx` and `ReturnKeySheet.tsx` used by both pages (and reusable from the visit record's "Issue key" action).
- Bulk copies: `addKey` gains an optional `copies` count and inserts N rows in one call.
- Filters extracted into `src/components/keys/KeyFilters.tsx` driven by `useSearchParams`; person picker reads `useVisitors` (checked-in only), `useStaffMembers` and `useResidents`.
