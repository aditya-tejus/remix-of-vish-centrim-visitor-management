# Bring the count cards back to the top of the Visit List

Today the only counters sit as a thin grey strip inside the table, under the tabs. You want the counts back up top, where reception can read them the moment the page opens — without going back to the oversized card block that pushed the list off screen.

## What you will see

A single row of compact count cards directly under the command bar (date, search, Check In / Check Out / QR / Handover), above the tabs and the list.

For the current day and tab, the cards show:

- **On site now** — green, the default view
- **Left today** — grey
- **Overdue** — red, with a soft pulse only when the number is above zero
- **Contractors tab** also shows the credential/clearance count already used today; **Staff tab** shows On shift instead of Left

Behaviour:

- Each card is clickable and filters the list, exactly as the current strip does. Clicking the active one clears the filter. The active card is visibly selected, so the "Filtering: …" pill stops being the only cue.
- Counts respect the selected date, the search box and the active tab, so they never disagree with the rows underneath.
- The thin counter strip inside the table is removed — one set of counters only, no repetition.
- Card height stays modest (single line: label + number + small icon, roughly 56px), so the first rows of the list still appear without scrolling on a laptop.
- On narrow screens the cards wrap to two per row rather than shrinking to unreadable.

## Technical notes

- `TabContextStats.tsx`: add a `variant` prop — `"strip"` (current inline look) and `"cards"` (bordered `rounded-xl` cards in a responsive grid using existing semantic tokens: `text-success`, `text-muted-foreground`, `text-destructive`, `bg-card`, `border-border`). Stat definitions, filter keys and `useOverstayPolicy` logic stay unchanged.
- `VisitList.tsx`: render `<TabContextStats variant="cards" tab={activeTab} visitors={searchedVisitors} allVisitors={filteredVisitors} onFilter={handleStatCardClick} activeFilter={activeFilter} />` between the command bar and the table. Passing `searchedVisitors` (pre status-filter) keeps the counts stable while a filter is applied.
- `VisitorTable.tsx`: remove the internal `TabContextStats` render and its import; tabs remain.
- No data, hook or backend change.
