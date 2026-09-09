# Phase 7D — Emergency Mode and Evacuation Report

Baseline confirmed: latest commit `d56625f` ("Implemented Phase 7C features"). One emergency event is currently open in the database, and all existing event and roll-call rows carry a site.

## What is true today (verified)

- Routes: `/evacuation` (staff roll call), `/reports/evacuation` (history), `/kiosk/evacuation` (PIN-gated staff roll call on the kiosk).
- Event model already supports drill vs real, the states draft / active / paused / resolved / reviewed, a point-in-time snapshot time, review notes and reviewer.
- Six outcomes already exist: safe, safe elsewhere, not located, assistance required, evacuated off-site, not accounted for. Only safe, safe elsewhere and off-site count as accounted for.
- Closed events are protected in the database: any change to a roll-call line of a resolved or reviewed event is rejected. Every status change writes an immutable action record with actor, previous status, new status and source.
- Group arrivals from Phase 7C already appear as individual people, with the organiser shown as context.
- Reading events and roll-call lines is restricted to the sites a user can access.

Three real gaps found:

1. **New events and roll-call lines are never stamped with the site.** The site column was only backfilled once; nothing writes it now. Unstamped rows are readable by every signed-in user, so the next new event would be visible across sites. This is the highest-priority fix.
2. **Event and history lists are not filtered by the current site in the app.** The roll call picks up "the first open event" regardless of site, and the report page lists all events it can read.
3. **No fast, obvious way into Emergency Mode**, no live "last updated" indicator, and no offline or partial-failure handling on the roll call.

## Plan

### 1. Site correctness first (blocking)
- Stamp the site on every new event and every roll-call line, taken from the current site context.
- Add a database safeguard that fills the site on a roll-call line from its parent event if the app omits it, so a line can never be created unstamped.
- Filter the open-event lookup, the history list and the roll-call seed to the current site only.

### 2. Entering Emergency Mode
- Persistent "Emergency" action in the staff header, visible on every page to users with the activate permission, plus the existing sidebar entry.
- Two-step start: choose **Live emergency** or **Drill**, confirm once. A drill is clearly labelled everywhere (banner, list, print, export) so it can never be mistaken for a live event.
- If an event is already open for this site, the action joins it rather than creating a second one.
- Emergency Mode is a focused full-width screen: banner with event type, elapsed time, site, and the three big numbers.

### 3. Working the roll call under pressure
- Priority ordering by default: not accounted for and assistance required at the top, then not located, then accounted people collapsed.
- Large totals: on site, accounted for, still to find; plus assistance-required and off-site counts.
- One-tap outcome per person and per group heading; "jump to next outstanding".
- Search by name, room, area, host or phone; filters for type, area and status. All retained during the event.
- "Last updated" timestamp on the header, driven by the existing live subscription, with a stale warning if updates stop.
- Group attendees stay individually accountable: marking the organiser never marks the party.

### 4. Corrections and closure
- Changing an already-recorded outcome always requires a reason, stored on the action record (existing behaviour, kept).
- Pause / resume; resolve requires a reason when anyone is still unaccounted for; review adds notes and a reviewer.
- Closed events are read-only, enforced in the database. No change to that protection.

### 5. Snapshot vs live
- Event header states clearly: "Snapshot taken at hh:mm" and lists anyone who arrived after that time as a late addition, separated from the original snapshot.
- The history report renders the point-in-time record only, never live data.

### 6. Privacy by role
- Emergency contact numbers and clinical assistance notes shown only to users with the assistance/screening permissions; everyone else sees name, location, assistance flag and status.
- Kiosk roll call keeps its current minimum fields (name, type, location, phone, assistance flag, status). No widening.
- Export requires the export permission and is audited (existing behaviour, kept).

### 7. Print and paper fallback
- Rewritten print sheet: A4 portrait, high contrast, checkbox column, area headings, assistance flag, tick boxes for outcomes and a signature/time line per area — usable with a pen if screens fail.
- "Print paper roll call" available before and during an event.

### 8. Offline / partial failure
- Offline banner; outcomes queue locally and re-send when the connection returns, with a visible pending count.
- A failed write shows a retry on the affected person only; no silent loss, no duplicate rows.

### 9. Terminology
- Labels follow the site's operating context: AU aged care (wing / room), AU retirement village (stage / villa), UK care home (unit / room), with "Fire drill" / "Emergency" wording matched to jurisdiction.

## Technical detail

Files expected to change:
- `src/pages/Evacuation.tsx` (Emergency Mode screen, ordering, offline, snapshot vs late arrivals, print)
- `src/pages/EvacuationReport.tsx` (site filter, snapshot-only rendering)
- `src/hooks/useEvacuation.ts` (site stamping, site-filtered queries, queued retry)
- `src/lib/evacuation.ts` (priority sort, group context)
- `src/components/AppHeader` / shell (Emergency action)
- New: `src/components/emergency/*` (banner, totals, person row, start dialog, print sheet)
- `roadmap.md`, `docs/SECURITY_REVIEW.md`

Migration (additive only):
- Trigger to inherit the site on roll-call lines from the parent event.
- Index on open events by site.
- No new tables, no second emergency or attendance model, no RLS relaxation.

## Acceptance tests (isolated temporary drill data only)

Run against a temporary drill event at a temporary/known test site; no live emergency is started, and all temporary rows are removed afterwards.

1. Start a drill; verify it is stamped with the current site and invisible from the other site.
2. Roll-call lines created during the drill are stamped and site-isolated.
3. Priority ordering, search, filters, group-heading marking and jump-to-next.
4. Group of five: marking one attendee leaves the other four outstanding.
5. Correction without a reason is rejected; with a reason it is recorded with actor and previous status.
6. Resolve with outstanding people requires a reason; after closing, any further change is rejected by the database.
7. Late arrival after the snapshot appears as a late addition, not inside the snapshot.
8. Forced network failure: outcome queues, retries, no duplicates.
9. Print sheet legible on A4 with checkbox column.
10. Permission checks: activate, mark safe, export each denied to a user lacking them.
11. Kiosk roll call still works and still exposes only minimum fields.
12. Phase 7A/7B/7C regression: visit list, kiosk check-in/Fast Lane, group check-in unchanged.

## Risks and safety controls

- **Risk: testing touches real operations.** Control: drill-class events only, at a temporary site, purged afterwards; the currently open event is left untouched.
- **Risk: site stamping change breaks visibility of historic events.** Control: additive only; existing rows already stamped, no backfill rewrite.
- **Risk: offline queue causes duplicate outcomes.** Control: queue keyed per person per event; retry updates the same line.
- **Risk: closed-event immutability weakened by new writes.** Control: no trigger changes; new UI paths tested against a closed event.

## Non-goals

No second emergency or attendance model, no generic dashboard, no kiosk-initiated emergency activation, no external notifications or SMS cascade, no hardware alarm or panel integration, no biometrics, no printer hardware, no Phase 7E/7F work, no regulatory or production-readiness claim.

## Open questions

1. Should the header Emergency action be visible to all staff (read-only until permitted) or hidden entirely without the activate permission?
2. For a live event, should resolving require a second person to confirm, or is a reason sufficient for the pilot?
3. Should off-site residents be listed on the roll call by default, or kept in a separate collapsed section as today?
