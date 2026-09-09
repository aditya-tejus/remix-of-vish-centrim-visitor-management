# Phase 8B-3 — Canonical visitor presentation and profile foundation

Goal: every accountable person on site appears once, sourced from the canonical attendance records, and each person's profile tells the whole operational story at a glance. No schema rewrites, no historical repair, no redesign.

## 1. Canonical read model

Add one shared reader (`src/hooks/useAccountablePeople.ts`, built on the existing `useAttendance`) that returns one row per accountable person:

- `partyId`, `visitId`, `personId`, `legacyVisitorId`, `branchId`
- `displayName`, `nameStatus` (named / unresolved), `isPrimary`, `companionIndex`
- `withPrimaryName` for companions, so the list can show "With Sarah Nolan"
- `personType`, `destinationLabel`, `checkInTime`, `checkOutTime`, derived `status`
- `legacyVisitor` reference for fields not yet canonical (screening outcome, contact, contractor data)

Rules:
- Canonical first: if a visit exists for the arrival, the party rows are authoritative.
- Safe fallback: legacy `visitors` rows are shown only when no canonical visit exists for them (matched via `visits.legacy_visitor_id`), never both.
- No collapsing by name, email, mobile or person code for current attendance. Blank-contact and unresolved-name people each keep their own row.
- Every query filters by the active site, using the existing legacy-site `or(branch_id.eq…, branch_id.is.null)` pattern.
- Read-only. Nothing in this stage writes, merges or deletes records.

## 2. Consumers to move onto the canonical reader

| Surface | Change |
| --- | --- |
| Visit List / Today / Presence | Rows come from the canonical reader; grouping only applies to the visual group/companion indent, never to row count |
| Visitor Profile history (`useVisitorHistory`) | Query `visit_parties` joined to `visits` by `person_id` (fall back to `legacy_visitor_id`, then today's name+mobile match), site-scoped |
| Badge issue (`badgeIssue.ts`, `printBadge.ts`) | Badge per party row; companion badges print "With <primary>" instead of the legacy companion JSON fallback |
| CSV exports (`exportVisitors.ts`) | One line per accountable person, with columns: Party role (Primary/With <primary>), Person type, Site, Check-in, Check-out, Destination, Screening outcome. Legacy fallback rows are marked "Legacy record" |

Old legacy paths stay in the code behind the fallback branch so nothing disappears if canonical data is absent.

## 3. Directory UX

- Current attendance: never collapsed. Companions render as an indented row directly beneath their primary, with a small "With <name>" label and their own status and sign-out control.
- Repeat history: grouped visually only in the profile and history views (grouped by day, then by visit), not in the live list.
- An unresolved companion shows "Name not recorded" with an inline "Add name" action for permitted staff (writes through the existing party RPC path only).

## 4. Visitor profile information architecture

Progressive disclosure on `VisitorProfilePage`, with the quick panel (`VisitorProfile.tsx`) unchanged in purpose:

1. Identity header — name, person type, on-site state and duration, site.
2. Now — current visit: destination/resident, who they are with, expected checkout, keys held.
3. Safety and screening — screening outcome, flags with severity, watchlist alerts, food register entries.
4. Contact and details — only fields currently enabled by configuration; previously captured values for now-disabled fields appear in a collapsed "Historic details (no longer collected)" block, permission-gated.
5. History — visit timeline.
6. Record activity — audit events.

Lucide icons only, each with a visible label or `aria-label`. No emoji or decorative symbols.

## 5. Contractor profile foundation

For contractor person types, the profile adds a Company panel: supplier name (referenced from existing supplier records, never duplicated), role/trade, contact, current status, screening outcome, and a read-only credential/document status list from `contractor_credentials` (valid / expiring / expired / missing). A "Verification" link is a placeholder pointing to the future queue — the review workflow itself is not built here.

## 6. Operational flags and warnings

One shared flag builder returning `{ severity: info | warning | critical, label, detail, action }`:

- critical: hard watchlist alert, blocked screening outcome, expired mandatory credential
- warning: flagged screening, overdue key, overdue checkout, soft watchlist
- info: food register entry, destination note, companion count

Rendered in one consistent strip at the top of the profile and as compact indicators in the list, using the Increment 1 status presentation primitives so severity is readable without colour alone.

## 7. Audit and history display

Visit timeline (arrival, companion changes, screening outcome, keys, checkout) plus record/configuration events from `audit_log` filtered to this person and site. Visible only to users holding the existing audit/settings permissions; hidden entirely otherwise, no partial leakage.

## 8. Data, API, RLS, performance

- No schema change is expected. If a query needs a join the current RLS cannot serve, add a read-only security-definer RPC that re-checks permission and site access, rather than loosening a policy.
- History paginates at 50 rows with "Load more"; live list keeps its existing 1000-row ceiling with a warning when exceeded.
- Rollback: each consumer reads through the shared hook, so reverting the hook's canonical branch restores legacy behaviour with no data impact.

## 9. Acceptance and verification

- Two blank-contact arrivals on the same day appear as two rows, not one.
- Primary plus two companions: three rows, companions labelled with the primary's name.
- Companion-only checkout closes just that row; the primary stays open.
- Switching site changes the list, profile history, badges and exports; no cross-site record ever appears.
- Profile history for a person with canonical visits shows those visits; a person with only legacy records still shows them, marked as legacy.
- Badge and export row counts equal the accountable-person count.
- Suppliers, residents and staff on profiles resolve to existing master records, with no new duplicates created.
- Typecheck, build, focused tests for the reader and flag builder, and a live browser pass over list, profile, badge and export.

## 10. Out of scope

Weekly emailed report, kiosk device binding, contractor document verification queue implementation, seed data, broad visual redesign, applying historical reconciliation, and any new navigation hierarchy.

## Defaults chosen (no further clarification needed)

- Canonical wins whenever a canonical visit exists; legacy is fallback only.
- Companions are indented child rows, not separate top-level entries.
- Legacy values for disabled fields are shown, collapsed and permission-gated, never deleted.
- Contractor document status is read-only in this stage.
- History pagination: 50 per page.
- Audit panel requires existing settings/audit permission.

## Prototype limitations to keep stating

Historical records without canonical visits remain legacy-sourced until a reviewed reconciliation is applied. Badge printing stays browser-print. Credential status display is prototype evidence, not compliance certification.
