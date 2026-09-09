# Phase 8A — Companion and Attendance Integrity

Baseline commit a5d6661. Plan only; nothing is built in this turn.

## Goal

Every person physically on site — primary visitor and each companion — is an individually accountable attendance record with their own status and departure time, while still grouped under one arrival. Reception keeps a simple one-form arrival experience.

## Findings from inspection (verified)

- 134 visitor rows: 12 with `additional_visitors > 0`, 8 with companion detail entries, 10 with a group id, and 5 rows that claim extra people but carry no companion names at all.
- Canonical tables are effectively empty relative to legacy: 3 `visits`, 4 `visit_parties`, 3 `people`, and only 3 visitor rows linked through `visits.legacy_visitor_id`. The `sync_visit_from_visitor` trigger has therefore not produced consistent coverage.
- No frontend file reads `visits` or `visit_parties`; all screens read `visitors`. Companions exist only as JSON inside `visitors.companion_details`, and departures are stamped in that JSON by `src/lib/companionCheckout.ts`.
- Companion fields are configurable per person type in `form_fields` (`CompanionFieldsManager`, `useCompanionFields`), but companion identity is never matched against `people`.
- `Visitors.tsx` dedupes the directory on `email || mobile`, so people with blank contact details collapse into one row.

## 1. Source of truth decision

Proposed and needing approval before build:

- `people` — canonical identity per person, unique within a site. Never merged on name alone.
- `visits` — one arrival event (one group), owning site, destination, source, times.
- `visit_parties` — one row per attending person, primary or companion, each with its own check-in and check-out time. This becomes the attendance source of truth.
- `visitors` — legacy compatibility record retained read-only for history, exports and any screen not yet migrated. It stays written for the primary person only, so nothing existing breaks, but no new logic reads companions from its JSON.
- `companion_details` JSON — frozen. Kept for historical display, never the basis of live counts once 8A ships.

Because presence, occupancy, roll call and reports all currently read `visitors`, migration is staged: write canonical rows first, then flip readers behind a read switch, then retire JSON reads.

## 2. Reconciliation and backfill (idempotent)

A single security-definer function `reconcile_visit_parties(p_branch_id uuid default null, p_limit int default null)` that can be run repeatedly and always converges:

- For each legacy visitor row lacking a `visits` row, create one keyed on `legacy_visitor_id` (unique), inheriting `branch_id`, times, status, group id, person type.
- Create the primary `visit_parties` row keyed on (visit_id, is_primary) so re-runs cannot duplicate.
- For each companion entry, create a party row keyed on (visit_id, companion_index).
- Named companions: use the given name; carry any stored `checkedOutAt` into the party check-out time.
- Empty or blank companion names: create a party row labelled "Companion 2" (ordinal within the visit) and flag `name_missing` so reception can complete it later. They still count for roll call.
- Duplicate companion names in one visit: keep both, disambiguated by ordinal suffix in the display name. Never dedupe within a visit.
- `additional_visitors > 0` with no companion entries (5 rows today): create the correct number of unnamed placeholder party rows so headcount matches the recorded arrival.
- Already-synchronised records: detected by the unique keys above and skipped, with counters returned.
- `people` rows are **not** created by backfill for historical companions; historical party rows keep `person_id` null and a display name only. Only forward check-ins resolve identity.
- The function returns created/skipped/flagged counts and writes one `audit_log` entry per run.

## 3. Staff check-in write path

One RPC, `check_in_party(p_payload jsonb)`, running in a single transaction:

1. Resolve or create the primary person.
2. Insert the `visits` row.
3. Insert all `visit_parties` rows.
4. Insert the legacy `visitors` row and link it.

Retry safety: the client generates a `client_request_id` (UUID) held in component state for the whole attempt and sent unchanged on retry. The RPC upserts on that key and returns the existing visit if seen before, so a retry after a timeout can never create a second arrival. Partial saves are impossible because everything is one transaction.

## 4. Identity matching safeguards

Lookup is scoped to the current site only. Matching order:

1. Exact QR / person code match — auto-link.
2. Exact mobile or email match (normalised) — auto-link.
3. Name-only match — **never auto-linked**. Reception sees a small "Possible match" prompt listing candidates with last visit date, and must choose "This is them" or "New person". Default is New person.
4. No contact details at all — always create a new person.

No background merge job, no fuzzy merge. Merging existing duplicates is out of scope for 8A and flagged as a separate decision.

## 5. Configured companion fields

`form_fields` with the companion scope continue to drive the companion sub-form per person type: which fields appear, their order, labels and required flag. Validation rules:

- A field marked required must be completed for every companion before "Sign in" enables.
- If the name field is inactive for a person type, companions are recorded as ordinal placeholders and counted, without blocking arrival.
- Required-field errors are shown inline per companion row with a text message, no symbols.
- Configuration is read-only in this phase; no settings keys change.

## 6. Per-person attendance

Each `visit_parties` row carries its own status and check-out time. The visit is open while any party row is open, and closes automatically when the last one departs. Checkout options in the existing sheet:

- Check out one person.
- Check out selected people.
- Check out the whole group.

Group grouping is preserved through `visit_id`, so companions never lose their link to the primary.

## 7. Visit List behaviour

- Default view lists every person individually — this is the accountability default.
- A "Group arrivals" toggle collapses a party into one row with a count and an expander; state is per user session, not stored in settings.
- Each row shows a plain text label: "Primary" or "With <primary name>".
- Counts in the summary strip count people, not arrivals.
- Existing privacy rules (destination hiding, resident lookup mode) apply identically to companion rows; companions never reveal more than the primary row would.
- Lucide icons with visible labels only.

## 8. Downstream impact

- **Emergency roll call** — attendance built from open `visit_parties` rows, so unnamed companions appear as "Companion 2 (with Jane Smith)" and must be marked safe individually. This is the largest safety gain of the phase.
- **Presence log / occupancy** — counts people rather than arrivals; numbers will rise for existing sites and this must be explained to users.
- **Badges** — one badge per person; group print prints the set.
- **Reports and exports** — gain a person-level row; totals change. Historical rows before backfill remain approximations and are labelled as such.
- **Profile history** — companion visits appear on that person's timeline only where a person was resolved; historical unresolved companions stay on the primary's record.

## 9. Isolation and permissions

- Every new query and RPC filters on the caller's accessible sites via the existing site-access helper. Party rows inherit `branch_id` from the visit.
- RLS on `visit_parties` and `visits` follows the existing visitors pattern: site-scoped read for staff, writes through the RPC only.
- Permissions reuse `checkin.create` and `checkout.perform`. No new permission values.

## 10. Technical scope

Migrations:
- Add `branch_id`, `status`, `person_type`, `companion_index`, `is_primary` handling and `client_request_id` where missing on `visits` / `visit_parties`; unique constraints for idempotency.
- GRANTs and RLS policies for both tables.
- Functions: `check_in_party`, `check_out_party`, `reconcile_visit_parties`; review `sync_visit_from_visitor` so it cannot fight the new writer.

Frontend files expected to change:
`src/hooks/useVisitors.ts`, `src/hooks/useVisitorHistory.ts`, `src/components/checkin/useCheckInFlow.ts`, `StepDetails.tsx`, `StepConfirm.tsx`, `src/components/CheckOutSheet.tsx`, `src/lib/companionCheckout.ts`, `src/components/VisitorTable.tsx`, `src/pages/VisitList.tsx`, `src/pages/Visitors.tsx` (dedupe fix — key on person id, never on blank contact), `src/hooks/useEvacuation.ts`, `src/lib/evacuation.ts`, `src/lib/badgeIssue.ts`, `src/lib/exportVisitors.ts`.

Kiosk (`useKioskCheckInFlow.ts`, `kiosk_check_in`) is updated in the same phase so both entry points write canonical rows; otherwise kiosk arrivals would regress.

## 11. Test plan

Staff check-in with 0/1/3 companions; blank companion names; two companions with the same name; retry after a forced network failure (must produce exactly one visit); refresh and re-login mid-flow; kiosk check-in with companions; check out one companion, then the primary, then the group; bulk group checkout; roll call with an open party mid-drill; historical report before and after backfill; two different people with the same name and no contact details (must stay separate); a person with blank email and mobile (must not collapse in the directory); cross-site check that site B never sees site A parties; reconciliation run twice producing zero changes on the second run.

## 12. Rollback and compatibility

- Legacy `visitors` writes continue throughout, so rolling the frontend back to the previous commit yields a working app on unchanged data.
- Readers flip behind a single internal switch, allowing a code-only rollback without touching data.
- Backfill only inserts; it never edits or deletes legacy rows, so it can be reversed by deleting rows created by a tagged run.

## Blockers and decisions needing approval

1. Confirm `visit_parties` becomes the attendance source of truth and `companion_details` is frozen.
2. Occupancy and report numbers will increase once companions count individually. Confirm this is acceptable and how it should be explained.
3. Historical companions get no `people` identity. Confirm.
4. Merging existing duplicate people is excluded from 8A.
5. Kiosk must be included in the same phase; confirm the wider scope.
6. Placeholder rows for the 5 records with headcount but no names — confirm labelling as "Companion 2" etc.

## Prototype limitation

This is prototype work. Improved roll-call accountability is a design goal, not certified regulatory compliance, and must not be presented as such without independent review.
