# Companions: show them everywhere, and ask for the right details

Two problems confirmed by inspecting the app and the live records.

## What is actually wrong

**1. Companions are missing on phones and narrow tablets.**
The visit list has two layouts. The wide table already prints one row per companion with its own sign-out. The narrow, stacked-card layout used below 768px does not print companions at all. You are viewing at 750px wide, so companions are invisible even though the records exist.

**2. Older arrivals have no companion records to show.**
Arrivals recorded before the attendance work only have the old-style record, with no per-person attendance rows. Recent staff check-ins do create them correctly (the newest arrival with one companion has two accountable people). The repair tool in Settings > Audit trail fixes the older ones, but it has to be run once per site.

**3. Companions are only asked for a name.**
Companion details come from a separate, mostly empty companion list, not from the fields you configured for the visitor type. Today only "companion name" is switched on, and only for the plain visitor type — every other person type has nothing configured, so companions never ask for anything beyond a name.

## What will change

**Companion capture mirrors the main visitor**
Adding a companion asks for the same details you configured for that person type, minus the ones that only make sense once per visit (who they are visiting, purpose of visit, vehicle/site-level entries, screening questions, food, privacy acknowledgement — these stay on the main visitor). Required stays required: a companion missing a required detail blocks the step, with a clear message naming the field.

Any companion-specific fields you have already configured are still honoured and shown alongside, so nothing configured is lost. Existing companion records are untouched.

**Companions on phones**
Each companion becomes its own card in the stacked layout, matching the desktop rows: their name (or "Companion 2, name not recorded"), a "With <main visitor>" tag so it is obvious who they arrived with, arrival time, on-site status, and their own sign-out button. Cards sit directly under the main visitor's card.

**Older arrivals**
No data change in this build. The plan adds a short note on the repair card in Settings > Audit trail explaining it must be run with each site selected, and that the "Unassigned (legacy)" site holds the oldest ones.

## Technical notes

- `src/components/VisitorTable.tsx`: extract the companion row content into a small shared piece and render companion cards in the `md:hidden` stacked list, reusing `companionParties` and `onCheckOutParty` already passed in.
- `src/components/checkin/useCheckInFlow.ts`: derive the companion field list from `useFormFields(selectedType)` filtered by a per-visit exclusion list, merged with existing `useCompanionFields(selectedType)` entries by key. `companionsComplete` validates against the merged list.
- `src/components/checkin/StepDetails.tsx`: render the merged field list per companion, honouring field type (text, phone, email, select) and required state; keep the existing known-companion lookup and "remember this companion" control.
- Companion values continue to be stored in the existing companion detail shape and passed through `check_in_party` unchanged.
- `src/components/settings/CompanionFieldsManager.tsx`: label it as extra companion-only fields, since the visitor fields now flow through automatically.
- No schema, migration, policy, permission, settings-key or check-in/checkout rule changes. Lucide icons with labels only, no symbols.

## Verification

- At 750px: a visitor with a companion shows two cards, the companion tagged with the main visitor; signing the companion out leaves the main visitor on site.
- At 1280px: unchanged behaviour.
- Adding a companion asks for the visitor-type fields; a blank required field blocks the step.
- Typecheck, build, and the database check count unchanged.

## Limitations

Prototype only, not evidence of production compliance. Older arrivals still need the repair run per site before their companions appear anywhere.
