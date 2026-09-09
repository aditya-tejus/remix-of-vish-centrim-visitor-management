# Phase 7A — Reception workflow and Visit List

Baseline: Stage 6C (44bdf38). The Visitor List already opens at `/` and defaults to "On site now". This phase sharpens it into a working reception surface without adding a second list, a second visitor model or a second status model.

## 1. Reception jobs and current friction

| Job | Friction today |
| --- | --- |
| Someone is at the desk — find or check them in | Search sits between the date nav and the action buttons and is easy to miss; no keyboard focus shortcut cue; no "no match — check in as new" path from an empty search |
| Know who is in the building | Counters, filter pill and type tabs are three separate controls that all filter the same list; the "Filtering:" pill duplicates the selected card |
| Chase overdue people | Overdue is a counter and a red marker, but there is no view that puts overdue at the top with the phone number and the person to call |
| Clear the board at handover | Bulk check-out exists but the tick box column is always present and empty for people who have left |
| Answer "was so-and-so here?" | Only one day at a time; no "recent activity" glance across the last few hours/days |
| Repeat visitor at the desk | Returning-visitor lookup lives inside the check-in sheet only; searching the list for a name that left yesterday returns nothing and offers no next step |
| Save failure | `addVisitor` rolls back optimistically and toasts, but the sheet has already closed, so the entry has to be retyped |

## 2. Proposed information hierarchy

Top to bottom, one column:

```text
Header: site name · date · Overdue badge
Command bar: search (primary, widest) · Check In · Check Out · QR · Handover · date step
View switch: On site now | Expected today | Overdue | Recent activity
Optional person-type chips: All · Visitors · Contractors · Volunteers · Staff
Table
```

Changes: the counter cards and the "Filtering:" pill are folded into the view switch (each view label carries its own count), so one control drives what is shown. Person type stops being a second row of tabs inside the table and becomes a chip row above it. The date stepper moves to the right of the command bar because most shifts never change it.

## 3. The four views

All four are derived client-side from the same `useVisitors` result and the same `status` values — no new status model, no new query.

- **On site now** (default) — `status === "checked-in"` for the selected date, sorted by check-in time descending. Row shows In, expected Out, who they are visiting, companions, flags.
- **Expected today** — people with an expected return/departure today who are not currently on site (residents on leave with an `expectedReturnDate` today, and pre-registered arrivals where they exist). Where no expectation data exists the view shows an honest empty state rather than an invented list.
- **Overdue** — `isOverstayed(v)` per the existing per-type `useOverstayPolicy`. Sorted by longest over first; row surfaces mobile number and a Check Out action directly.
- **Recent activity** — everyone with movement on the selected date, in reverse chronological order of the last event (checked out, then checked in), so the desk can answer "who just left".

Counts on each view respect the selected date, search text and the person-type chip.

## 4. Search, filters, site and date

- Search stays as today (name, mobile, email, whom-to-visit, linked resident name/room/area) and gains focus on `/`.
- When search returns nothing: a single inline result panel with "No one matching *text* today" and two actions — "Search all dates" (widens to a name lookup across the person's history via the existing profile route) and "Check in as new".
- Person-type chips are driven by `usePersonTypes` so disabled/renamed types follow site configuration; Staff stays a separate type.
- Site comes from `SiteContext` only. No cross-site view is added. Legacy-site null-branch behaviour in `useVisitors` is untouched.
- Date stepper keeps back/forward/Today/calendar. A non-today date shows a clear "Viewing 3 Sep" marker next to the view switch so counts are never mistaken for live.

## 5. Row actions

- **Primary, always visible:** Check Out / Sign Out / Depart (label by type). One tap opens `CheckOutSheet` pre-selected, with the existing manual time override.
- **Secondary, in the row menu:** Print badge, Export CSV, Export PDF, Give feedback, then a separator and Delete record (destructive, confirmed, permission-gated).
- Row body click still opens the full profile; the name remains a link.
- Selection checkboxes only render for rows that can be checked out, and the header gains a select-all for the current view.

## 6. Progressive disclosure by type

One row template, type-specific supporting line under the name:

- Visitor: resident being visited plus room/area; companion count expands inline to a list of companion names with individual departure (existing behaviour), not a nested dialog.
- Contractor: company, work type and a compliance chip (Clear / Missing evidence) from the existing contractor credential evaluation; escort-required marker when set.
- Volunteer: area/department and companions where applicable.
- Staff: department only, no visiting/companion columns.
- Flags (watchlist, key out/overdue, overdue stay) are icon markers with tooltips, never emojis, drawn from `lucide-react` only.

## 7. Save failure, duplicates and recovery

- `CheckInSheet` keeps the sheet open until the insert resolves; on failure it stays on the confirm step with an inline error and a Retry button, preserving entered data.
- A `submittingRef` guard plus a disabled submit button prevents double submission (mirrors the kiosk fix already in place).
- Optimistic rows render at reduced emphasis with a "Saving" marker until confirmed, then settle; on rollback the row disappears and the sheet shows the error.
- Duplicate-arrival guard: if a person with the same name and mobile is already `checked-in` today at this site, the confirm step warns "Already shown as on site since 10:14 am" with Continue anyway / Open their record.
- Check-out failures roll back the row and keep the sheet open with the same treatment.

## 8. Tablet and narrow screens

- ≥1280px: full table as described.
- 768–1279px: Out-column expectation text collapses under In; companions become an icon count; overflow menu keeps all secondary actions.
- <768px: the table becomes stacked cards — name and flags, In/Out line, visiting line, one primary action button, one overflow button. View switch becomes a horizontally scrollable chip row. Command bar wraps with search full width. Touch targets at least 44px.

## 9. Privacy and display names

- The list shows the resident/destination only when the site's destination-privacy setting allows it; otherwise it shows the area label or "Recorded" (reusing the existing badge/destination privacy setting rather than adding a new one).
- Mobile numbers appear only in the Overdue view row expansion and the profile, not in the default list.
- Health, screening answers and contractor evidence never appear in list rows — chips only, with the detail behind the permission-gated profile.
- Terminology (area/room/villa/unit) comes from `useSiteStructure` / operating-context packs so AU RAC, AU RV and UK care read correctly.

## 10. Permissions and audit

- `presence.view` gates the page; without it, the existing permission-denied state renders.
- `checkin.create` gates the Check In button; `checkout.perform` gates row and bulk check-out; `data.export` gates CSV/PDF; `person.edit` gates Delete. Hidden rather than shown-and-failing.
- Audit: no new audit events for viewing. Existing audited actions (check-out, exports, badge issue, delete) keep their entries; bulk check-out writes one entry per person with the actor and any time override reason, matching current single check-out behaviour.

## 11. Reuse versus new

Reuse: `useVisitors`, `useOverstayPolicy`, `useOpenKeyIssues`, `useWatchlist`, `useResidents`, `usePersonTypes`, `useSiteStructure`, `usePermissions`, `CheckOutSheet`, `CheckInSheet`, `HandoverPrintDialog`, `VisitListQRDialog`, `FeedbackDialog`, states in `src/components/states`, shadcn table/tabs/dropdown/checkbox, `lucide-react` icons, existing semantic tokens.

New (presentation only): `VisitViewSwitch.tsx` (counted view segments), `VisitRowCard.tsx` (narrow-screen card), `useVisitViews.ts` (pure derivation of the four views from the existing visitor array — no new fetch).

Removed: `TabContextStats` usage on this page (component retained until no consumer remains), and the separate "Filtering:" pill.

## 12. Files, routes, migrations

Changed:
- `src/pages/VisitList.tsx` — command bar order, view switch, chips, empty-search panel, non-today marker, permission gating.
- `src/components/VisitorTable.tsx` — type chips instead of internal tabs, per-type supporting line, selection only on eligible rows, select-all, action/menu split, responsive card mode.
- `src/components/checkin/CheckInSheet.tsx` + `src/components/checkin/useCheckInFlow.ts` — keep-open-until-saved, submit guard, duplicate warning, retry.
- `src/hooks/useVisitors.ts` — surface a save result (resolved promise / status) so the sheet can await it; no query or model change.
- `src/components/CheckOutSheet.tsx` — failure keeps the sheet open with retry.

New: `src/components/visitlist/VisitViewSwitch.tsx`, `src/components/visitlist/VisitRowCard.tsx`, `src/hooks/useVisitViews.ts`.

Routes: unchanged. `/` stays Visit List, `/visit-list` stays an alias.

Migrations: none. No schema, RLS or RPC change in Phase 7A.

## 13. Acceptance tests

| # | Behaviour | Expected |
| --- | --- | --- |
| 1 | Sign in as reception | Lands on Visit List, On site now selected |
| 2 | Check in an ordinary visitor | Same number of steps as today; row appears; badge action available only if enabled |
| 3 | Save fails (offline) | Sheet stays open, data preserved, retry works, no phantom row remains |
| 4 | Submit twice quickly | Exactly one record created |
| 5 | Same person already on site | Duplicate warning with Continue / Open record |
| 6 | Switch views | Counts on each view match the rows shown, for the selected date, search and type chip |
| 7 | Overdue view | Only over-policy people, longest first, per-type hours honoured |
| 8 | Search with no match | Inline panel with Search all dates and Check in as new |
| 9 | Row check-out | Correct label by type, time override available, list updates |
| 10 | Bulk check-out | Only eligible rows selectable; one audit entry per person |
| 11 | Permissions | Without `checkout.perform` no check-out controls; without `data.export` no export items |
| 12 | Site isolation | Site A records never visible at site B; legacy-site null rows behave as today |
| 13 | Destination privacy off | Resident name replaced by area/"Recorded" in list rows |
| 14 | AU RV / UK site | Villa/Unit terminology correct across rows and empty states |
| 15 | Narrow screen | No horizontal overflow at 375px and 768px; primary action reachable |
| 16 | Offline / error / loading | Existing shared states render, retry restores the list |
| 17 | Kiosk untouched | Kiosk flows unchanged and still make no sensitive table reads |

## Risks

- Folding counters and tabs into one control changes muscle memory for anyone used to the current layout; mitigated by keeping the same labels and counts.
- "Expected today" has thin underlying data (resident leave returns only); it may look empty at most sites. Alternative is to drop it from 7A.
- Keeping the check-in sheet open until save resolves changes perceived speed on a slow connection; mitigated by an inline saving state rather than a blocking overlay.
- Responsive card mode duplicates row logic if not carefully shared.

## Open questions

1. Keep "Expected today" in 7A given it can only be populated from resident leave returns, or defer it until pre-registration exists?
2. Should the person-type chips remember the last selection per user, or always reset to All at the start of a shift?
3. Should "Search all dates" open the person's profile directly, or show a cross-date result list on the Visit List?
4. Is Delete record acceptable as `person.edit`, or should it require an admin role?

## Non-goals

No group check-in, QR Fast Lane, volunteer screens, emergency redesign, settings consolidation or new reports. No second visitor list, visitor model or status model. No schema, RLS or RPC changes. No AU/UK forks. No emojis. No destructive data changes. Phases 7B–7F are out of scope.
