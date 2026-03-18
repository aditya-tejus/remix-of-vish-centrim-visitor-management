

# Deep Analysis: Mismatches, Gaps & Integration Issues

## 1. MOCK DATA STILL IN USE

**AddVisitDialog.tsx (line 41-46)** still contains hardcoded `mockProfiles` for visitor search. When staff type a name, they only see 4 fake profiles (John Smith, Sarah Williams, James Brown, Emma Johnson) instead of querying previous visitors from the database. This should query real `visitors` table for returning visitor lookup.

## 2. WATCHLIST NOT ENFORCED DURING CHECK-IN

The `useWatchlist` hook has a `checkVisitor()` function and `WatchlistAlertDialog` exists, but **neither `AddVisitDialog`, `KioskCheckIn`, `PublicCheckIn`, nor `GroupCheckIn` call them**. The watchlist is only used on the Visitors directory page. A banned visitor can check in freely through any flow.

## 3. GROUP CHECK-IN DOESN'T USE `group_id`

`GroupCheckIn.tsx` generates a `groupId` (line 48) but **never passes it** to `addVisitor()`. The `group_id` column exists in the DB but is never populated. Group checkout (Screen 9, marked "partial") has no implementation — there's no prompt asking "Check out whole group?"

## 4. RESIDENT LEAVE PAGE `onSubmit` IS BROKEN

`ResidentLeave.tsx` line 198: `<ResidentLeaveDialog ... onSubmit={() => {}} />` — the submit callback is an empty function. When staff marks a resident as away through this page, the data is silently discarded. Should use `addVisitor` from `useVisitors()` or equivalent.

## 5. DUPLICATE / OVERLAPPING PAGES

| Route | Page | Overlap |
|-------|------|---------|
| `/check-in` | CheckIn.tsx | Opens same `AddVisitDialog` as HomeWorkbench and PersonTypeSelector |
| `/person-type` | PersonTypeSelector.tsx | Also opens `AddVisitDialog` — doesn't pre-select the type clicked |
| `/visitor-analytics` | VisitorAnalytics.tsx | Separate from `/reports/trends` (VisitTrends) but shows similar data |
| `/reports/analytics` | Reports.tsx (old) | Overlaps with VisitorAnalytics |
| `/leave-requests` and `/checkout-requests` | Both route to same LeaveRequests.tsx | Sidebar shows them as separate items |

**PersonTypeSelector** opens `AddVisitDialog` but doesn't pass `selectedType` to it, so the dialog always starts on its own type selector — defeating the purpose of the tile selection.

## 6. KIOSK MODE GAPS

- **KioskCheckIn** inserts directly into Supabase (bypasses `useVisitors` hook) — no optimistic UI, no realtime sync with staff desktop, no health screening, no privacy acknowledgment, no watchlist check.
- **KioskCheckOut** and **KioskResidentLeave** use `useVisitors()` hook correctly but KioskCheckIn doesn't.
- **No kiosk QR route** — Screen 33 (Kiosk QR Fast Lane) points to `/qr-fast-lane` (staff page with sidebar), not a kiosk-compatible version.
- **No "Staff" type in kiosk** — KioskCheckIn only offers Visitor/Contractor/Volunteer but the staff flow exists elsewhere.

## 7. PUBLIC CHECK-IN ISSUES

- `PublicCheckIn.tsx` still shows "Resident" as a type option (line 19) — residents shouldn't self-check-in via public form.
- Hardcoded health questions (line 23-29) instead of using the DB-driven `useActiveHealthQuestions` hook.
- No watchlist check.
- Collects `address` for all types — violates GDPR data minimisation for social visitors.

## 8. EVACUATION PAGE DOESN'T PERSIST

The Evacuation page (`Evacuation.tsx`) manages `safeIds` in local React state only. The `evacuation_drills` and `evacuation_attendance` tables exist but are **never written to** from this page. Closing the browser loses the roll call. The EvacuationReport page reads from `evacuation_drills` but since nothing writes there, it always shows empty.

## 9. SETTINGS TABS MISMATCHES

- Settings has 14 tabs but Coverage Checklist shows 12 settings screens (18-29). Missing from Coverage: "Feedback" and "Returns" settings tabs.
- Settings "GDPR" tab shows `ComplianceTab` component but sidebar nav has a separate `/gdpr` page (GDPRPage) — two separate GDPR sections with potentially different content.
- Settings "Audit" tab vs standalone `/audit-log` page — both exist, unclear which is primary.

## 10. DATA MODEL DISCONNECTS

- **`whom_to_visit`** remains free text everywhere despite `visited_resident_ids` (uuid[]) column existing in DB. No component writes to or reads from `visited_resident_ids`.
- **`visit_purpose`** column exists in DB but no UI sets it anywhere. PersonTypeSelector and AddVisitDialog don't offer purpose categories (Social, Professional, Delivery, etc.).
- **`work_type` / `work_location`** columns exist but GroupCheckIn and ContractorScreening don't populate them.
- **`print_status`** column exists but no badge printing logic writes to it.
- **`qr_code`** column exists but QRFastLane matches by ID/name, not by an actual generated QR code value.
- **`safeguarding_hold`** column exists but nothing sets it and erasure doesn't check it.

## 11. `useVisitors` FETCHES ALL RECORDS

`useVisitors()` does `SELECT * FROM visitors` with no date filter. As the system accumulates data, this will pull every historical record, hitting the 1000-row Supabase default limit and causing:
- Dashboard counts to be wrong (only showing recent 1000)
- VisitTrends/PresenceLog to have incomplete data
- Slow load times

Multiple pages all instantiate `useVisitors()` independently (HomeWorkbench, VisitList, Evacuation, ResidentLeave, QRFastLane, GroupCheckIn, etc.), each creating separate subscriptions and fetches.

## 12. SIDEBAR NAV vs ACTUAL ROUTES

- Sidebar "Checkout Requests" → `/checkout-requests` and "Leave Requests" → `/leave-requests` both render the same `LeaveRequests` component with no way to distinguish context.
- No sidebar link to `/public-checkin` (intentional, but Coverage Checklist doesn't track it).
- No sidebar link for the standalone EvacuationReport, PresenceLog, or VisitTrends — only reachable via ReportsHome cards.

## 13. MISSING UX STATES

Most pages added in Phase 6-7 have loading skeletons but:
- **GroupCheckIn**: No loading state, no error handling on submission failure
- **QRFastLane**: No loading state
- **PersonTypeSelector**: No loading state
- **HomeWorkbench**: No loading skeleton for the main content
- **CoverageChecklist**: Static data — should track real completion status, not hardcoded statuses

## 14. AUDIT LOGGING GAPS

Only `VisitorProfilePage` writes to `audit_log`. None of these actions log:
- Check-in, check-out, group check-in
- Resident leave/return
- Settings changes
- Watchlist additions
- Evacuation drills

## 15. RECOMMENDED CONSOLIDATION

| What | Action |
|------|--------|
| `mockProfiles` in AddVisitDialog | Replace with DB query of previous visitors |
| `/check-in` and `/person-type` | Merge — PersonTypeSelector should pass selected type to AddVisitDialog |
| `/visitor-analytics` and `/reports/analytics` | Merge into one route under `/reports` |
| `/leave-requests` and `/checkout-requests` | Add URL param or separate components |
| Watchlist check | Add to AddVisitDialog, KioskCheckIn, PublicCheckIn, GroupCheckIn |
| Evacuation persistence | Write drill/attendance records to DB tables |
| `useVisitors` | Add date filtering, share via context instead of re-instantiating |
| Settings GDPR vs /gdpr page | Consolidate or make Settings link to /gdpr |
| Settings Audit vs /audit-log | Same — pick one |

---

This analysis identifies 15 categories of issues. The most critical are: watchlist not enforced (safety), ResidentLeave submit broken (data loss), Kiosk bypassing hooks (data integrity), and mockProfiles still hardcoded (usability).

