# Visit list and visitor profile — rebuilt around the front desk day

Rewritten from how reception and a village manager actually work a shift, not from what data we happen to hold.

## The four moments these screens have to serve

1. **Someone is standing at the desk.** Find them or check them in fast, without reading a table.
2. **Something is happening now.** Who is on site, who has a key, who is flagged, who has been here too long.
3. **End of shift / handover.** Clear the stragglers, hand over what matters in one page.
4. **Someone rings up or an auditor asks.** "Was Mrs Patel's son here on Tuesday?" — find the person and their history in seconds.

The current screens serve none of these first. The list opens on *everything logged today* with duration in the spotlight and check-out times buried. The profile opens on compliance paperwork with eight buttons across the top.

## 1. Visit list — "who is on site right now"

**Default to the live picture**
- The list opens on **On site**, not on everything today. A second tab shows everyone today, and the date picker still lets you go back.
- Reason: at 11am nobody needs the twelve people who already left; they need the nine still in the building.

**Times, not stopwatch**
- Columns: Person · **In** · **Out** · Visiting · Companions · Action.
- Check-out time is a real column, always visible. Duration drops to quiet grey text under the in-time — useful, never the headline.

**One counter row**
- The big cards and the strip under the tabs repeat the same three numbers. One compact clickable row stays: On site · Left · Overdue.

**What a manager must see without clicking**
- Overdue key or fob, watchlist/safeguarding flag, and overstay show as small markers on the person's row.
- Contractor rows show their company and whether an escort is required.

**End of shift**
- Tick boxes and "Check out selected" so the desk can clear the board in one action, each with the manual time override already built.
- The Handover print picks up the same live view.

**Overstay that matches reality**
- One fixed 8 hours suits nobody: a family visit at 4 hours is unusual, a contractor at 8 hours is normal, a volunteer sits in between.
- Overstay hours become a per-person-type setting (default 8h), used by the list, counters, sidebar badge and the overdue alerts.

**Safer everyday actions**
- The check-out button on each row is always visible and reads Check Out / Sign Out / Depart by type.
- Delete moves to the bottom of the row menu, separated, still confirmed.

## 2. Visitor profile — "act, recognise, remember"

Two views, each with one job.

**Quick panel** (from the list — for the person at the desk)
- Recognise: name, type, status, phone, who they normally visit, companions, any flag.
- Act: Check out · Issue or return key · Print badge · Open full profile.
- Remember: last five visits as plain lines (date · in–out · who they saw).
- No nested expanders, no compliance grid.

**Full profile page** (for the phone call, the complaint, the audit)
- Header keeps only Check In (pre-filled), Check Out, Print badge, and one "More" menu holding Edit, CSV, PDF, Feedback, Delete.
- A live visit strip at the top: in, out, visiting, companions, keys held, expected departure — with the actions beside it.
- Then who they are: contact, companions, relationship to the resident they visit.
- Then the pattern that matters operationally: "12 visits · usually Tue and Sat afternoons · last here 3 Sep", followed by the visit list, each row expandable for that visit's detail.
- Compliance evidence (screening answers, consent, temperature, retention, vaccination) collapses into a "Compliance record" section, opened when someone actually needs it.
- Empty sections are hidden instead of showing rows of dashes.

**Three things that are currently wrong**
- "Quick Check-In" opens a blank form — it will open pre-filled with this person's details and still re-ask the check-in questions.
- "Quick Check-Out" checks the person out instantly with no confirmation and no time correction — it will use the same check-out sheet as everywhere else.
- "Delete Profile" is shown to everyone — it will be admin only.

## Technical notes

- `VisitorTable.tsx`: per-type columns reworked to In / Out / Duration-as-subtext, row markers sourced from `useOpenKeyIssues` and the watchlist, selection state and a bulk check-out callback, action button always visible.
- `VisitList.tsx`: default view state set to on-site, large `countCards` block removed, `TabContextStats` kept as the single counter row, date nav / search / command bar unchanged, bulk check-out wired to `CheckOutSheet`.
- New `src/hooks/useOverstayPolicy.ts` reading `overstay_hours_{person_type}` from `settings` (8h fallback), consumed by `VisitList.tsx`, `TabContextStats.tsx`, `VisitorTable.tsx`, `useVisitors.ts` (`overstayedCount` and overdue alerts) and `AppSidebar`.
- `PersonTypeSettings.tsx`: overstay hours added to each type's Alerts & Thresholds section, saved with the usual audit entry.
- `VisitorProfile.tsx` (sheet) reduced to the quick-panel content with a link through to `/visitors/:id`.
- `VisitorProfilePage.tsx` restructured: condensed header actions, live visit strip, `Collapsible` compliance block, prefill prop passed to `AddVisitDialog`, quick check-out routed through `CheckOutSheet`, `isAdmin` derived from the admin role check instead of hard-coded `true`.
- No database schema change; overstay values are rows in the existing `settings` table.
