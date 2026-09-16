# Fix: Visitor List shows 0 while Today shows 10 on site

## What is happening

Today's "Active Now" panel lists everyone who is currently signed in, no matter which day they arrived.
The Visitor List first filters to arrivals dated on the selected day, then applies the "On site now" view.

Confirmed in the data: the current practice arrivals at all four sites are stamped 15 Sep, while the browser's
calendar day is 16 Sep. So the day filter removes all of them and the list renders empty, even though those
people are still signed in.

This is not only a practice-data quirk. Any real person who arrives late in the evening and is still on site
after midnight, or anyone missing a checkout, vanishes from the Visitor List the next morning while Today
still counts them. For a reception desk that is the wrong way round — the people still in the building are
exactly the ones who must never disappear.

## The fix

1. "On site now" and "Overdue" stop being limited to the selected day. They show everyone currently signed in
   at this site, which is what both view names promise and what Today already shows.
2. "Recent activity" and "Expected back" keep the day picker exactly as they are — those are historical views
   and the date navigation is meaningful there.
3. When "On site now" or "Overdue" is showing and the selected day is not today, the day strip states plainly
   that these two views always show the live picture, so nobody thinks they are browsing history.
4. A person who arrived on an earlier day gets a small "Since <day>" marker next to their arrival time in the
   list, so staff can see at a glance that this is a carried-over arrival rather than a new one.
5. Person-type chip counts follow the same rule as the active view, so the numbers on the chips and the rows
   in the table always agree.

## Technical notes

- `src/pages/VisitList.tsx`: keep `dateVisitors` for the day-based views, and pass an additional
  non-date-filtered list (same search and type filtering applied) into `useVisitViews`.
- `src/hooks/useVisitViews.ts`: build `onSite` and `overdue` from the live list; `recent` and `scheduled`
  unchanged. Empty-state copy for the two live views updated to drop the "for this day" wording.
- Chip counts derive from whichever list the active view uses.
- Handover print keeps using the selected day's list — unchanged.
- No schema, RLS, permission or route changes. Presentation and filtering only.

## Acceptance criteria

- With the current data, Today's on-site count and the Visitor List "On site now" count match at every site.
- Moving the date back or forward does not change the "On site now" or "Overdue" rows; it does change
  "Recent activity".
- A carried-over arrival shows a "Since <day>" marker.
- Site isolation unchanged: only the current site's people appear.
- Existing tests plus a new test covering a previous-day arrival appearing in "On site now" and not in today's
  "Recent activity" pass, along with typecheck and build.
