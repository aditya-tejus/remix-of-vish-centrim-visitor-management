# Phase 8E — Contractor documentation verification workflow

Today a contractor document is a single row on `contractor_credentials` (one per person and
credential type): one expiry date, one file path, one `verification_status`, overwritten each
time something new arrives. There is no queue, no reviewer decision record, no version
history, and company documents on `supplier_credentials` carry no file or verification at all
— `buildComplianceChecklist` treats every company credential as "verified" by assumption.

This phase turns that into an explicit review process: a document is evidence, a review is a
decision, and only a decision makes a document count.

## How it will work for staff

**Someone submits evidence.** From the contractor person page or the supplier page, a staff
member attaches a file, picks the document type, and records issue date, expiry date and who
supplied it. It lands as **Awaiting review**. Nothing about the contractor's status changes yet.

**A reviewer decides.** Authorised reviewers open **Contractors > Document reviews**: a single
list of everything awaiting a decision at their sites, oldest first, showing contractor, company,
document type, submitted date and days waiting. Opening one shows the metadata and — only for
people permitted to see documents — a preview that opens through a short-lived link. The
reviewer chooses **Approve**, **Reject** or **Not required at this site**, with a required note
on rejection, and confirms the expiry date they can actually see on the document. There is no
bulk approve and no automatic approval.

**Resubmission.** A rejected or expiring document is replaced by submitting a new version.
The previous version stays, marked **Superseded**, with its own decision history intact.
Nothing is deleted by a person; removal only happens through the retention rules.

**On the profile and at check-in.** The contractor profile shows one line per required document:
Verified (with expiry), Expiring soon, Awaiting review, Rejected, Expired, Missing, Not required.
At contractor check-in the same evaluation is done again on the server, from the records — never
from what the screen happens to be showing. Whether an outstanding document blocks entry or only
flags it stays the site's existing choice (`unsupervised` / `provisional` / `reception`), plus a
new configurable grace period after expiry.

## Failure and edge states

| Situation | Behaviour |
| --- | --- |
| Document uploaded but never reviewed | Counts as outstanding; contractor treated per the site's entry policy |
| Reviewer lacks document-view permission | Sees metadata and can still decide only if allowed; otherwise the row is read-only with an explanation |
| File missing from storage | Row shows "File unavailable — ask for it again"; never silently passes |
| Expiry passed, inside grace period | Shown as "Expired — grace period ends dd MMM"; entry decision follows the site policy |
| Document type deactivated | Existing records kept, no longer required, shown as Not required |
| Upload fails or connection drops | Nothing is recorded; the submitter is told and can retry. No partial rows |
| Same file submitted twice | Allowed; second becomes the current version, first becomes Superseded |

## Technical section

### Data model (additive, public schema, GRANTs then RLS then policies)

- `contractor_documents` — the evidence. `id`, `branch_id` (not null), `credential_type_id`,
  `holder_scope` (`person` / `company`), `person_id` nullable, `supplier_id` nullable,
  `storage_path`, `file_name`, `mime_type`, `file_size`, `issue_date`, `expiry_date`,
  `document_number` (reference), `source` (`upload` / `email` / `in_person` / `portal`),
  `submitted_by`, `submitted_by_user_id`, `submitted_at`, `version` (int, per holder + type),
  `supersedes_document_id`, `status` (`pending` / `verified` / `rejected` / `expired` /
  `superseded` / `not_required`), `current` boolean, timestamps.
  Exactly one `current = true` row per (holder, credential type, branch) — partial unique index.
- `contractor_document_reviews` — append-only decisions. `document_id`, `decision`
  (`approved` / `rejected` / `not_required`), `reviewer_user_id`, `reviewer_label`,
  `reason_code` (`illegible` / `expired_on_arrival` / `wrong_document` / `name_mismatch` /
  `insufficient_cover` / `other`), `notes`, `confirmed_expiry`, `next_action`, `created_at`.
  No update, no delete.
- `contractor_document_requirements` — what each site actually insists on, replacing the
  JSON-in-`settings` list for this feature while leaving that setting in place:
  `branch_id` (null = organisation default), `credential_type_id`, `contractor_category`
  (null = all), `is_mandatory`, `grace_days` (default 0), `block_on_fail` (default follows the
  site entry policy), `jurisdiction`, timestamps. Seeded by an administrator, not by this phase.
- `credential_types` gains `contractor_category text[]` (null = all) so identity, insurance,
  licence, background check, induction and health evidence can differ by trade.

Grants: `authenticated` reads documents, reviews and requirements; insert on documents for
`contractor.credentials.manage`; insert on reviews only through the definer function below;
`service_role` full. No `anon` grant — the kiosk never reads these tables.

RLS: every read requires `contractor.credentials.view` **and** `user_can_access_site(branch_id)`.
Company documents are visible to any site the supplier is shared with (supplier `branch_id`
null = shared organisation-wide); person documents are visible at the person's site only.

Retention: `contractor_documents` joins the existing `retention_policies` machinery as record
class `contractor_documents`, so files and rows age out under the site's own rule rather than a
hard-coded one. Retention deletes storage objects too.

### Storage

Reuse the existing private `contractor-documents` bucket. New path convention
`{branch_id}/{holder_scope}/{holder_id}/{credential_type_key}/{document_id}.{ext}`.
RLS on `storage.objects`: read and write only where the caller has the matching contractor
permission and site access, resolved through a `public.` security-definer helper. Access is
always via `createSignedUrl` with a 120-second lifetime, requested per view and never stored.
No public URLs, no email attachment path.

### Server functions (security definer, mirroring existing patterns)

- `contractor_document_submit(...)` → creates the row, sets `version`, marks the previous
  current row `superseded`, writes an audit entry. Requires `contractor.credentials.manage`.
- `contractor_document_review(p_document_id, p_decision, p_reason_code, p_notes, p_confirmed_expiry)`
  → writes the review row, updates the document status and expiry, refreshes the derived
  `contractor_credentials` row so existing screens keep working, writes audit. Requires
  `contractor.credentials.manage`; rejects a decision on a non-current or already-decided version.
- `contractor_document_signed_path(p_document_id)` → returns the storage path only to callers
  with `contractor.credentials.view`, logging the access. The signed URL itself is minted client
  side from that path.
- `contractor_compliance_status(p_person_id, p_supplier_id, p_branch_id)` → the authoritative
  evaluation: per requirement, one of verified / expiring / pending / rejected / expired /
  missing / not_required, plus `blocking` and `grace_ends`. Used by the profile **and** called
  inside contractor check-in so the decision is the server's, not the screen's.
- `contractor_documents_expiring(p_days)` → the reviewer dashboard counts.

Existing `kioskd_*` contractor lookup gains the same server-side evaluation, so a kiosk
contractor check-in is gated identically without the kiosk reading any document data.

### Client

- `src/lib/contractorDocuments.ts` — pure status evaluation (mirroring the server function so
  the UI and the server agree), grace-period arithmetic, version ordering. Unit tested.
- `src/pages/ContractorDocumentReviews.tsx` — the queue: filter by site, status, document type
  and age; row opens a right-anchored 50vw review sheet (Approve / Reject / Not required,
  reason, notes, confirmed expiry). Added as a tab on the existing contractor surface — no
  navigation redesign.
- `src/components/contractor/DocumentSubmitSheet.tsx` — attach file, type, dates, source.
- `src/components/contractor/DocumentHistoryList.tsx` — version history with each decision,
  reviewer and reason; progressive disclosure, collapsed by default.
- `ContractorCompliancePanel` and `ContractorCredentialSummary` read from the new status
  function instead of composing raw records; the visual language is unchanged.
- Check-in: `ContractorScreening` shows the server verdict and, where the site blocks, prevents
  continuing. No supervisor override on the kiosk, unchanged from today.

Icons: Lucide only, each with a visible label — `FileCheck2`, `Clock3`, `XCircle`,
`AlertTriangle`, `FileClock`, `ShieldCheck`. No emojis.

### Notifications

Only the simple case: a **counter badge** on the contractor tab for documents awaiting review,
and an existing-style alert card for mandatory documents expiring within the site's warning
window. No email in this phase.

### Audit

Every submission, decision, status change, requirement change and document view writes an
`audit_log` entry with the acting user, site, contractor, document type and version. File
contents and signed URLs never appear in the log.

### AU/UK separation

Requirements are per site and per jurisdiction, so an AU site sees WWCC, police check and
influenza evidence while a UK site sees DBS, RAMS and insurance — from configuration, not code.
Nothing about server separation changes.

## Decisions the client must configure (not hard-coded)

- Which documents are mandatory, per site and contractor category.
- Whether a missing or expired document blocks entry or only flags it, and the grace period.
- Whether police/background checks and vaccination or health evidence may lawfully be collected
  and retained at that site, and for how long.
- Who holds `contractor.credentials.manage` — reviewing is a compliance role, not reception.
- Whether company documents are shared across sites of one organisation.

The build ships all of these as settings with conservative defaults (mandatory = off,
grace = 0 days, block = follow existing entry policy, health evidence type inactive).

## Acceptance criteria

- A submitted document is never treated as valid until an authorised reviewer decides.
- A decision cannot be recorded without a reviewer, timestamp and — for rejection — a reason.
- Rejecting or superseding never deletes the prior file or its decision history.
- A user without `contractor.credentials.view` sees no document, no metadata and no queue.
- A user at site A cannot open a person document held at site B.
- Contractor check-in reaches the same verdict as the profile, computed on the server, even if
  the client sends a stale or altered status.
- A document file is reachable only through a signed link of two minutes or less.
- An expired document inside grace shows the grace end date and follows the site policy.
- Deactivating a document type never hides existing evidence.
- Every submission, view and decision appears in the audit log without exposing the file.

## Tests

Pure tests: status evaluation across verified, expiring, pending, rejected, expired, missing,
not required, grace boundaries, version ordering and superseding. Database tests: submit then
review happy path, second decision on the same version refused, review without permission
refused, cross-site read refused, storage policy refused for an unrelated site, check-in gate
matches `contractor_compliance_status`, requirement grace period respected, audit rows written
with no path or URL. Plus typecheck, build, full suite and a live submit-review-check-in run.

## Rollback

All tables, columns and functions are additive; `contractor_credentials` keeps being written
as the derived current state, so reverting the UI to the previous panels restores the old
behaviour with no data loss. Rolling back means dropping the three new tables and the added
column; no visit or contractor master data is touched.

## Out of scope

Weekly email delivery; navigation redesign; broad UI redesign; seed data; historical
reconciliation apply; automated document reading or OCR; external contractor portal.
