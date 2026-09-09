# Phase 8B — Configuration-aware check-in and canonical visitor presentation

Baseline: Phase 8A closure accepted at commit f72601e8aac5c77d120fb7aa40f95338e93fafcf. No historical reconciliation will be applied automatically in this stage.

## 1. Evidence from the current code and data

**Staff check-in ignores the configured field list.**
`src/components/checkin/StepDetails.tsx` hard-codes First name, Surname, Email, Phone and Address inputs (lines ~163-190). The configured list is only consulted for extra fields further down. Live configuration for this account:

| Person type | Active configured fields |
|---|---|
| visitor | mobile (optional), companion_name (optional) |
| contractor | mobile (required) |
| volunteer | mobile (optional), organisation (optional) |
| resident | accompanied_by, leave_mode, destination (required), expected_return, comments |

So email and address are not configured for any type, yet both are always shown and stored. Nothing enforces "required" on configured main-visitor fields either — only companions are validated (`missingCompanionFields` in `useCheckInFlow.ts`).

**Screening/vaccination/privacy are partly hard-coded.** `useCheckInFlow.ts` falls back to three built-in health questions (fever, cough, consent) whenever no questions are configured, so a site that deliberately disabled screening still sees a screening step. Privacy acknowledgement is a flow-level boolean with no per-type switch on the staff side (the kiosk flow does honour `privacyApplies`).

**Screening questions have no outcome rules.** `health_questions` holds question, type, required, options, sort order and active only. Blocking today is inferred client-side (`allHealthClear = every answer === false`); there is no expected answer, severity, staff message or block/flag choice.

**Companion identity.** Phase 8A added companion payloads with optional `person_id`/create-person and site validation through `check_in_party`; the check-in UI has lookup/link/unlink. Remaining gap: relationship to the primary visitor is captured only loosely and existing-person search is not offered consistently for every person type.

**Duplicate collapsing.** `src/pages/Visitors.tsx` collapses rows by personal code, email or mobile (lines 59-73). It no longer collapses on blank contacts, but it still hides genuinely separate arrival records behind one row in the directory list.

**Legacy readers still in place.** `VisitorProfile.tsx` builds visit history by matching name/email/mobile across `allVisitors` rather than reading canonical `visit_parties`. `useVisitorHistory` is now site-scoped but still reads `visitors`. Badges (`badgeIssue.ts`) and exports (`exportVisitors.ts`) derive companions from legacy `companion_details` JSON. Roll call, Visit List and Presence already prefer canonical attendance with legacy fallback.

**Profile depth.** `VisitorProfile.tsx` (241 lines) shows identity, contact, duration, keys and watchlist. It does not surface screening outcomes, contractor company/role, document verification state, or an audit/history trail.

**Audit.** `useFormFields` now logs create/update/delete. Health question, vaccination field, screening-rule and person-type mutations are not consistently logged with before/after.

## 2. Risks

- Removing hard-coded email/mobile/address without a migration would make existing records look incomplete and could break exports or notification opt-ins that read email. Mitigation: fields become configuration-driven, and existing stored values always remain visible read-only on the profile.
- Sites with zero configured fields would end up with a check-in form that asks for nothing. Mitigation: first name and surname stay mandatory always; a one-off, non-destructive default seed per person type is offered as an explicit admin action, never automatic.
- Turning off the built-in health-question fallback changes screening behaviour for any site relying on it. Mitigation: fallback is preserved but only used when a per-site setting says screening is expected and no questions exist; otherwise the step is skipped.
- Screening outcome rules must not retroactively block anyone. Mitigation: new columns are nullable with flag-only defaults; absent rules behave exactly as today.
- Replacing directory dedupe will increase row counts and may look like duplicates to staff. Mitigation: group visually by person with a visit count, rather than dropping rows.

## 3. Implementation slices (smallest safe order)

**8B-1 Configuration-aware main visitor form**
Build a shared field resolver (`src/lib/checkInFields.ts`) that merges configured `form_fields` for the person type with the always-required name fields, and returns visibility, requiredness, editability, label, help text and input type. `StepDetails` renders from the resolver only; email, mobile and address appear solely when configured. Validation blocks Continue with named missing fields. Values for non-configured fields are neither collected nor written. Kiosk flow reuses the same resolver so both entry points agree.

**8B-2 Screening, vaccination and privacy honour configuration**
Add per-person-type settings keys (existing `{setting}_{person_type}` convention) for whether screening, vaccination capture and privacy acknowledgement apply. Skip the step entirely when nothing applies. Remove the silent hard-coded fallback questions in favour of the explicit setting.

**8B-3 Screening outcome rules**
Additive nullable columns on `health_questions`: `expected_answer`, `warning_answers jsonb`, `severity` (`info`/`warning`/`critical`), `staff_message`, `action` (`flag`/`block`). Backward compatible: null means today's behaviour. Settings UI gains these controls per question. Check-in evaluates rules, shows the staff-facing message inline, flags or blocks accordingly, and stores the evaluated outcome alongside the answers.

**8B-4 Companion identity and relationship**
Every person type gets the same companion experience: search existing people at the current site, link one, or create a new companion once the configured required fields are present. Store `relationship` on the party and show "With <primary>" consistently. Warn (never silently merge) when the entered contact matches an existing person.

**8B-5 Canonical presentation cutover**
Replace name/email matching in `VisitorProfile` and `useVisitorHistory` with canonical `visit_parties` joined to `visits`, site-scoped, with a documented legacy fallback for arrivals that have no canonical visit. Badges and exports take the party as their source, so each accountable person prints and exports individually with the primary relationship retained. Directory grouping replaces row-collapsing.

**8B-6 Richer visitor and contractor profile**
Reorganise the profile page into progressive sections: identity and contact, current visit and destination, flags and warnings, screening outcomes, contractor company/role and document verification state, visit history, audit trail. Resident and supplier master data are referenced, never copied.

**8B-7 Audit completeness**
A single settings-mutation helper records actor, site, timestamp, entity, change summary with before/after, and reason where supplied — applied to form fields, health questions, vaccination fields, screening rules and person-type configuration.

## 4. Technical notes

- Migrations: additive nullable columns only (`health_questions` outcome rules; `visit_parties.relationship` if not already present). No drops, no data rewrites, no unique index work in this stage.
- RLS/permissions: unchanged model. Attendance writes stay inside the approved routines; configuration writes stay behind `settings.administer`.
- Navigation: unchanged. No new top-level entries; the profile gains sections, not pages.
- Icons: Lucide only, with accessible labels on every icon-only control. No emojis or symbol characters.

## 5. Acceptance criteria

- With email and address disabled, staff check-in never asks for, validates, stores or marks them required; existing stored values still display read-only on the profile.
- A configured required field blocks Continue with a clear named message.
- Disabling screening for a person type removes the screening step entirely.
- A screening question configured as "warning, flag only" completes check-in with a visible staff warning; configured as "block" it prevents check-in.
- Companions can be linked to an existing person or created, with the relationship to the primary visible everywhere.
- Visit List, Presence, roll call, badges and exports each show one line per accountable person, site-scoped, with the primary relationship retained.
- No list collapses records with blank contact details.
- Every configuration change appears in the audit log with actor, site, timestamp and change summary.

## 6. Regression and live verification checklist

- Ordinary visitor check-in and checkout still complete in the same number of steps.
- Retry of an interrupted check-in still produces one arrival.
- Companion-only checkout leaves the primary on site.
- Roll call totals match Visit List for the same site.
- Cross-site data stays invisible; profile history is limited to the current site.
- Existing saved screening questions with no rules behave exactly as before.
- AU and UK wording still follows the site's configuration pack.
- Typecheck, build and linter run clean against the documented baseline; no test records left behind.

## 7. Out of scope for Phase 8B

Weekly emailed visitor activity report; kiosk device provisioning and binding; contractor document verification queue implementation; seed-data population; broad UI redesign. Each will be planned as its own stage.

## 8. Prototype limitations to keep stating

Badge printing remains browser-print only. Historical arrivals at the "Unassigned (legacy)" site still require an administrator to rehearse and then apply the repair. Duplicate-position protection stays held back until every site reports zero duplicates. None of this is production compliance evidence.

## 9. Open questions

1. When a site has no configured fields for a person type, should the plan offer a one-off admin action to seed sensible defaults, or leave the form at name-only?
2. Should a "block" screening outcome allow a permissioned supervisor override with a recorded reason, or be an absolute stop?
