# Companions: show them everywhere, ask for the right details, and let staff configure it

Three parts, confirmed by inspecting the app and the live records.

## What is actually wrong today

**1. Companions are missing on phones and narrow tablets.**
The visit list has two layouts. The wide table already prints one row per companion with its own sign-out. The narrow, stacked-card layout used below 768px does not print companions at all. You are viewing at 750px wide, so companions are invisible even though the records exist.

**2. Older arrivals have no companion records to show.**
Arrivals recorded before the attendance work only have the old-style record with no per-person attendance rows. Recent staff check-ins do create them correctly (the newest arrival with a companion has two accountable people). The repair tool in Settings > Audit trail fixes older ones, but must be run once per site.

**3. Companions are only ever asked for a name.**
Companion details come from a separate companion list that is almost empty: only "companion name" is switched on, and only for the plain visitor type. Every other person type has nothing configured. The existing companion settings panel also only lets you rename, reorder, require and switch fields on or off — there is no field type, no help text, and no read-only option.

## What will be built

### A. Companion fields settings screen
A proper configuration screen per person type (visitor, contractor, volunteer, and so on), reached from Settings > Person types > Companion details, with the current panel replaced in place so nothing moves for staff.

For each companion field, staff can set:
- **Visible** — asked for at check-in or not
- **Required** — check-in cannot continue until it is filled
- **Editable or read-only** — read-only fields show a value carried from a known companion's saved profile but cannot be changed at the desk
- **Label and help text**, using the wording pack for the site (AU homes and villages vs UK care homes), so the screen shows "Mobile" vs "Mobile number", "Suburb" vs "Town", "Next of kin" vs "Emergency contact" and similar, and never mixes the two
- **Field type** — text, phone, email, date, choice list, yes/no
- **Order**, and add or remove extra fields

A live preview shows exactly what reception will see for that person type, and a plain-English note explains that required fields block check-in.

### B. Enough detail for a companion to have their own profile
The default companion set is seeded so a companion can stand as a person in their own right: first name, surname, mobile, email, relationship to the main visitor, and optional emergency contact name and number. Where you have configured fields for the main visitor of that person type, the same details are offered for companions too, minus the ones that only make sense once per visit (who they are visiting, purpose, screening questions, food, privacy acknowledgement — these stay on the main visitor).

With those details captured, "remember this companion" already saves them as a known person, so next time reception can pick them and their details fill in.

### C. Companions visible on phones
Each companion becomes its own card in the stacked layout, matching the desktop rows: their name (or "Companion 2, name not recorded"), a "With <main visitor>" tag so it is obvious who they arrived with, arrival time, on-site status, and their own sign-out button, placed directly under the main visitor's card.

## Technical notes

- Companion configuration keeps using the existing `form_fields` rows with the `companion_` prefix (`useFormFields` / `useCompanionFields`) — no schema change. Visible maps to `is_active`, required to `required`, order to `sort_order`. Editable/read-only and help text are stored inside the existing label/options JSON on the row, so no new columns.
- `src/components/settings/CompanionFieldsManager.tsx`: rewritten as the configuration screen (field type, visible, required, editable, help text, reorder, add/remove, preview). Still rendered from `PersonTypeSettings` and `HealthScreeningTab` with the same props.
- Wording comes from the active pack via `src/lib/segmentPacks.ts` resolved from the current site, so AU and UK sites see their own terms; no jurisdiction-specific text is hard-coded in the screen.
- Default seeding is additive only, per person type, created on first open of the screen if no companion fields exist. Existing configured rows are never overwritten or deleted.
- `src/components/checkin/useCheckInFlow.ts`: companion field list = configured companion fields merged with the visitor-type fields (minus the per-visit exclusion list), keyed by field key. `companionsComplete` validates against the merged list.
- `src/components/checkin/StepDetails.tsx`: renders the merged list per companion honouring type, required and read-only, keeping the known-companion lookup and "remember this companion" control.
- `src/components/VisitorTable.tsx`: extract the companion row body into a shared piece and render companion cards in the `md:hidden` list, reusing `companionParties` and `onCheckOutParty`.
- Companion values keep flowing through the existing companion detail shape and `check_in_party` unchanged.
- No migration, policy, permission, settings-key, check-in or checkout rule changes. Lucide icons with visible labels, no symbols.

## Verification

- Settings: toggling visible, required and read-only for a companion field changes what check-in asks for that person type only; AU and UK sites show their own wording.
- Adding a companion asks for the configured details; a blank required field blocks the step; a read-only field cannot be typed into.
- At 750px a visitor with a companion shows two cards, the companion tagged with the main visitor, and signing the companion out leaves the main visitor on site.
- At 1280px behaviour is unchanged.
- Typecheck, build and the database check count unchanged.

## Limitations

Prototype only, not evidence of production compliance. Older arrivals still need the repair run with each site selected before their companions appear anywhere.
