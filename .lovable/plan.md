

## UI/UX Analysis: Resident Page Redesign

### Current Problems Identified

**1. Structural bloat — 4 tabs + duplicate filters**
- "Overdue" tab is a subset of "Away & Leave" — it should be a filter, not a tab
- `ResidentFilterBar` renders twice: once at the page level (line 245) and again inside `ResidentLeaveTable` (line 166). Users see two identical filter bars stacked
- Reduce to **2 tabs**: "Board" (operational view) and "Directory" (lookup)

**2. Away & Leave table has 11 columns — far too dense**
Current columns: Checkbox, Resident, Room, Wing, Care Level, Reason, Escort/Accompanied By, Expected Return, Days Away, Status, Actions. A receptionist scanning this at a glance cannot find the one thing they need: *who is out and when are they back*. Strip to **6 essential columns**: Resident (with room inline), Where/Why, Escort + Contact, Due Back (with countdown), Status, Action.

**3. Count cards are passive**
Five static cards sit above the table doing nothing. They should be **clickable filters** that highlight and filter the list below. Clicking "Away (3)" should filter the table to show only away residents. Clicking again deselects. Replace "Total" with **"Due Back Today"** — a more actionable metric.

**4. Mark Return is broken UX**
The "Mark Return" button just switches to the Away & Leave tab. It should open a **quick-select dialog** showing only currently-away residents with one-click return capability — name, where they went, when they're due, and a "Return" button per row.

**5. Presence tab is redundant with the count cards**
If count cards become interactive filters, the Presence tab's purpose (seeing who is in/out) is already served by the "Board" tab. Merge presence data into the primary view: show **all residents** with status, but visually compress "In Building" rows into compact chips/cards, and give full rows only to exceptions (away/leave/overdue).

**6. Visual hierarchy is flat**
Every row has the same visual weight. Overdue residents should **visually scream** (stronger background, left border pulse). In-building residents should recede. The eye should be drawn to exceptions.

### Proposed Implementation Plan

#### A. Page structure: 2 tabs + interactive cards

```text
┌─────────────────────────────────────────────────┐
│ Header: "Residents"          [Record Outing] [↩ Mark Return] │
├─────────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐│
│ │ 24   │ │  3   │ │  2   │ │  1   │ │  2       ││
│ │ In   │ │ Away │ │Leave │ │OVERDUE│ │Due Today ││
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────────┘│
│  ↑ clickable — filters list below, highlighted  │
├──────────┬──────────────────────────────────────┤
│ Board    │ Directory                            │
├──────────┴──────────────────────────────────────┤
│ [Search] [Wing pills] [Care Level ▾]            │
│                                                 │
│ ── Wing A · Ground ────── 12 in · 2 away ────  │
│  Overdue row (red bg, bold)                     │
│  Away row (amber tint)                          │
│  In-building: compact chip row (green dots)     │
│ ── Wing B · First ─────── 8 in · 1 leave ────  │
│  ...                                            │
└─────────────────────────────────────────────────┘
```

#### B. Specific changes

**1. `Residents.tsx` — Restructure page**
- Remove "Overdue" tab entirely
- Rename tabs to "Board" and "Directory"
- Make count cards clickable with `activeFilter` state; clicking toggles filter
- Replace "Total" card with "Due Back Today" (count residents with `expectedReturnDate` today)
- Remove the page-level `ResidentFilterBar` (keep only one, inside the tab content)
- "Mark Return" button opens a lightweight dialog listing only checked-out residents

**2. `ResidentLeaveTable.tsx` → Merge into Board view**
- Strip columns from 11 to 6: Resident (name + room inline), Where/Why, Escort + Contact (with click-to-call `tel:` links), Due Back (relative countdown like "2h 15m" or "OVERDUE 45m"), Status badge, Action button
- Remove checkbox column (bulk actions are rarely used by receptionists)
- Remove "Days Away" column (redundant with Due Back)
- Remove separate "Wing" and "Care Level" columns (wing shown via grouping headers, care level shown as small badge on name)
- Sort: overdue first, then by nearest return time

**3. `ResidentPresenceTable.tsx` — Redesign as the unified "Board"**
- Keep wing-based grouping
- For "in-building" residents: render as a **compact row** — just avatar + name + room on one line, multiple per visual row if space allows, or a very slim single-line table row
- For away/leave/overdue residents: render as **expanded rows** with destination, escort contact, return countdown
- This eliminates the need for a separate Away & Leave tab

**4. `ResidentFilterBar.tsx` — Simplify**
- Remove "Leave Status" dropdown (replaced by clickable count cards)
- Keep: Search, Wing pills, Care Level dropdown
- Single instance only (remove the duplicate)

**5. `ResidentDirectoryTable.tsx` — Keep mostly as-is**
- Already serves its purpose well as a lookup tool
- Add click-to-call (`<a href="tel:...">`) on emergency contact phone numbers

**6. Mark Return — New `MarkReturnDialog.tsx`**
- Simple dialog showing only currently checked-out residents
- Each row: Avatar + Name, Room, Where they went, Due back time, prominent "Return" button
- Optional notes field expands when Return is clicked
- Searchable if more than 5 residents are out

#### C. Visual treatment

- **Overdue rows**: `bg-destructive/[0.06]` + `border-l-4 border-l-destructive` + pulsing dot
- **Away rows**: `bg-warning/[0.04]` + `border-l-3 border-l-warning`
- **On Leave rows**: `bg-info/[0.04]` + `border-l-3 border-l-info`
- **In Building rows**: No background tint, slim height, muted text weight
- **Active count card**: Elevated shadow + primary ring + slightly scaled
- **Escort phone numbers**: `<a href="tel:...">` with Phone icon, blue underline on hover

#### D. Files to create/modify

| File | Action |
|------|--------|
| `src/pages/Residents.tsx` | Restructure to 2 tabs, interactive cards, remove duplicate filter bar |
| `src/components/ResidentPresenceTable.tsx` | Redesign as unified Board with compact in-building + expanded away rows |
| `src/components/ResidentLeaveTable.tsx` | Strip to essential columns, remove its internal filter bar |
| `src/components/ResidentFilterBar.tsx` | Remove leave status dropdown |
| `src/components/MarkReturnDialog.tsx` | New — quick-select return dialog |
| `src/components/ResidentDirectoryTable.tsx` | Add click-to-call on phone numbers |

