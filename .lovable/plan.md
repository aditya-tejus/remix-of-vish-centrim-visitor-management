# Contractor check-in that reflects real site operations

Today a contractor check-in asks whoever is standing at the kiosk to type a reference number and an expiry date against the *company*. That is the wrong question to the wrong person: a police check / DBS belongs to the individual worker, and nobody at a kiosk should be able to type in their own compliance status. This rebuilds the flow around "show me your status, and only ask for something if it's missing".

## How it should work

**1. Recognise the worker, not just the company**

Contractor check-in identifies the individual (name + mobile, or their personal QR from a previous visit) and the company they work for. Personal checks (police check / DBS / WWCC) live against the person. Company-wide items (public liability insurance, trade licence) stay against the supplier. Each credential type is marked in Settings as "held by the person" or "held by the company".

**2. Show status, don't ask for data**

Once the worker and company are known, check-in shows a simple compliance card:

```text
  Police check        Valid to 14 Mar 2027        Valid
  Public liability    Expires in 12 days          Expiring
  Trade licence       Not on file                 Action needed
```

Everything valid -> "All clear, continue". No typing at all. This is the normal case for a regular contractor, and it should take one tap.

**3. Only ask when something is actually missing or expired**

For each failing item the contractor is asked to photograph or attach the document (kiosk camera or file picker on the desk app), then confirm the expiry date shown on it. Reference number becomes optional, not required — the document itself is the evidence. Uploads go to a private documents area; only signed-in staff can view them.

**4. Verification is a staff act, not a self-declaration**

A document uploaded at the kiosk is recorded as *pending verification*. A staff member opens it from the contractor's record, confirms it matches, and marks it verified — that action is written to the audit trail with who and when. A self-uploaded, unverified document never counts as "valid" on its own.

**5. What happens when they can't comply — configurable**

New Settings option, `contractor_entry_on_fail`, with three modes:

- **Provisional entry (escorted)** — they are checked in, flagged "compliance pending", escorted only, and appear in a staff action list.
- **Hard stop, see reception** — kiosk refuses politely and directs them to a staff member, who can complete or override at the desk with a written reason.
- **Depends on unsupervised access** — current behaviour: blocks only when they will be unsupervised with residents.

Staff overrides always require a reason and are logged.

**6. Checkout**

Contractor checkout adds one step only: any keys or fobs still issued to them are listed, and they confirm return (or staff record them as still held). Nothing else added.

## Screens affected

- Kiosk contractor check-in: worker identification, status card, upload-only-if-needed step, escorted/provisional messaging.
- Staff check-in sheet (`ContractorScreening`): same status card, plus staff can verify documents inline and override with a reason.
- Contractor / supplier settings: credential types gain a "held by person or company" choice and an optional "document required" flag; new entry-on-fail setting.
- Visitor profile (contractor): a "Compliance documents" panel listing every credential — personal and company — with its status (valid / expiring / expired / pending check), expiry date, the attached file viewable or downloadable by staff, who uploaded it, and who verified it and when. Staff can verify, replace an expired document, or upload a missing one from here, and every action is logged. Past visits show the status the contractor held on that day.
- Checkout sheet + kiosk checkout: outstanding keys prompt.

## Technical notes

- New table `contractor_people` (person, mobile, supplier link, personal QR) and `contractor_credentials` (person, credential type, expiry, verification status, verifier, document path). Existing `supplier_credentials` remains for company-level items.
- `credential_types` gains `holder_scope` ('person' | 'company') and `requires_document`.
- Private storage bucket `contractor-documents`, staff-read policies only; kiosk writes through a restricted path.
- `evaluateContractorGate` extended to merge person-level and company-level credentials and to respect the new `contractor_entry_on_fail` setting; unverified documents are treated as pending, not valid.
- All overrides and verifications write to `audit_log`.

## Delivered in two passes

1. Data model, settings, status card and upload/verify flow on the staff side.
2. Kiosk contractor flow, provisional entry handling, and the checkout keys prompt.
