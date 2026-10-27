# Resident movement review — Phase 9E-C / 9F-3

27 October 2026. Bounded prototype implementation; not regulatory or production certification.

## Outcome and chosen safety boundary

Public resident self-service is restricted to reception assistance. This is the conservative fallback explicitly authorised in the brief: no new public name/code movement capability was introduced because the old contracts do not establish resident identity, consent or individual safeguards. Existing resident cards do not authorise departure. Staff workflows remain available. No current residents were edited, no departure/return was submitted to the live database, no emergency/PIN was touched, no external notification was sent and nothing was published.

No absence reported is not On site, a physical sighting, a return verification, or evidence of emergency safety. AU village absence reporting is optional. RAC/England supported leave retains reason/escort/return and confirmation steps. Phase 9C evidence/counting remains unchanged.

## Caller and dependency inventory

| Consumer | Before | Current boundary |
| --- | --- | --- |
| `KioskResidentLeave` | `useResidents(publicMode)` → whole `kioskd_resident_directory`; `useVisitors(residentMovement)` → whole `kioskd_presence_list`; UUID departure/return | Assistance screen; no resident lookup, directory or movement requests |
| `useResidents(publicMode)` | Prefetch up to 300 names/rooms/statuses | Empty list without any resident request, irrespective of configuration |
| `useVisitors(publicMode)` | Resident directory polling with opt-in | Write-only public arrival hook; no public presence reads |
| `useKioskCheckInFlow` / `KioskCheckIn` destination | Resident list filtered in browser | No resident directory; manually entered destination or reception assistance; staff destination choices preserved |
| `KioskQRScan` | Visitor purpose lookup then resident code → UUID departure | Visitor purpose lookup unchanged; no resident UUID mutation; unknown/resident codes offer assistance, ordinary verified returning visitor lookup remains |
| `LocalPrototypeResidentDirectory.searchResidentsPublic` | Old caller-selected-site RPC | Empty public projection, no RPC |
| `Residents` | Directory + 500-row visitor subset inferred On Site | Resident-specific read includes saved movement metadata; canonical Away / Expected back / No absence reported / Directory views |
| Today outing and Visit List resident return | Shared `useVisitors` unchecked optimistic movement | Dedicated staff movement RPC with saved-result checks and retry keys; ordinary visitor checkout unchanged |
| `/resident-leave` | Already redirected in App; obsolete page still had duplicate shell | Existing route continues to Residents; obsolete page now only redirects to `?view=away` |
| `ResidentPresenceTable`, `MarkReturnDialog` | Empty states claimed all physically on site | Honest unconfirmed-location wording; failed return retained; labelled return controls |

## Live schema/grants inspected and applied

Inspected deployed definitions, ACLs, visitor/resident/site/audit columns and visitor/resident RLS. Movement continues to use the existing resident `visitors` identity; no duplicate identity model or historical backfill. There were 22 residents before and after this package.

Runtime migrations applied and types regenerated:
- `drizzle/migrations/0006_resident_movement_staff_boundary.sql`
- `drizzle/migrations/0007_validate_resident_movement_inputs.sql`

Removed PUBLIC/anon/authenticated execute from exact extant signatures: `kioskd_resident_directory(text,text)`, `kioskd_presence_list(text)`, `kioskd_resident_leave(text,uuid,timestamptz,text,timestamptz,text,text)`, `kioskd_resident_return(text,uuid,timestamptz)`, `kioskd_check_out(text,uuid,timestamptz)`, `kiosk_resident_directory(text,uuid)`, `kiosk_resident_leave(uuid,timestamptz,text,timestamptz,text,text)`, `kiosk_resident_return(uuid,timestamptz)`, `kiosk_check_out(uuid,timestamptz)`. The older `kiosk_presence_list(uuid)` was already restricted. No other extant overloads found in live catalog. Service/internal ownership retained.

`kioskd_resident_code(text,text)` validates the device then returns the same `staff_required` result for all codes, with no resident query or identity disclosure. `staff_resident_movement` is authenticated-only, uses existing action permission and server site checks, resident type/site validation, request/advisory lock and resident row lock, expected-state refusal, timestamp checks, optional expected return/reason persistence and atomic audit. Audit records real UUID/site/server time, no physical-safety claim, and `message_sent:false`. Input allowlist/size/type validation is server-side. Matching retry key returns the original saved outcome; altered payloads are refused. Return clears departure time/expected return. Old reason/escort/comments remain retained historic fields, never presented as current presence evidence.

## Tests and browser evidence

- 285 tests pass across 28 files: 252 original + 33 resident tests.
- Pure rules: missing/legacy status never physical presence, multi-day absence, overdue/optional return, independent AU RV vs supported RAC/England, overnight site dates, local timestamp conversion, England DST ambiguity/nonexistent rejection, false/wrong-site/wrong-identity result refusal.
- Actual migration SQL runs in isolated PGlite PostgreSQL with stub existing device/permission/site guards: old grants denied, uniform code response, no-session/no-site/wrong-site refusal, atomic persistence/audit, exact retry, request mismatch, stale transition, optional absence, legacy unassigned-site restriction, invalid payloads, audit rollback.
- Components/hooks: no public directory/no-site request; assistance-only kiosk; permission guard; duplicate press; false outcome; unchanged retry key/payload; late site response refusal; empty independent optional fields; RAC validation; failed return retains notes.
- Mocked Playwright: 390×844, 768×1024 portrait and 1440×1800. Staff absence → forced error → unchanged retry → saved read-back → return → no absence reported. Kiosk assistance screen has zero directory/movement requests. No page errors or document overflow. Screenshots inspected. All service/auth requests intercepted; fake isolated session/device only; no live mutations.
- Harness typecheck/production build: latest log `build OK`; manual build/typecheck intentionally not run per environment rules.
- Non-fatal test warnings include React act/forwardRef warnings; no failed assertions. Mocked browser had no page errors.

## Explicit residual gaps

- Public resident self-service/QR movement unavailable pending verified identity and individual safeguard contracts. Visitor destination can be manually stated but is not matched to a resident ID; linked food-recipient selection may require reception. This is deliberate privacy restriction, not complete destination parity.
- Live authorised multi-site movement/race/audit read-back not exercised; no real movement was authorised. Device lifecycle/site-permission guards are stubbed in isolated SQL tests. Browser checks are mocks, not live operational UAT or assistive-technology certification.
- In-memory request IDs survive retries only while the page remains open. After reload, refresh/read-back must establish current state before another movement; no offline persistent replay queue added.
- Existing supported-leave configuration, approval setting enforcement and custom pre-departure-question parity are not comprehensively implemented by the old staff sheet. Preserved existing supported form; no new blanket independent-village approval rule.
- Existing resident/visitor RLS uses permissive role/site policies; granular clinical/support read permissions and older direct authenticated visitor writes require a wider review. This package does not claim to close those global policy gaps.
- No historical movement-event backfill; original resident row is still the compatibility status projection. New audit events preserve new movements only; old retained escort/reason/comments are not evidence of a current absence.
- Directory retains detail/contact/clinical fields and profile links within a horizontally scrollable table on narrow screens. Existing profile/export routes remain; no new export added. Broader resident profile correctness is separate.
- Country time-zone fallback is visible; site time zone must be configured accurately. Manual adjustment is same-day; multi-day retrospective correction remains outside this package.
- Independent privacy/security review, durable rate limiting, production role UAT and full England/RAC operational/accessibility UAT remain open.

## Exact affected source files

`AGENTS.md`, `roadmap.md`, `docs/RESIDENT_MOVEMENT_REVIEW.md`, `docs/SECURITY_REVIEW.md`;
`src/lib/residentMovement.ts`, `src/hooks/useResidentMovement.ts`, `src/hooks/useResidents.ts`, `src/hooks/useVisitors.ts`;
`src/pages/Residents.tsx`, `src/pages/ResidentLeave.tsx`, `src/pages/kiosk/KioskResidentLeave.tsx`, `src/pages/kiosk/KioskQRScan.tsx`, `src/pages/kiosk/KioskCheckIn.tsx`;
`src/components/ResidentOutingDialog.tsx`, `src/components/ResidentDirectoryTable.tsx`, `src/components/ResidentPresenceTable.tsx`, `src/components/MarkReturnDialog.tsx`, `src/components/CheckInReturnDialog.tsx`;
`src/services/adapters/local/index.ts`, `src/test/residentMovement.test.ts`, `src/test/residentMovementServer.test.ts`, `src/test/residentMovementFlow.test.tsx`.
Generated: `src/integrations/supabase/types.ts`, the two applied SQL files, migration snapshots `meta/0006_snapshot.json`, `meta/0007_snapshot.json`, and journal. No hand-edited generated types/history.

Preview: https://id-preview--671c5f63-eb05-4ae2-a2e8-8fa245afd5f1.lovable.app/residents

Git commits are managed automatically by the environment; final current HEAD is reported separately after the documentation update. Stop for review.