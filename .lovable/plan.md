# Phase 8B-3b — Visitor and contractor profile foundation

Read-only composition stage. One person's record becomes a clear, layered page for reception:
who they are, what is happening now, what needs attention, then the detail underneath.

## Scope

### 1. Visitor profile — progressive disclosure

Rebuild the existing profile page (`src/pages/VisitorProfilePage.tsx`, currently ~830 lines with
mixed concerns) as an ordered set of sections. Same route, same navigation, same actions.

Order top to bottom:

1. **Identity header** — name, person type, site, on-site state and time on site, primary or
   "With <primary name>" relationship, check-out action (canonical party check-out where a
   canonical row exists).
2. **Needs attention strip** — only rendered when something is true: watchlist flag, screening
   warning or block, keys or fobs still out, contractor credential gaps. Each item is an icon
   plus a text label plus a plain sentence — never colour alone.
3. **Current visit** — arrival time, destination/resident, purpose, who they arrived with and
   each companion's own state.
4. **Details** — contact and person fields, limited to fields currently active in configuration.
5. **Visit history** — canonical attendance first, legacy fallback marked "older record", paged.
6. **Activity and audit** — permission-gated, site-scoped, collapsed by default.

Sections 4-6 collapse; 1-3 are always open.

### 2. Contractor profile foundation

For contractor-type people, the identity and current-visit sections additionally show: supplier
or company reference, role/trade and work location where recorded on the visit, current status,
screening result, and a **read-only** credential status list. Credential status is composed from
the existing tables only (`credential_types`, `contractor_credentials`, `supplier_credentials`)
via the existing helpers in `src/lib/contractorCredentials.ts` and the existing compliance panel.
Missing or expired items are stated in words ("Insurance — expired 12 Aug"). No upload, no
verification action, no review queue, no new contractor or supplier records created from a profile.

### 3. Privacy-safe display

- A field that is inactive in configuration is not shown as a current field.
- Where a historic value exists for a now-inactive field, it appears only inside a collapsed
  "Historic information no longer collected" block, gated on the same permission as audit
  (`settings.administer` or `data.export` — see Defaults).
- Screening detail continues to respect `screening.view`; assistance detail respects
  `assistance.view`; credentials respect `contractor.credentials.view`.

### 4. Flags and icons

Each flag = Lucide icon + visible text label + accessible name. No emoji, no decorative Unicode,
no colour-only meaning. Reuse `StatusBadge` and `src/lib/statusPresentation.ts` from Increment 1.

## Data approach

Read-only composition. **No schema change, no migration, no new RPC, no RLS change** is planned.

- Attendance: existing `useAccountablePeople` / `buildAccountableRows`.
- History: existing `useVisitorHistory` (already canonical-first, site-scoped), plus client-side
  paging at 20 entries with "Show more".
- Screening: existing visitor `screeningOutcome` / `screeningFlags` fields; question labels via
  `useQuestionLabels`. Flags render as question label + severity, never raw answers.
- Keys: `useOpenKeyIssues`.
- Food register: `useFoodRegister`.
- Watchlist: `useWatchlist`.
- Credentials: `contractorCredentials` helpers + `useContractorPeople`.
- Caching: existing hooks and React Query defaults. No new cache layer.

### Sources to verify before implementation

These must be confirmed by a read at build time; the plan does not assert their current state:

1. **`useOpenKeyIssues`** — it selects open key issues with no visible site filter in the fetch.
   Confirm whether `key_issues` rows reaching the profile are already site-scoped by RLS. If not,
   filter by `branch_id` in the profile consumer before display.
2. **`useFoodRegister`** — confirm site scoping and that a per-person read exists; if it only
   supports the register page, show food context only when it maps cleanly, otherwise omit.
3. **`audit_log`** — confirm it can be filtered to one person and one site with existing columns
   and policies. If it cannot be scoped safely, the audit section ships as activity derived from
   attendance and screening events only, and the audit_log view is deferred.
4. **`form_fields`** — confirm the active/inactive flags used by `checkInFields` are the correct
   authority for "currently collected", per person type.
5. **Resident-visitor lookup** on the profile currently queries `visitors` with a name `ilike`
   fallback; confirm the canonical `visited_resident_ids` path covers current records before
   relying on it.

## Recommended defaults

- Historic/legacy value block gated on `settings.administer`.
- Audit/activity section gated on `data.export`, site-scoped, newest 25 entries.
- History page size 20.
- Legacy rows labelled "older record" and read-only, matching the visit list wording.
- Contractor credential states reuse existing valid / expiring / expired / missing / pending
  vocabulary — no new states.
- Companion rows on a profile link to their own accountable row context, not to a new master record.

## Acceptance criteria

- A visitor profile shows identity, current state, attention items, details, history and audit in
  that order; nothing below section 3 is expanded by default.
- A companion's profile shows "With <primary name>" and their own arrival/departure times, and
  checking the companion out does not close the primary.
- A contractor profile shows supplier/company, trade, destination, status, screening result and
  credential status read-only; a missing credential is stated in words with an icon and label.
- A person with no email and no mobile renders without blank rows and is never merged with another
  blank-contact person.
- A legacy-only record renders with the "older record" marker and no canonical-only actions.
- Switching site never shows another site's visits, keys, food entries or audit lines.
- A blocked screening outcome is visible in the attention strip with an explicit "Blocked" label.
- A field inactive in configuration does not appear in Details; a historic value for it appears
  only inside the gated collapsed block.
- No profile action creates a `people`, `visitors`, `contractor_people` or `suppliers_min` record.

## Tests

Unit tests over pure composition helpers (new `src/lib/profileSections.ts`):

- visitor, companion, contractor, blank-contact and legacy-only profile shapes
- site isolation of history, keys, food and audit inputs
- screening warning vs block presentation
- inactive-field suppression and historic-value gating
- contractor with missing/expired/absent credentials
- no duplicate-master-record side effects (composition functions are pure reads)

Plus typecheck, build, full Vitest run, and one authenticated live check of a real visitor,
companion and contractor profile.

## Out of scope

Weekly emailed report; kiosk device binding; seed data; contractor document verification workflow;
historical reconciliation apply; navigation restructure; broad UI redesign.
