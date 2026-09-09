# Phase 8A Closure and Hardening

Baseline commit: 30fb9eb2cd2b8e9f29b5a48a884b4836d7970c6f. Scope is closure only — no weekly reports, kiosk device binding, contractor verification, screening outcome rules, navigation restructure or seeded data.

## 1. Current state (measured now, read-only)

| Check | Count |
| --- | --- |
| Visitor arrival records total | 135 |
| Arrivals with companions counted (`additional_visitors > 0`) | 13 |
| Canonical visits | 4 |
| Canonical attendance rows (people on a visit) | 6 |
| Arrivals with no canonical visit | 131 |
| Attendance rows still unnamed | 0 |
| Visits listing the same position twice (duplicates) | 0 |

Also confirmed by inspection:
- `visits`, `visit_parties` and `people` each carry a broad "writable within site" rule for any signed-in staff member, so direct writes can bypass the approved sign-in/sign-out routines.
- Visit history on a person's profile has no site filter.
- Badges, exports and profile history still read the older arrival record, not attendance.
- The integrity card reports issues and blocks repair while duplicates exist, but offers no way to review or resolve a duplicate.

Reconciliation has not been run. 131 older arrivals will be filled in when it is.

## 2. Reconciliation of older records (admin-reviewed, never destructive)

- Keep the existing rehearsal-then-apply flow. Add to the card, before Apply: the exact numbers the run will create, the site it covers, and a short line that nothing is deleted, merged or renamed.
- Extend the card with a per-issue expander listing the sample arrivals behind each count (name, arrival time, counted companions) so an administrator can sanity-check before applying.
- Headcount-only companions stay as ordinal placeholders ("Companion 2") with an unnamed marker; they are counted for evacuation and clearly shown as never named. No invented names.
- Apply runs per site, is repeatable, and creates only what is missing.
- Blocker: applying the repair changes 131 historical records. Requires explicit approval before the build runs it, and it should be run by the user from the card, not by the build.

## 3. Duplicate review, then the uniqueness rule

- Add a "Review duplicates" panel: for every visit with two rows at the same position, list both rows with name, arrival, sign-out and source, and offer only safe actions — renumber the later row to the next free position, or mark it for manual attention. No delete, no merge.
- Every renumber writes an audit entry (who, which visit, old and new position).
- Only once the duplicate count is zero: add the unique rule on (visit, position). Currently zero duplicates exist, so this can proceed after reconciliation is applied and re-checked, not before.

## 4. Readers on attendance

Move to attendance as the source: Visit List (done), presence log, roll call (done), profile history, badges, exports.

- Profile history: read the person's attendance rows joined to their visits, so companions get their own history, with the older arrival record as fallback for pre-reconciliation entries.
- Badges: issue per attendance row so each companion can be badged individually.
- Exports: one row per person present, with a column marking main visitor or companion and who they arrived with.
- Deferred, with a bounded follow-up: nothing planned to defer. If badge printing proves to depend on legacy-only fields during the build, it stays on the legacy record and is listed explicitly in the closing report with the exact field that blocked it.

## 5. Site scoping on history

- Add current-site filtering to the visit history hook and any other profile/historical query that lacks it, matching the existing pattern (site match, plus null-site records only on the legacy placeholder site).
- Audit every remaining query that reads arrivals without a site filter and fix them in the same pass.

## 6. Tightening write access

- Replace the broad "writable within site" rules on `visits` and `visit_parties` with: read within site (unchanged), insert/update only via the approved sign-in and sign-out routines, which already enforce role and site checks.
- Keep `people` writable within site for now — the check-in flow creates people directly; note this in the report.
- Rollback: the previous rules are re-creatable in one step and will be recorded in the change description.
- Risk: any screen writing attendance directly will start failing. Before applying, the build greps every direct write to those tables and routes it through the routines; verification includes a full check-in, companion sign-out and reconciliation run.

## 7. Audit coverage for settings and companion fields

- Verify each create, edit, reorder, activate/deactivate and delete on companion field configuration writes an audit entry with the person, the person type and what changed. Add any missing entries.

## 8. Companion settings screen review

- Confirm it appears in exactly one place (it is currently rendered from two settings areas — remove the duplicate rendering, keeping the person-type location).
- Confirm no emoji or symbol controls; Lucide icons with visible labels only.
- Confirm first-open default seeding runs once per person type and never overwrites existing configuration.
- Confirm AU/UK wording comes from the configuration pack.

## 9. Technical summary

- Schema: one unique index on `visit_parties (visit_id, companion_index)`, added only after duplicates are zero. No other schema change.
- Routines: extend the integrity report with duplicate detail rows; add a narrow, audited renumber routine; no change to sign-in/sign-out behaviour.
- Access rules: narrow write rules on `visits` and `visit_parties`; grants adjusted to match.
- Frontend: integrity card (detail expanders, duplicate review), visit history hook (site filter), presence, profile history, badges and export builders on attendance; remove duplicate companion settings rendering.

## 10. Tests

- Reconciliation rehearsal twice in a row returns the same numbers; apply then rehearse again returns zero to create.
- Primary plus companion produces two accountable people; companion sign-out leaves the primary on site; the visit closes only when the last person leaves.
- Retrying a check-in does not duplicate.
- A profile opened on site A shows no site B visits.
- A direct write attempt to attendance from the app is rejected after the rules are narrowed, while normal check-in and sign-out still work.
- Exports and badges list companions individually.
- Type check, build, and the security linter compared against the current 51-warning baseline.

## 11. Rollback

Each step is independently reversible: drop the unique index; restore the previous write rules; revert reader changes to the legacy record. Reconciliation only adds missing rows, so it is left in place rather than reversed; the review panel makes each added row inspectable.

## 12. Operational warnings

- This is a prototype. Nothing here is evidence of production compliance or of an accredited audit trail.
- Exports remain plain files generated in the browser and are not tamper-evident.
- Until reconciliation is applied per site, older arrivals show companions only as a count, and evacuation lists for those historical records are incomplete.
- The security linter's existing 51 warnings are pre-existing and out of scope here.

## Blockers needing approval

1. Applying reconciliation to 131 historical arrivals across sites.
2. Narrowing write access on attendance tables, which will break any direct-write path not yet routed through the approved routines.
3. Removing the duplicate rendering of the companion settings screen from the second settings area.
