# Realistic demo data for the AU and UK sites

Rework the existing "Demo data" loader so it produces a believable working day at each site, then load it at all four sites (Riverstone Aged Care and AU Sample Village in Australia; Willowbrook Care Home and UK Sample Care Home in the UK).

## What changes

### 1. Realistic names, no DEMO prefix

Records get ordinary names that match the country — Australian names and wording at the AU sites, British names and wording at the UK sites. The DEMO wording disappears from the records themselves.

Safety is kept by the tag stored behind the scenes on every seeded row, so removal is still exact. To make up for losing the visible prefix:

- The Demo data card in Settings clearly states when practice data is loaded, at which site, when, and how many records.
- A short "Practice data loaded" line appears at the top of Today while a site has an active load, with a link to the Settings card.

### 2. Realistic dating

- Residents are created as long-term occupants without an arrival that Today reads as an overstay.
- Today's arrivals are spread across this morning and early afternoon, with sensible expected departure times.
- Exactly one genuine overstay is created on purpose, so the overstay alert has something real to show.
- Checked-out visits carry believable durations (30 minutes to two hours).
- One arrival from yesterday has no sign-out recorded, which is what the missing-checkout follow-up is for.

### 3. Scope per site — a busy day, roughly 35 records

- 3 residents with rooms/villas (AU: villa and room numbers; UK: room numbers and wing names from the site's own wording).
- 8 to 10 people arriving: family visitors, one group with two companions, a volunteer, a contractor worker, a district nurse type professional visitor.
- Check-in question outcomes: mostly clear, one warning, one blocked arrival.
- 1 contractor company with 2 workers and 3 documents in pending, verified and expired states, using each country's own credential wording (AU worker screening and insurance, UK DBS and insurance).
- 2 food register entries linked to residents.
- 3 keys or fobs: one issued today, one returned, one overdue.
- Feedback answers so the feedback screens and Visitor Report have content.

### 3a. Properly filled visitor profiles

Every person created has a profile worth opening, not just a name on a list:

- Full name, phone, relationship to the resident they visit, and a vehicle registration for a couple of them. Email and address stay optional and are left blank for most, in line with collecting only what is needed.
- A scan code so the returning-visitor fast lane works at the kiosk.
- Two or three earlier visits each, on different days, so the profile shows a visit history and the "been here before" panel has something to recognise.
- Recorded answers to the check-in questions on each visit, including the warning and blocked cases, so the profile shows why an arrival was flagged.
- Companions shown against the group visit on both the organiser's and the companions' profiles.
- Contractor workers show their company, their documents and the resulting compliance state.
- Residents show their room or villa, wing or stage, and their emergency contact.

Australian and British sets never mix; each site only ever sees its own.

### 4. Load at all four sites

After the loader is updated, run it once per site so each has its own separate, independently removable set.

## Still deliberately not created

- Emergency roll call records — fake drill evidence would be misleading compliance evidence.
- Kiosk devices — real device binding must not be faked.
- Watchlist entries — safeguarding records are never invented.
- Document files — contractor document records exist without an attached file.

These reasons stay listed on the Settings card.

## Technical notes

- Rewrite `seed_demo_data(uuid)` with country-aware name pools and a time model built from `now()` rather than fixed backdated dates; residents get no arrival that the overstay rule reads.
- Keep the existing per-site run key, single active run rule, permission and site-access checks, audit entries and counts.
- Trigger-derived `people` and `visits` rows are tagged during the seed (adding a nullable `demo_seed_run_id` to `people`) so `clear_demo_data` no longer has to infer them; cleanup order becomes: parties, visits, resident details, visitors, people, contractor documents/people, suppliers, keys, food, feedback, wings. Cleanup still refuses any predicate that is not scoped to a run id.
- `src/lib/demoSeed.ts` cleanup order and `src/test/demoSeed.test.ts` updated to match; add tests for the new ordering and for the residents-are-not-overstays rule expressed as a pure helper.
- Today's "practice data loaded" banner reads the active run for the current site only.

## Verification

- Full tests, type check and build.
- Load at each of the four sites in turn; confirm each site shows only its own records and the other three are unaffected.
- Confirm Today shows no phantom overstays beyond the single intended one.
- Confirm removal returns each table to its exact prior count and writes an audit entry.

## Out of scope

Weekly email delivery, kiosk changes, contractor workflow changes, navigation changes, historical reconciliation, and any broad visual redesign.
