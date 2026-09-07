# Make a visitor's record actually tell the story of the visit

Three real problems confirmed in the current data and screens:

1. **Who they came to see is thin on the list.** The visit list does have a "Visiting" column, but several records were saved with it empty (kiosk check-ins where the resident wasn't captured), and the resident is never stored as a proper link — the `visited_resident_ids` field on every record is empty, so the name is just loose text with no room/wing and no way to see "everyone who visited Mary today".

2. **Visit history is incomplete and dead.** The profile builds history only from records already loaded for today (plus anyone still on site). Older visits by the same person are simply not fetched, and each history row is not clickable, so nothing opens.

3. **The answers they gave are unreadable.** Check-in answers are stored against question IDs (e.g. `fa79d471-bf01-...`). The profile prints those IDs as if they were the question, so the screening record looks empty or meaningless — a problem for any audit or complaint review.

## What will change

### Visit list
- Show the person being visited more clearly: name on the first line, room and wing underneath when the person is a resident, so the front desk can direct people without opening anything.
- When the field was never captured, show a quiet "Not recorded" prompt rather than a dash, and let staff set it from the row's menu.
- Add the visited resident to the list search, so typing a resident's name finds all their visitors.

### Visitor profile
- Load that person's **full** visit history from the database (matched on the stored person code first, then name + phone), not just today's records — newest first, with a count.
- Make each history row expand in place to show that visit's real detail: in/out times, duration, who they visited, companions, comments, and the check-in questions with answers.
- Resolve question IDs to the real question text everywhere answers are shown (current visit and history), with a fallback label if a question was later deleted. Flagged answers stay highlighted in red.
- Show who they came to see at the top of the profile as a link through to that resident's record.

### Resident side of the same story
- On a resident's record, add a "Visitors" section listing who visited them and when, drawn from the same link — this is the workflow currently missing entirely.

### Checking out with companions
Today the desk checkout silently assumes everyone leaves together (it just states "2 companions will also be checked out"), and the kiosk checkout never mentions companions at all. Both change:
- When the person arrived with companions, checkout asks plainly whether everyone is leaving or only some. Each companion is listed with a tick, all ticked by default, so the common case is still one tap.
- If only some leave, the visit stays open with the remaining companions and a corrected count; those who left are recorded with their departure time — so the on-site count and evacuation roll call stay true.
- The same question appears on the kiosk checkout screen using the large kiosk cards.
- The visit record then shows who left and when, instead of one blanket check-out time.

## Technical notes


- Store the resident link on check-in: populate `visitors.visited_resident_ids` from the resident chosen in the web check-in sheet and the kiosk flow, keeping `whom_to_visit` as the display text. No schema change needed.
- One-off backfill: match existing non-empty `whom_to_visit` text to resident records by name and fill `visited_resident_ids` where unambiguous.
- New `useVisitorHistory(visitor)` hook fetching all visits with full columns by `person_qr`, then name+mobile fallback; the profile page stops deriving history from `useVisitors()`.
- New shared `useQuestionLabels()` hook reading `health_questions` and `form_fields` (all types, including inactive) into an id → question map; used by the profile, history rows, PDF/CSV export, and the resident visit view.
- Answer rendering moves into one shared `ScreeningAnswers` component so the current visit, history rows and exports stay consistent.
- Visit list changes stay in `VisitorTable.tsx`; resident room/wing comes from the existing `useResidents` hook.
- Companion departures are stored on the existing `companion_details` JSON (per-companion `checkedOutAt`), with `additional_visitors` reduced to those still on site — no schema change. One shared `checkoutCompanions` helper used by `CheckOutSheet.tsx` and the kiosk checkout so both behave identically.

