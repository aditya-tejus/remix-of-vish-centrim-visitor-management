# Phase 8A (revised) — Companion and Attendance Integrity

Baseline commit a5d6661. Plan only. No code, migrations or data changes in this turn.

## Verified current state

Data (queried):
- 134 legacy `visitors` rows: 12 with `additional_visitors > 0`, 8 with companion entries, 10 with a group id, 5 claiming extra people but carrying no companion names.
- Canonical tables: 3 `visits`, 4 `visit_parties`, 3 `people`; only 3 legacy rows linked via `visits.legacy_visitor_id`.

Existing trigger `sync_visit_from_visitor` (read in full) already:
- skips residents; resolves branch via `default_site_id()`; normalises status;
- finds or creates a `people` row by `legacy_visitor_id` or `person_qr`;
- creates or updates the `visits` row keyed on `legacy_visitor_id`;
- creates the primary party if absent and keeps its check-out time in step;
- creates or updates named companion parties, matched by `display_name`;
- **ignores** companions with a blank name and ignores `additional_visitors` entirely.

Existing columns (verified) — nothing needs re-adding:
- `visits`: id, branch_id, person_id, person_type, status, check_in_time, check_out_time, destination_wing_id, destination_resident_person_id, destination_label, group_id, source, legacy_visitor_id, created_at, updated_at.
- `visit_parties`: id, visit_id, person_id, display_name, relationship, is_primary, check_in_time, check_out_time, created_at, updated_at.
- `people`: id, first_name, surname, email, mobile, person_qr, default_person_type, organisation_id, branch_id, external_source, external_id, legacy_visitor_id, is_active, created_at, updated_at.

Frontend: no file reads `visits` or `visit_parties`. Companion departures are stamped into JSON by `src/lib/companionCheckout.ts`. `Visitors.tsx` dedupes on `email || mobile`, collapsing people with blank contacts.

## 1. Source of truth and the trigger conflict — resolved

**One authoritative writer: the trigger.** The check-in RPC does **not** write canonical tables directly. It writes the legacy `visitors` row inside one transaction; `sync_visit_from_visitor` produces `people`, `visits` and `visit_parties` in the same transaction; the RPC then reads back and returns `visit_id` plus the party ids. Duplicate canonical records are structurally impossible because only one code path inserts them.

This is chosen over "canonical first, legacy second" precisely because the latter would require suppressing or reconciling the trigger and leaves a duplicate-creation window.

Trigger changes required (extend, do not replace the pattern):
- Handle blank-named companions: create ordinal placeholder parties ("Companion 2", "Companion 3") instead of skipping them.
- Handle `additional_visitors > n` with fewer companion entries: top up to the recorded headcount with placeholders.
- Match companion parties by `(visit_id, companion_index)` rather than `display_name`, so duplicate names in one party stop colliding.
- Do not clobber a party check-out time that is already set from the party-level path (only fill nulls from the legacy row).
- Remain idempotent for repeat firing and for reconciliation re-runs.

Roles after 8A: `people` = identity; `visits` = arrival event; `visit_parties` = attendance source of truth; `visitors` = compatibility record still written for the primary; `companion_details` JSON = frozen historical display only.

## 2. Precise schema delta

`visit_parties` — add:
- `companion_index int not null default 0` (0 = primary; 1..n = companions in order).
- `status text not null default 'checked-in'` — individually mutable attendance status.
- `name_status text not null default 'named'` with values `named` | `unresolved`.
- unique index on `(visit_id, companion_index)`.
- partial unique index on `(visit_id)` where `is_primary` — one primary per visit.

`visits` — add:
- `client_request_id uuid` with a unique index — retry idempotency key.
- no other column changes; `status` becomes derived (see §6).

`people` — no changes.

Also required: GRANTs for `authenticated`/`service_role` and site-scoped RLS on `visits` and `visit_parties` (reads scoped by `branch_id` through the existing site-access helper; writes via RPC only). Backfill of `companion_index` for the 4 existing party rows is part of reconciliation.

## 3. Historical reconciliation vs forward check-in — separated

**Reconciliation (`reconcile_visit_parties`, security definer, idempotent, per-site, dry-run flag):** covers history only. It creates missing visits and parties from legacy rows, fills `companion_index`, creates placeholder parties for unnamed companions and for the 5 headcount-only rows, and marks them `name_status = 'unresolved'`. It never creates `people` rows for historical companions (`person_id` stays null), never edits or deletes legacy rows, and reports created/skipped/flagged counts plus one `audit_log` entry per run. Second run must report zero changes.

**Forward check-in:** companions are resolvable people. Where the configured companion fields include name and contact, reception can pick an existing person from this site or create a new one, and the party row gets a real `person_id`.

## 4. Unresolved companions — display and later completion

- Shown everywhere as "Companion 2 — with Jane Smith", with a plain "Details missing" text marker (no symbol).
- They count fully in occupancy and roll call.
- A "Add this person's details" action on the party row sets `display_name`, optional `person_id` and flips `name_status` to `named`.
- Completion updates identity fields only. `check_in_time`, `check_out_time`, `visit_id` and `companion_index` are immutable through that action, so the original attendance event is never rewritten; the change is written to `audit_log`.

## 5. Reader cutover

Order, one screen group per build increment behind a single internal read switch:
1. Emergency Roll Call (`useEvacuation.ts`, `lib/evacuation.ts`) — largest safety gain.
2. Visit List / presence (`useVisitors.ts`, `VisitorTable.tsx`, `VisitList.tsx`) and checkout (`CheckOutSheet.tsx`, `lib/companionCheckout.ts`).
3. Visitors directory (`Visitors.tsx` — dedupe by person id, never by blank contact), profile history (`useVisitorHistory.ts`, `VisitorProfile.tsx`).
4. Badges and exports (`lib/badgeIssue.ts`, `lib/exportVisitors.ts`).

Compatibility: legacy `visitors` rows keep being written and kept in step for the primary throughout, so reverting the frontend to the previous commit yields a fully working app on unchanged data. Rollback is code-only.

## 6. Individually mutable status, derived visit status

- `check_out_party(p_party_id, p_time)` sets one party's status and check-out time.
- A trigger on `visit_parties` recomputes the parent visit: open while any party is open; `check_out_time` = latest party departure once all are closed.
- Bulk actions call the same RPC per party inside one transaction: check out one person, selected people, or the whole group.
- The legacy `visitors` row is updated to stay consistent for the primary, with recursion guarded.

## 7. Data-quality report (read-only)

`visit_integrity_report()` returning counts and sample ids for:
- legacy visitors with no visit (orphaned visitors);
- visits with no `legacy_visitor_id` and no parties (orphaned visits);
- visits with no primary party;
- headcount mismatch: `1 + additional_visitors` vs party count;
- duplicate parties on the same `(visit_id, companion_index)` prior to the unique index;
- parties whose visit is closed but which remain open, and vice versa.

Read-only, safe to run any time, surfaced to admins only; run before and after reconciliation.

## 8. Explicitly out of scope

Kiosk device binding, weekly reports, contractor verification and screening-question outcomes are separate phases. The only kiosk touch in 8A is a compatibility one: `kiosk_check_in` must set companion data so the same trigger produces the same canonical rows — no kiosk UX change.

## 9. Identity matching safeguards

Site-scoped lookup only. Auto-link on exact person QR, or exact normalised mobile/email. Name-only matches are never auto-linked: reception sees candidate names with last visit date and must choose explicitly, defaulting to "New person". No contact details means a new person. No merge job; merging existing duplicate people is out of scope.

## 10. Configured companion fields

`form_fields` companion scope continues to drive which fields show, order, labels and required flags per person type. Required fields must be complete for every companion before sign-in enables, with inline text errors. If the name field is inactive for a type, companions are recorded as ordinal placeholders and still counted. No settings keys change.

## 11. UX constraints

Individual accountability by default; an optional session-only "Group arrivals" collapse with a count and expander; plain text "Primary" / "With <name>" labels; existing destination and resident privacy rules apply identically to companion rows; labelled Lucide icons only, no emoji or symbol UI.

## 12. Test plan

Staff check-in with 0/1/3 companions; blank companion names; two companions with the same name in one party; forced network failure then retry (exactly one visit via `client_request_id`); refresh and re-login mid-flow; kiosk check-in with companions producing identical canonical rows; check out one companion, then the primary, then the whole group; bulk group checkout; roll call with an open party mid-drill; historical report before and after reconciliation; reconciliation run twice with zero second-run changes; integrity report clean after reconciliation; two same-name people with no contacts stay separate; blank-contact people do not collapse in the directory; site B never sees site A parties; rollback to previous frontend commit still works on migrated data.

## 13. Rollback

Migrations are additive only. Reconciliation only inserts, tagged by run so a run can be reversed. Readers flip behind one switch. Trigger changes are a function replacement with the prior definition retained for immediate restore.

## Remaining decisions needing approval

1. Trigger-as-authoritative-writer pattern (legacy insert drives canonical rows) — confirm.
2. Occupancy, roll-call and report totals will rise once companions count individually; confirm and confirm the wording used to explain it.
3. Historical companions get no `people` identity; confirm.
4. Placeholder labelling "Companion 2" for the 5 headcount-only rows and all blank names; confirm.
5. Merging existing duplicate people excluded from 8A; confirm.
6. Reader cutover order above; confirm Roll Call goes first.
7. Whether the "Add this person's details" completion action is limited to a permission (suggested: `person.edit`).

Note: roadmap.md gains a Phase 8A entry with these items at build time; this turn is plan-only, so no file outside the plan is touched.

## Prototype limitation

Prototype work. Better companion accountability is a design goal, not certified regulatory compliance, and must not be presented as such without independent review.
