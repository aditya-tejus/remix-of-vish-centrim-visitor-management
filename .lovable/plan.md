# Phase 8A (final) — Companion and Attendance Integrity

Baseline commit a5d6661. Plan only. No code, migrations or data changes in this turn.

## Verified current state

Data (queried): 134 legacy `visitors` rows — 12 with `additional_visitors > 0`, 8 with companion entries, 10 with a group id, 5 claiming extra people with no companion names. Canonical tables hold 3 `visits`, 4 `visit_parties`, 3 `people`; only 3 legacy rows are linked via `visits.legacy_visitor_id`.

Trigger `sync_visit_from_visitor` (read in full): skips residents, resolves branch, normalises status, finds/creates `people` by `legacy_visitor_id` or `person_qr`, creates/updates `visits` keyed on `legacy_visitor_id`, creates the primary party, creates/updates named companion parties matched by `display_name`, and **ignores blank-named companions and `additional_visitors` entirely**.

Existing columns (verified — none of these need re-adding):
- `visits`: id, branch_id, person_id, person_type, status, check_in_time, check_out_time, destination_wing_id, destination_resident_person_id, destination_label, group_id, source, legacy_visitor_id, created_at, updated_at.
- `visit_parties`: id, visit_id, person_id, display_name, relationship, is_primary, check_in_time, check_out_time, created_at, updated_at.
- `people`: id, first_name, surname, email, mobile, person_qr, default_person_type, organisation_id, branch_id, external_source, external_id, legacy_visitor_id, is_active, created_at, updated_at.

Frontend reads no canonical table today. Companion departures are stamped into JSON by `src/lib/companionCheckout.ts`. `Visitors.tsx` dedupes on `email || mobile`, collapsing blank-contact people.

## 1. Authoritative write pattern

**The trigger stays the single writer of canonical rows.** `check_in_party(p_payload jsonb)` writes the legacy `visitors` row inside one transaction; `sync_visit_from_visitor` produces `people`, `visits` and `visit_parties` in that same transaction; the RPC reads back and returns `visit_id` and party ids. No second path inserts canonical rows, so duplicates are structurally impossible and rollback stays code-only.

Trigger extensions: create ordinal placeholders for blank-named companions, top up to `additional_visitors` headcount, match companion parties by `companion_index` (never `display_name`), link `person_id` from the payload (§3), and never overwrite a non-null party check-out time.

Roles: `people` = identity, `visits` = arrival event, `visit_parties` = attendance source of truth, `visitors` = compatibility record for the primary, `companion_details` JSON = frozen historical/compatibility display.

## 2. Retry idempotency — corrected

Because the legacy insert happens first and drives the trigger, the request key must live on `visitors`, not only on `visits`.

- Add `client_request_id uuid` to **`visitors`** and to **`visits`**.
- `visitors`: partial unique index `where client_request_id is not null` — all 134 existing rows keep null and remain valid; no backfill.
- `visits`: same partial unique index; the trigger copies the value from `NEW.client_request_id`.
- Scope: global unique, since UUIDv4 is generated client-side per check-in attempt and held in component state across retries.
- `check_in_party` first looks up `visitors` by `client_request_id`; on a hit it returns the existing visit and parties instead of inserting. A timeout followed by retry therefore yields exactly one legacy row and one canonical visit.
- Kiosk `kiosk_check_in` accepts and stores the same key (compatibility only, no kiosk UX change).

## 3. Companion identity payload contract — corrected

`companion_details` entries gain optional identity keys, additive to the existing name/phone/id_number shape:

```text
{ name, relation, phone, id_number,          // existing, unchanged
  person_id,        // uuid of an existing person chosen by reception, or null
  create_person,    // true when reception entered a new person to be stored
  email, mobile }   // used only when create_person is true
```

Trigger behaviour per companion, keyed on array position (`companion_index`):
- `person_id` present → validate then set `visit_parties.person_id` directly. Never matched by `display_name`.
- `create_person` true → insert a `people` row on the visit's `branch_id` and link it.
- Neither → party row with `person_id` null and `name_status` set accordingly.

Site validation: a supplied `person_id` is accepted only if that `people` row's `branch_id` equals the visit's branch (or is null on a legacy site). A cross-site or unknown id is rejected — the whole transaction fails with a clear error rather than silently downgrading to an unlinked party, so reception is never told a link was made that was not.

UI lookup rules: site-scoped only; auto-link on exact person QR or exact normalised mobile/email; name-only matches are never auto-linked — reception picks from candidates showing last visit date, default "New person"; no contact details means a new person. No merge job; merging existing duplicate people is out of scope.

## 4. Status and checkout authority — resolved

- **Party status is authoritative for attendance.** `visit_parties.status` and `check_out_time` are set only by `check_out_party` (or the initial insert).
- **The parent visit is derived.** An `AFTER` trigger on `visit_parties` recomputes `visits.status` and `check_out_time`: open while any party is open; closed with the latest party departure once all are closed. Nothing else writes `visits.status`.
- **`sync_visit_from_visitor` stops asserting closure.** It may create rows and fill *null* times, but it must not close a visit or a party while any other party is open, and must not overwrite a non-null party `check_out_time`. This removes the conflict between the two triggers.
- **Primary checkout** updates the primary party; the derived trigger then decides whether the visit closes.
- **Companion checkout** updates that party and mirrors the departure into `companion_details[i].checkedOutAt` for compatibility. Recursion is prevented with a session guard flag (`set_config`) checked at the top of `sync_visit_from_visitor`, so the compatibility write cannot re-enter the canonical path.

## 5. Schema delta (exact)

`visit_parties` — add `companion_index int not null default 0` (0 = primary), `status text not null default 'checked-in'`, `name_status text not null default 'named'` (`named` | `unresolved`); unique index on `(visit_id, companion_index)` **created only after the duplicate report is clean** (§7); partial unique index on `(visit_id) where is_primary`.

`visits` — add `client_request_id uuid` + partial unique index.

`visitors` — add `client_request_id uuid` + partial unique index.

`people` — no change.

Plus GRANTs for `authenticated`/`service_role` and site-scoped RLS on `visits` and `visit_parties` (reads scoped by `branch_id` via the existing site-access helper; writes via RPC only).

## 6. Reconciliation — history only, separate from forward check-in

`reconcile_visit_parties(p_branch_id, p_dry_run)`, security definer and idempotent: creates missing visits and parties from legacy rows, backfills `companion_index` on the 4 existing party rows, creates placeholder parties for blank names and for the 5 headcount-only rows with `name_status = 'unresolved'`. It never creates `people` for historical companions, never edits or deletes legacy rows, returns created/skipped/flagged counts, writes one tagged `audit_log` entry per run, and reports zero changes on a second run.

Unresolved parties are shown as "Companion 2 — with Jane Smith" plus a plain "Details missing" text marker, count fully in occupancy and roll call, and appear in an admin "Incomplete attendance records" list so they stay visible and auditable. An "Add this person's details" action (permission `person.edit`) sets `display_name`/`person_id` and flips `name_status`; `visit_id`, `companion_index`, `check_in_time` and `check_out_time` are immutable through it, so the original attendance event is never rewritten. Each completion is audited.

## 7. Migration safety for duplicates

Before any unique index is added, the migration runs a detection pass and **fails fast** if duplicates exist on `(visit_id, companion_index)` or multiple primaries per visit. Nothing is deleted or merged automatically. The rows are listed in the integrity report and in the admin review screen, where a permitted admin either reassigns an index or marks a row as a duplicate for removal, each action audited. The unique index is created in a follow-up migration once the report is clean.

## 8. Data-quality report (read-only)

`visit_integrity_report()` returning counts and sample ids for: legacy visitors with no visit; visits with no legacy link and no parties; visits with no primary party; headcount mismatch (`1 + additional_visitors` vs party count); duplicate `(visit_id, companion_index)` rows; multiple primaries; parties open under a closed visit and vice versa; parties with a `person_id` whose branch differs from the visit branch. Admin-only, safe to run any time, run before and after reconciliation.

## 9. Reader cutover and compatibility

One increment per group, behind a single internal read switch:
1. Emergency Roll Call — `src/hooks/useEvacuation.ts`, `src/lib/evacuation.ts`.
2. Visit List and checkout — `src/hooks/useVisitors.ts`, `src/components/VisitorTable.tsx`, `src/pages/VisitList.tsx`, `src/components/CheckOutSheet.tsx`, `src/lib/companionCheckout.ts`.
3. Directory and history — `src/pages/Visitors.tsx` (dedupe by person id, never by blank contact), `src/hooks/useVisitorHistory.ts`, `src/components/VisitorProfile.tsx`.
4. Badges and exports — `src/lib/badgeIssue.ts`, `src/lib/exportVisitors.ts`.

Check-in path files: `src/components/checkin/useCheckInFlow.ts`, `StepDetails.tsx`, `StepConfirm.tsx` (companion person lookup, request key), `src/hooks/useFormFields.ts` (unchanged config, new validation use).

Legacy `visitors` rows keep being written and kept in step for the primary throughout, so reverting the frontend to the previous commit yields a working app on unchanged data.

## 10. Configured companion fields

`form_fields` companion scope still drives visibility, order, labels and required flags per person type. Required fields must be complete for every companion before sign-in enables, with inline text errors. If the name field is inactive for a type, companions are recorded as ordinal placeholders and still counted. No settings keys change.

## 11. UX constraints

Individual accountability by default; optional session-only "Group arrivals" collapse with a count and expander; plain text "Primary" / "With <name>" labels; existing destination and resident privacy rules apply identically to companion rows; labelled Lucide icons only, no emoji or symbol UI.

## 12. Out of scope for 8A

Kiosk device binding, weekly reports, contractor verification and screening-question outcomes. Only compatibility touches to `kiosk_check_in` (request key and companion payload passthrough) are included.

## 13. Test plan

Staff check-in with 0/1/3 companions; blank companion names; two companions with the same name in one party; companion linked to an existing person; companion created as a new person; companion `person_id` from another site (must be rejected with a clear message); forced network failure then retry (exactly one legacy row and one visit); duplicate submit by double-click; refresh and re-login mid-flow; kiosk check-in producing identical canonical rows; check out one companion, then the primary, then the whole group; parent visit stays open while any companion is on site; bulk group checkout; JSON mirror matches party state with no recursion; roll call with an open party mid-drill; historical reports before and after reconciliation; reconciliation twice with zero second-run changes; migration aborts cleanly when duplicate parties exist; integrity report clean after repair; two same-name people with no contacts stay separate; blank-contact people do not collapse in the directory; site B never sees site A parties; frontend rollback works on migrated data.

## 14. Rollback

All migrations additive; indexes droppable. Reconciliation only inserts, tagged per run and reversible by that tag. Readers flip behind one switch. Trigger changes are function replacements with the prior definitions retained for immediate restore.

## Remaining decisions needing approval

1. Trigger-as-authoritative-writer (legacy insert drives canonical rows) — confirm.
2. `client_request_id` added to both `visitors` and `visits`, globally unique where not null — confirm.
3. Cross-site or unknown companion `person_id` fails the whole check-in rather than downgrading to an unlinked party — confirm.
4. Occupancy, roll-call and report totals rise once companions count individually — confirm and confirm the wording used to explain it.
5. Historical companions get no `people` identity — confirm.
6. Placeholder labelling "Companion 2" for blank names and headcount-only rows — confirm.
7. Duplicate-party repair is admin-reviewed, never automatic, and blocks the unique index until clean — confirm.
8. Reader cutover order, with Roll Call first — confirm.
9. `person.edit` as the permission for completing an unresolved companion — confirm.

Note: roadmap.md gains a Phase 8A entry at build time; this turn is plan-only, so no file outside the plan is touched.

## Prototype limitation

Prototype work. Better companion accountability is a design goal, not certified regulatory compliance, and must not be presented as such without independent review.
