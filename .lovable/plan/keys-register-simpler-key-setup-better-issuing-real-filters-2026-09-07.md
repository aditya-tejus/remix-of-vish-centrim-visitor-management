# Keys Register: simpler key setup, better issuing, real filters

No second page. Issuing and returning already live on the Keys Register, and splitting them across two screens would only make staff hunt for the right one. Everything below improves the register in place.

## 1. Simpler key creation

Today adding a key asks for six things at once (name, type, property/unit, copy number, resident, where it's kept, notes), and it mixes retirement-village wording ("property / unit") with aged care wording ("resident, room"). Most of it is guesswork for the person at reception.

New "Add key" form, three questions on one short screen:

- **What is the key for?** One picker covering both worlds: a resident/unit (from the resident list, showing room or unit) **or** a shared area typed in free text (Main gate, Laundry, Medication room).
- **What kind of key?** Front door, mailbox, garage/shed, access fob, master, other. Six taps, no typing.
- **How many copies?** A number. Entering 3 creates three keys at once, named "copy 1, 2, 3", instead of adding the same key three times.

Everything else moves behind a single "More details" line: where it's kept, and notes. The key name fills in automatically from the area plus the kind of key ("Unit 12 — front door") and can still be typed over.

## 2. Issuing and returning, improved where it already is

- **Who is taking the key** becomes a proper picker instead of a typed name: people **currently checked in** first (straight from the visit log, so the handover links to that visit automatically), then staff from the staff list, then residents, then free text for anyone else.
- **Due back** gets quick "2 hours / end of day / tomorrow" buttons alongside the date box.
- A **"Keys out right now"** section pinned at the top of the page — overdue first in red — so staff see outstanding keys without scrolling the whole register.
- Return stays one tap on the row: who received it, condition notes, done.
- Full record kept as now: who took it, who handed it over, when out, when back, who received it — per key, and per staff member.
- Where the holder came from the visit log, their name links to that visit record, which already shows the "Key issued" marker. Staff-held keys stay independent of the visit log.

## 3. Filters that actually cover the work

One tidy control row, replacing the two dropdowns there today:

- Search across key, area/unit, resident and holder name (already there).
- Status: available, issued, overdue, lost, retired.
- Kind of key: front door, mailbox, garage, fob, master, other.
- Who holds it: staff, contractor, visitor/family, resident, anyone.
- Resident or area, and wing (aged care), built from the resident and wing lists.
- Time out: due today, overdue, out more than 24 hours, out more than a week.
- A chip row showing what is applied, with clear-all and a result count.

Filter choices stay in the page address, so a filtered view can be bookmarked or shared.

## Technical notes

- No schema change: `property_keys` and `key_issues` already carry key type, property label, resident link, copy number, holder type, `visitor_id`, `issued_to_staff_id`, expected/actual return and notes. Wing filtering joins through `resident_details`.
- Work stays in `src/pages/KeysRegister.tsx`, with the add/issue/return sheets and the new filter bar split into `src/components/keys/` so the visit record's "Issue key" action can reuse the issue sheet.
- `addKey` in `src/hooks/useKeys.ts` gains an optional `copies` count and inserts N rows in one call.
- Filter state driven by `useSearchParams`; person picker reads `useVisitors` (checked-in only), `useStaffMembers` and `useResidents`.
