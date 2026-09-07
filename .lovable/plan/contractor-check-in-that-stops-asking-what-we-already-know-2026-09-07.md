# Contractor check-in that stops asking what we already know

Today a contractor at the kiosk is asked for their company even when we already have them, then gets one long fixed list of questions that mixes company paperwork, one-off induction and quick every-visit checks — plus a resident-access question they shouldn't be answering at all. This reworks it around who owns each answer and how long it stays valid.

## What the contractor sees at the kiosk

1. **Name and mobile** (unchanged). We match them to their worker record.
2. **Company confirmed, not searched.** If we know them: "Acme Plumbing — is that right?" with a small *Change* link. Only a genuinely new person sees the search box.
3. **What's already on file.** A short green line: "Insurance to 12 Mar 2027 · Police check to 4 Aug 2027 · Site induction done 3 Feb". Nothing to do.
4. **Only what's outstanding.** Missing or expired items appear as cards with an upload/photo action, exactly as now.
5. **Today's quick checks.** PPE, illness, work area — a handful of large Yes/No rows.
6. **Nothing resident-access related.** That question moves to staff only.

If a staff-only question is outstanding, the kiosk shows a single calm line — "Reception will finish one item with you" — and the visit is flagged for the desk rather than blocking the person in front of a queue.

## What each question is tagged with

Every screening question gets four settings:

- **Who it belongs to** — the company (asked once for Acme, good for everyone from Acme), the person (asked once for Dave), or every visit.
- **Who may answer it** — the contractor themselves, or staff only.
- **How long the answer lasts** — never expires, a set number of days/months, or every visit.
- **Whether a "No" holds them up** — and that feeds the existing entry rule (stop only if unsupervised, let in flagged, or send to reception).

So SWMS/RAMS and insurance become company answers asked once; site induction and safeguarding become person answers remembered for 12 months; PPE, illness and work area stay per-visit; unsupervised resident access becomes staff-only.

## Settings

A single **Contractor screening** manager beside the existing credentials list, seeded with today's Australian and UK question sets so nothing is lost. Staff can add, edit, reorder, deactivate and delete questions, and set the four options above on each, per region. A short preview panel shows what a returning contractor versus a first-timer will actually be asked.

## Staff side

- The check-in sheet at the desk shows the same status-first layout, plus the staff-only questions.
- The contractor's profile lists every answer with its date, who gave it, and when it lapses — alongside the documents panel that's already there.
- Answers that lapse show as "due again" in the profile and reappear at the next check-in.

## Technical notes

- New table `contractor_questions`: `key`, `label`, `input_type` (yesno/text/select), `options`, `owner_scope` (company/person/visit), `answered_by` (contractor/staff), `validity_days` (null = never expires), `required`, `blocks_on_no`, `jurisdiction` (ALL/AU/UK), `is_active`, `sort_order`. Seeded from the current `auScreeningQuestions` / `ukScreeningQuestions` arrays in `ContractorScreening.tsx`.
- New table `contractor_question_answers`: `question_id`, `supplier_id` (nullable), `person_id` (nullable), `answer` (jsonb), `answered_by`, `answered_at`, `expires_at`. Both tables get GRANTs, RLS (staff read/write; kiosk-scoped anon insert for contractor-answerable questions only), and `updated_at` triggers. Visit-scope answers continue to live in `visitors.contractor_screening`.
- `src/lib/contractorCredentials.ts`: extend the merged checklist/gate to fold question outcomes in beside credentials, so one evaluation drives both. `UNSUPERVISED_ACCESS_KEY` becomes a staff-only question row rather than hardcoded UI.
- New `src/hooks/useContractorQuestions.ts` for question types plus resolved answers for a given supplier/person, exposing `outstanding`, `onFile`, and `staffOnlyOutstanding`.
- `ContractorScreening.tsx` restructured into: company confirmation chip → on-file summary → outstanding credentials (existing `ComplianceChecklist`) → outstanding questions → per-visit questions. Kiosk variant hides staff-only items and uses kiosk-sized controls via the existing `KioskDynamicQuestions` styling.
- Kiosk persistence writes company/person answers with `expires_at` and stamps `visitors.compliance_status` as before.
- New `src/components/settings/ContractorQuestionsTab.tsx` in the contractor settings area; setting changes audit-logged like the existing entry rule.
