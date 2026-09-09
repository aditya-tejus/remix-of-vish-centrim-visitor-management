# Phase 8B-2 — Configurable screening outcomes and settings enforcement

Goal: the check-in questions, vaccination capture and privacy acknowledgement each appear only where the site has switched them on, and each screening answer produces a clear, configured outcome that reception can act on without guesswork. Every configuration change is recorded by the database itself.

## What we found in the current build

- The kiosk already honours per-person-type switches (`screeningApplies`, `privacyApplies` from `usePersonTypes`). Reception check-in does not: `useCheckInFlow` always adds the screening step and always requires the privacy tick, and it falls back to three hard-coded questions (fever, cough, consent) when a site has configured none. So the two entry points can disagree today.
- Vaccination capture has no on/off switch at all; it is shown whenever vaccination fields exist.
- Screening outcomes are hard-coded: any "yes" answer plus a temperature threshold sets a generic flag, and blocking only happens in outbreak mode (kiosk) or via an unstructured staff override reason (desk). There is no per-question expected answer, severity or message.
- Configuration writes for check-in fields are audit-logged from the browser (`useFormFields.logFieldChange` inserts into `audit_log` directly). Health questions, vaccination fields, person-type switches and privacy settings have no audit entry at all. Client-side logging can be bypassed.
- Existing patterns to reuse: `has_permission` / security-definer RPCs, `settings_scoped` for per-site values, `useSettingsAccess` for the settings gate, `audit_log` with `change_reason`.

## Part 1 — One rule for screening, vaccination and privacy

Add three per-person-type switches resolved through the existing scoped settings (`{key}_{person_type}`, site value falling back to account value):

- `screening_enabled_{type}` (default: current `screeningApplies` value)
- `vaccination_enabled_{type}` (default: on where vaccination fields exist, otherwise off)
- `privacy_required_{type}` (default: current `privacyApplies` value)

A shared resolver `src/lib/screeningPolicy.ts` returns the three answers for a site and person type. Reception (`useCheckInFlow`) and kiosk (`useKioskCheckInFlow`) both consume it, so they cannot diverge. When a feature is off: its step is removed from the pipeline, its validation is skipped, and its values are not written to the arrival record.

The hard-coded fever/cough/consent fallback in `useCheckInFlow` is removed. If a site has screening on but no questions configured, the step is skipped rather than inventing questions.

Backward compatibility: values already stored on old arrivals stay on the record and stay visible on the profile. Nothing historical is rewritten or re-evaluated.

## Part 2 — Configurable screening outcome rules

Simplest safe model: extend `health_questions` rather than add a rules table, because a rule always belongs to exactly one question.

New nullable columns on `public.health_questions`:

- `expected_answer text` — the answer that means "no concern"
- `warning_answers jsonb` — one or more answers that raise a concern (default `[]`)
- `severity text` — `info` | `warning` | `critical` (default `info`)
- `staff_message text` — what reception is told when a warning answer is given
- `outcome_action text` — `none` | `flag` | `block` (default `none`)

A question with no rules keeps today's behaviour exactly (yes/no questions still raise the existing generic symptom flag). Numeric temperature keeps its existing threshold behaviour, expressed as a rule on the temperature question where one exists.

Settings UI: `HealthQuestionsManager` gains a collapsed "What happens if the answer is a concern" section per question (progressive disclosure) — expected answer, warning answers, severity, staff message, action. Lucide icons with visible labels, no emojis.

## Part 3 — Evaluating and recording the outcome

A pure function `evaluateScreening(questions, answers)` returns per-question results and an overall outcome: `clear`, `flagged` or `blocked` (highest severity wins). Both entry points use it.

Persistence, keeping sensitive detail to a minimum: store the overall outcome and the list of concerning question keys with their severity on the arrival record (new nullable `screening_outcome text` and `screening_flags jsonb` on `visitors`). Free-text health detail is not duplicated; the existing `health_answers` remains the single copy.

Reception sees a single concise banner: severity colour plus an icon plus text (never colour alone), the configured staff message, and an unambiguous statement of what happens next — "This person can be signed in" / "Sign-in is blocked until a supervisor approves it".

## Part 4 — Blocked outcomes and supervisor override

Recommendation: a permissioned override, not an absolute block. Evidence: the desk already relies on a staff override with a typed reason for flagged screening, real sites need a documented exception path (a resident's family member arriving for end-of-life care), and an absolute block pushes staff into working around the system unrecorded.

Design: a blocked outcome stops Continue for everyone. A user with `screening.view` plus `settings.administer` (recommended default; no new permission introduced) sees an "Approve with reason" control requiring a typed reason of at least 10 characters. Approval calls a security-definer RPC `override_screening_block(p_reason, p_context)` which re-checks the permission server-side and writes an `audit_log` entry (`screening.block_overridden`) with actor, site, timestamp and the reason. The kiosk never offers the override — an unattended kiosk sends the person to reception.

## Part 5 — Audit logging that cannot be bypassed

Move configuration audit into the database with `AFTER INSERT/UPDATE/DELETE` triggers on `health_questions`, `vaccination_fields`, `form_fields`, and the scoped settings rows for screening/privacy/person-type switches. Each trigger writes to `audit_log`: action, actor (`auth.uid()` and email), site where the row carries one, timestamp, and a before/after summary of only the changed columns. An optional reason supplied by the UI is passed through a `SET LOCAL` app setting and stored in `change_reason` when present.

The existing client-side `logFieldChange` call is removed once the trigger covers it, so a change can never be recorded twice or skipped.

## Technical detail

- Migrations (all additive, no data rewrite): new nullable columns on `health_questions` and `visitors`; audit trigger function `public.log_config_change()` plus triggers; grants unchanged because no new table is created.
- RPCs (security definer, `search_path = public`, permission-checked): `override_screening_block`.
- RLS: unchanged. Reads of `health_questions` stay as today; writes stay administrator-gated.
- Files expected to change: `src/lib/screeningPolicy.ts` (new), `src/lib/screeningOutcome.ts` (new), `src/components/checkin/useCheckInFlow.ts`, `src/components/checkin/StepScreening.tsx`, `src/components/checkin/CheckInSheet.tsx`, `src/hooks/useKioskCheckInFlow.ts`, `src/pages/kiosk/KioskCheckIn.tsx`, `src/hooks/useHealthQuestions.ts`, `src/components/settings/HealthQuestionsManager.tsx`, `src/components/settings/VaccinationFieldsManager.tsx`, `src/components/settings/PersonTypeSettings.tsx`, `src/hooks/useFormFields.ts`, tests.

## Acceptance criteria

1. Screening off for a person type: no screening step, no validation, no screening values written — at the desk and at the kiosk.
2. Vaccination off: no vaccination capture anywhere, even where vaccination fields exist.
3. Privacy off: no acknowledgement tick and no acknowledgement written.
4. A question with no rules behaves exactly as it does today.
5. A `warning` rule shows the configured message and allows sign-in; the arrival records `flagged`.
6. A `block` rule stops Continue; only a permitted user can approve, only with a reason; the audit trail shows actor, site, time and reason.
7. Editing a question, vaccination field, check-in field, or any of the three switches produces exactly one audit entry with before/after, written by the database.
8. Historical visits are unchanged and old saved answers still display.

## Tests

- Unit: policy resolver (each switch on/off, site override beating account value), outcome evaluator (no rules, warning, critical, block, multiple concerns, missing answer).
- Regression: existing 8B-1 field tests keep passing; kiosk pipeline order unchanged where everything is on.
- Live checks on the running app: visitor with screening off, contractor with a blocking rule, override by a permitted user, denied override by an unpermitted user, and the audit entries produced. Any records created during testing are removed afterwards.

## Risks, rollout and rollback

- Risk: a site with screening on but no questions now skips the step. Mitigated by a note in the settings screen and by defaults derived from today's behaviour.
- Risk: triggers double-logging alongside the old client call. Mitigated by removing the client call in the same change.
- Rollback: the new columns are nullable and ignored by older code; dropping the triggers and the RPC restores prior behaviour without touching any stored answer.

## Out of scope

Canonical profile cutover, weekly emailed report, kiosk device binding, seed data, contractor document verification queue, broad visual redesign.

## Open decisions, with the default the build will use unless told otherwise

1. Override permission — default: `settings.administer` (no new permission).
2. Rules live on the question rather than a separate table — default: on the question.
3. Concerning answers stored as question keys plus severity, not the answer text — default: keys and severity only.
4. Kiosk offers no override — default: no override at the kiosk.
5. Temperature threshold stays a setting rather than becoming a rule — default: keep the existing setting.

## Prototype honesty

Screening rules, override records and audit entries are prototype-grade evidence of intent. They are not a certified clinical or regulatory control and must not be presented as demonstrating compliance with the Aged Care Act or UK care-home requirements.
