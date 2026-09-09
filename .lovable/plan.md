# Phase 8F — Navigation alignment and safe demo data

Two separate pieces of work: put the left-hand menu into the exact order the user asked for, and give administrators a deliberate "Load demo data" button with a matching "Remove demo data" button.

No visual redesign, no new colours, no route removals, no permission changes.

## Part 1 — Left navigation

### Final menu

```text
Today                    (default screen after signing in)
Visitor List
Residents
Visitor Profiles
Registers
  Food Register
  Keys & Fob Register
Reports
  Visitor Report
  Feedback Responses
  Feedback Reports
  Safety & Compliance
  Presence Log
  Audit Log
Settings
Emergency Roll Call
Kiosk Mode
```

Every entry already has a working screen, so no placeholder pages are needed:

| Menu entry | Screen |
| --- | --- |
| Today | `/today` |
| Visitor List | `/visit-list` |
| Residents | `/residents` |
| Visitor Profiles | `/visitors` |
| Food Register | `/food-register` |
| Keys & Fob Register | `/keys` |
| Visitor Report | `/reports/visitor-report` |
| Feedback Responses | `/reports/feedback-responses` |
| Feedback Reports | `/reports/feedback-reports` |
| Safety & Compliance | `/gdpr` |
| Presence Log | `/reports/presence` |
| Audit Log | `/audit-log` |
| Settings | `/settings` |
| Emergency Roll Call | `/evacuation` |
| Kiosk Mode | `/kiosk` (opens in a new tab) |

### Duplicates to consolidate (menu only — no screen is deleted)

- "Overdue" pointed at the Visitor List: becomes the single **Visitor List** entry, keeping the overdue count as its badge.
- "Visitor reports" (`/reports`) and "Contractor documents" (`/contractor-documents`) leave the menu. Both stay reachable: the Reports home card grid keeps its links, and contractor documents also stays linked from the contractor profile. Typing the address still works.
- "Planner" (`/calendar`) leaves the menu and stays reachable by address and from Residents.
- "Audit trail" and "Settings" no longer sit under an "Administration" group; Audit Log moves under Reports and Settings becomes a top-level entry.

### Behaviour

- Signing in lands on **Today**. `/` redirects there; `/dashboard`, `/workbench` keep redirecting there too. `/visit-list` stays the Visitor List address.
- Registers and Reports are collapsible groups; a group opens automatically when the current page is inside it. Registers only lists the registers the site's operating pack switches on, and disappears entirely if both are off (unchanged rule).
- Current page is marked for screen readers and shown visually; parent group shows an open state.
- Emergency Roll Call keeps its distinct red-outlined treatment, directly above Kiosk Mode.
- Lucide icons only, each with a visible text label; no emoji or decorative symbols.
- Desktop: fixed sidebar. Tablet/mobile: existing collapsible drawer with a labelled toggle; no new pattern introduced.

## Part 2 — Demo data

### How it works for the administrator

Settings > Audit and exports gains a **Demo data** card, visible only to holders of `settings.administer`:

- Shows whether demo data is currently loaded for the selected site, when it was loaded and how many records exist.
- "Load demo data" opens a confirmation listing exactly what will be created and the site it will be created against. Nothing runs until confirmed.
- "Remove demo data" opens a confirmation showing the same counts and removes only the records created by that seed run.
- Both actions are written to the audit trail with counts.
- Never runs automatically, never on sign-in, never on first load.

### What gets created (per site, respecting the site's AU/UK pack)

All names are obviously fake — "Demo Visitor Ana", "Demo Contractor Ltd", "DEMO Resident Room 12" — and every list row that comes from the seed shows a **DEMO** tag.

- One AU example set at an AU site and one UK example set at a UK site, each using its own pack's wording; they are never mixed.
- Residents with rooms/villas and a destination.
- Visitors on site today, visitors with companions, visitors already checked out, and one arrival with no sign-out recorded.
- Screening outcomes: clear, warning, and one blocked arrival.
- Contractors with company links and documents in pending, verified and expired states.
- Food register entries and keys/fobs issued, returned and overdue.
- Feedback responses so the feedback screens and the Visitor Report have something to show.

Anything the existing schema cannot take safely is skipped and named in the card, rather than invented. Expected skips to confirm during build: emergency events (a demo roll call would create misleading compliance evidence — an administrator should start a drill instead) and kiosk devices (real device binding must not be faked).

### Technical outline

- New table `demo_seed_runs`: id, branch_id, seed_key, created_by, created_at, counts, status. Grants for authenticated and service role; RLS limits rows to sites the user can access and to `settings.administer`.
- Every seeded row is tagged. Where a table has no spare column, a `demo_seed_run_id uuid` nullable column is added — additive only, nullable, no default, no effect on existing rows or queries.
- `seed_demo_data(p_branch_id uuid)` — security definer, checks `settings.administer` and site access, refuses if an active run already exists for that site (idempotent by `seed_key = branch_id`), inserts inside one transaction, returns counts, writes an audit entry.
- `clear_demo_data(p_run_id uuid)` — same checks, deletes only rows carrying that run id, in dependency order, returns counts, writes an audit entry. It can never touch a row with a null run id.
- Rollback: remove demo data, then the additive column and tables can be dropped without affecting real records.
- Performance: a few hundred rows per site; no indexes needed beyond the run-id column.

### Acceptance criteria

Navigation
- Menu matches the list above exactly, in that order, at desktop, tablet and phone widths.
- Signing in lands on Today; every entry opens its screen; no route or permission behaves differently than before.
- No duplicate entry points to the same screen; consolidated screens remain reachable.
- One main navigation landmark, correct current-page state, no emoji.

Demo data
- Nothing seeds without an explicit confirmation from an administrator.
- A second load attempt at the same site is refused with a clear message.
- Seeded rows appear only at their own site; the other site is unaffected.
- Removal deletes exactly the seeded rows and nothing else; counts before and after match.
- Both actions appear in the audit trail with counts and the site.
- Non-administrators do not see the card and the functions refuse them.

### Tests

- Menu structure and order, active-page state, mobile drawer, registers hidden when the pack switches them off.
- Redirect from `/` to Today; each menu target renders its screen.
- Seed helper: run-key uniqueness, count summarisation, dependency-ordered delete list, refusal to delete untagged rows.
- Live check: seed an AU site, confirm Today/Visitor List/Registers/Reports all show demo rows with DEMO tags, confirm the UK site is untouched, then remove and confirm zero remain.

## Out of scope

Weekly email delivery, kiosk binding changes, contractor verification changes, historical reconciliation apply, and any broad visual redesign.
