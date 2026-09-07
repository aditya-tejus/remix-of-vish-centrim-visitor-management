# Evacuation: rebuild for real roll call and real compliance (AU + UK)

The current evacuation screen is a filtered list of today's check-ins with a "Safe" button. In a real fire it fails on three counts: it doesn't tell staff **who needs help to get out**, it doesn't give them **anyone to phone**, and it doesn't count **everyone who is actually on the property** (companions and staff are invisible as people). The drill report is only a list of drill titles — it can't be handed to an assessor.

## What changes

### 1. Count every person, not every record
- Companions travelling with a visitor become their own named lines on the roll call, each marked safe individually (today they are just "+2").
- Staff on site appear as their own section.
- Residents currently off-site (outing/leave/hospital) appear in a separate **Off-site — accounted for** section with their expected return and who they are with, so no one searches a building for them.
- Contractors show their work location, so the warden knows which plant room to check.

### 2. Show what a warden actually needs, per person
Each line carries, at a glance:
- Room and area for residents; check-in time and host for everyone else.
- **Evacuation assistance level** (independent / walking aid / wheelchair / full assist / bed-bound) drawn from the resident's mobility record, plus mobility aids and any DoLS/LPS or high-risk flag — this is the PEEP information UK homes are inspected on and AU homes need for their emergency plan.
- **A phone number to call**: the person's own mobile, and for residents the emergency contact / next of kin name and number, tappable to dial.
- Highest-assistance residents sort to the top of their area by default, because they leave last and matter most.

### 3. Structure that fits both a care home and a retirement village
A single **site structure** setting decides the roll call hierarchy and wording:
- **Residential aged care / care home**: Building → Wing/Floor → Room.
- **Retirement village**: Village → Stage → Villa/Unit.
- **Mixed site**: both, side by side.
Group-by options become: Area (default), Assistance level, Person type, Status. Each area block shows its own "12 of 14 accounted for" progress, because in practice one warden owns one area.

### 4. Marking safe that works with one thumb on a phone
- Whole-area actions: **"All of Rose Wing safe"** in one tap, with undo.
- Each row is itself the tap target — tap the person, they turn green; tap again to undo. No tiny checkbox and separate button.
- Three outcomes instead of two: **Safe**, **Not accounted for**, **Evacuated to hospital / left site**, each timestamped with the staff member's name.
- On marking safe you can attach the **assembly point** (already in the system but unused today), so the report shows where each person ended up.
- Big sticky bottom bar on mobile: total unaccounted, and a "Next unaccounted person" jump.
- Everything stays live-shared across devices as it is now.

### 5. A report an assessor can accept
The evacuation report becomes per-drill, not a bare list:
- Drill header: date, time started/ended, **time to full account**, who ran it, type (drill or real event), assembly points used.
- Full attendance table: every person, type, area/room, assistance level, status, time marked safe, by whom, assembly point.
- Exceptions section listing anyone never accounted for, with the reason recorded at the end of the drill (mandatory free-text before a drill can be closed).
- Export to CSV and a clean printable PDF-style page with the facility name, and jurisdiction-aware footer wording (AU: Aged Care Quality Standards emergency/disaster management; UK: Regulatory Reform (Fire Safety) Order / CQC), using the jurisdiction setting already in the app.
- Printed roll call sheet (for when the system is unreachable) includes phone numbers and assistance levels — the current print-out doesn't.

## Order of work
1. Data + hooks: assistance level and emergency contacts into the evacuation list; companions and staff expanded into people; off-site residents section.
2. Site structure setting and area grouping (care home / village / mixed).
3. Roll call screen rebuild: row-tap marking, area actions, three outcomes, assembly point, mobile bottom bar.
4. Drill close flow with mandatory reason for anyone unaccounted.
5. Report page rebuild + CSV/print with jurisdiction footer.

## Technical notes
- New settings rows: `site_structure` (`rac` | `rv` | `mixed`), reusing existing `branches`/`wings` as Building/Wing or Village/Stage with label mapping only — no new location tables.
- `evacuation_attendance` gains `status` value `evacuated_offsite` and starts using the existing `evacuation_point_id`; a migration adds `assistance_level`, `contact_phone` and `emergency_contact` snapshot columns so the report stays truthful even if the resident record later changes, plus `unaccounted_reason` on `evacuation_drills`. GRANTs and RLS mirror the existing evacuation tables (staff read/write, no delete).
- Companions come from `visitors.companion_details`; each becomes an attendance row linked to the primary visit, respecting `checkedOutAt` so people who already left aren't counted.
- Assistance level derives from `resident_details.mobility_level` / `mobility_aids` / `risk_assessment_level`; if a resident has none recorded, they show as "Assistance not recorded" rather than silently reading as independent.
- Roll call state stays in `evacuation_attendance` with the existing realtime channel; marking is optimistic with rollback on failure.
