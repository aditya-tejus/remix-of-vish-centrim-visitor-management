# Visitor list and visitor profile — operational rework

Both screens carry too much detail and not enough of what the front desk actually needs. This rework puts times and actions first, moves audit detail out of the way, and makes the overstay rule configurable per person type.

## 1. Visit list

**Times first, duration second**
- Columns become: Person · **In** · **Out** · Duration · Visiting · Companions · Action.
- "Out" always shows the check-out time (or a clear "On site" marker while they are still here), instead of being hidden inside the status cell.
- Duration stays but as quiet supporting text, not the emphasised value.

**One set of counters, not two**
- The three large summary cards at the top and the repeated strip under the tabs currently show the same On-site / Checked out / Overstayed numbers. Keep a single compact counter row directly above the table, still clickable as filters, with the active filter shown as a chip.

**At-a-glance risk in the row**
- Overdue key or fob, watchlist/safeguarding flag, and overstay all show as small markers on the person's row so nothing needs a click to be noticed.

**Faster daily actions**
- Row action button stays visible (not hover-only) and reads Check Out / Sign Out / Depart by type.
- Tick boxes for multi-select with a "Check out selected" action for end-of-day clearing.
- Delete moves to the bottom of the row menu, separated, and keeps its confirmation.

**Overstay per person type**
- New settings under each person type: overstay hours (visitor, contractor, volunteer, staff), defaulting to today's 8 hours.
- The list, the counters, the sidebar badge and the overstay alerts all read that per-type value instead of the hard-coded 8 hours.

## 2. Visitor profile

Keep both views, with clear roles.

**Quick panel** (slide-out from the visitors list)
- Who they are: name, type, status, phone, who they visit, companions, any watchlist flag.
- Act now: Check out, Issue or return key, Print badge, Open full profile.
- Last five visits as plain lines (date · in–out · visiting). No nested expanders.

**Full profile page**
- Header keeps only the everyday actions: Check In (pre-filled with this person's details), Check Out, Print badge, and a single "More" menu holding Edit, CSV, PDF, Feedback and Delete.
- Top of page: a live visit strip — in time, out time, duration, visiting, keys held, expected departure — with the action buttons beside it.
- Then: contact and companions.
- Then: visit history, showing frequency ("12 visits, last on 3 Sep"), each row expandable for that visit's detail.
- Compliance evidence (screening answers, consent, temperature, retention date, vaccination) moves into a collapsed "Compliance record" section, open on demand for audits.
- Sections with no data are hidden rather than showing rows of dashes.

**Fixes to current behaviour**
- "Quick Check-In" today opens an empty check-in form; it will open pre-filled with this person's details and still re-ask the check-in questions.
- "Quick Check-Out" today checks the person out instantly with no confirmation and no time adjustment; it will use the same check-out sheet as everywhere else, including the manual time override.
- Delete Profile is currently always shown; it will be limited to admins.

## Technical notes

- `VisitorTable.tsx`: column set per type reworked (In / Out / Duration), row markers from `useOpenKeyIssues` and watchlist, selection state plus bulk checkout callback, action button always visible.
- `VisitList.tsx`: remove the large `countCards` block, keep `TabContextStats` as the single counter row, keep date nav, search and command bar as-is.
- New `src/hooks/useOverstayPolicy.ts` reading `overstay_hours_{person_type}` from `settings` with an 8-hour fallback; used by `VisitList.tsx`, `TabContextStats.tsx`, `VisitorTable.tsx`, `useVisitors.ts` (`overstayedCount`, overdue alerts) and `AppSidebar`.
- `PersonTypeSettings.tsx`: overstay hours field added to the existing Alerts & Thresholds section per type; saves audit entry as other settings do.
- `VisitorProfile.tsx` (sheet) simplified to the quick-panel content with a link to `/visitors/:id`.
- `VisitorProfilePage.tsx` restructured: header actions condensed into a `DropdownMenu`, live visit strip, collapsed compliance block via `Collapsible`, `AddVisitDialog` receives a prefill prop, quick check-out routed through `CheckOutSheet`, `isAdmin` derived from the `user_roles` admin check rather than hard-coded `true`.
- No database schema change; overstay settings are rows in the existing `settings` table.
