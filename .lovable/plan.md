# Retirement village evacuation: stage, villa, who's with them, and one-tap safe

The roll call and report already carry names, assistance levels and phone numbers. What they don't do is work like a village: everyone who isn't a resident has a blank location, nobody shows who they are with, and there's no warden named against a stage. This closes those gaps when the site is set to Retirement village or Mixed, and leaves care-home sites as they are.

## What changes on the roll call

### Every person gets a village address
- Residents show **Stage + villa/unit** (the existing wing and room, worded for a village).
- Visitors, companions and contractors inherit the **stage and villa of the person they came to see** — so a warden sweeping Stage 2 sees the visitor standing in villa 14, not an unplaced name at the bottom of the list.
- Anyone with no link to a villa sits in a clearly labelled "No stage recorded" block, never hidden.
- **Couples and housemates**: two residents in one villa are always two separate lines — each is accounted for on their own — but they sit nested under a single villa heading that reads "Villa 14 — 2 people, both accounted for". Marking one safe never marks the other.


### Associated details on every line
Each person's line carries, at a glance:
- **Who they are with right now** — for a resident, the visitors and companions currently in their villa; for a visitor, the resident they came to see and their villa.
- **Next of kin / emergency contact** name and number, tap to dial.
- **Care and assistance needs** — assistance level, mobility aids, DoLS/high-risk flags (already collected, now shown consistently on both roll call and report).
- **Responsible staff / warden** for that person, taken from the resident's key worker, shown against the stage heading as well as the person.

### Marking safe stays one tap
- Tap the person's row: green, timestamped, with the signed-in staff member's name recorded. Tap again to undo.
- **"All of Stage 2 safe"** on each stage heading, with undo.
- Stage headings show their own "9 of 11 accounted for" and the warden's name, because one warden owns one stage.
- Off-site residents stay in their own accounted-for block with expected return and who they're with.

## What changes on the report

The saved drill record gains the same detail, snapshotted at the time so it stays truthful later:
- Attendance table grouped **by stage, then villa**, with associated people, contact numbers, next of kin, assistance level and responsible staff.
- Stage-by-stage summary at the top: people, accounted for, time to account, warden.
- CSV and the printable page carry the same columns, with village wording and the existing AU/UK compliance footer.
- The printed sheet (for when the system is unreachable) lists villa, phone, next of kin and who each person is with.

## Order of work
1. Give non-residents a stage/villa and an "associated with" line in the roll call builder.
2. Snapshot responsible staff and associated people onto the attendance record.
3. Roll call screen: stage headings with warden and per-stage safe action; associated details on each line.
4. Report page, CSV and print: stage/villa grouping and the new columns.

## Technical notes
- `src/lib/evacuation.ts`: `buildRollCall` resolves each non-resident's host resident (via `visitedResidentIds`, falling back to `whomToVisit`) and copies that resident's wing and room into `area`/`room`; companions inherit from their primary visitor. New `RollCallPerson` fields `associatedWith: string[]` (names + relationship) and `responsibleStaff` (from `resident_details.key_worker`). Residents gain the reverse link: visitors currently checked in against them.
- Migration on `evacuation_attendance`: add `responsible_staff text` and `associated_with text` (comma-joined snapshot). Nullable, no backfill; existing rows render "—". GRANTs and RLS unchanged (staff read/write, no delete).
- `RollCallSeed` and `seedColumns` in `src/hooks/useEvacuation.ts` extend to carry the two new fields; `markSafe` already stores `marked_by` and `marked_safe_at`, so the one-tap behaviour needs no data change.
- Village-only behaviour keys off `useSiteStructure().structure` being `rv` or `mixed`; `rac` keeps today's grouping and columns, with only the label mapping already in place.
- `src/pages/Evacuation.tsx`: stage group headers gain warden name, per-stage count and an "All of {stage} safe" bulk action reusing `markSafe` per person; person rows gain the associated/next-of-kin/warden line.
- `src/pages/EvacuationReport.tsx`: attendance rows grouped by `area_label` then `room_label`, plus the new columns in the on-screen list, `exportDrillCSV` headers and the print HTML table.
