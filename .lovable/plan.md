# Dynamic contractor credentials + smarter access question

Two changes: make the "required credentials" list something you manage yourself (not a fixed two),
and make the unsupervised-access question behave sensibly instead of being blindly mandatory.

## 1. Manage your own credential list

Today the app only knows three fixed credentials (DBS, Aged Care Worker Screening, Public Liability
Insurance), each hard-wired into the supplier record. Instead, credentials become a list you control
in Settings, like leave types or check-in questions.

For each credential you can set:
- Name (e.g. "Working with Children Check", "White Card", "Professional Indemnity")
- Short label used on badges/chips
- Which region it applies to (Australia, United Kingdom, or both)
- Whether it is **required before check-in can proceed**
- Active / inactive, and display order

The three existing credentials are carried over automatically with their current expiry dates and
reference numbers, so nothing is lost and nothing changes until you edit the list.

## 2. Recording credentials on a supplier

The contractor screening step keeps the same look, but the credential cards are now generated from
your list — every active credential for the current region shows an expiry date and reference field,
saved against that supplier. Status stays the same: Verified / Expiring soon / Expired / Not recorded.

## 3. The unsupervised-access question

Current behaviour: the question is always required, and it alone decides whether missing credentials
block entry. Refined behaviour:

- The question is asked **first**, before the credential cards, since it decides what matters next.
- It is only compulsory when at least one credential is marked as required. If nothing is required,
  it stays visible but optional (still recorded for the audit trail).
- Answering **Yes** enforces the required credentials, as now.
- Answering **No** reveals a short "Escorted by / reason" field so the exemption is justified and
  auditable, rather than being a silent bypass. Missing credentials are still shown as warnings.
- If the answer is left blank while required credentials exist, check-in is held with a clear prompt
  rather than proceeding as if the answer were No.
- The answer, and the escort/reason text, are written to the audit log with the check-in.

Applies to both the web check-in flow and the kiosk.

## Technical notes

- New table `credential_types` (key, label, short_label, jurisdiction `AU`/`UK`/`ALL`, is_required,
  is_active, sort_order) and `supplier_credentials` (supplier_id, credential_type_id, expiry_date,
  reference), both with grants + RLS matching the existing config/supplier tables (staff read/write).
- Migration seeds the three current types and backfills `supplier_credentials` from the existing
  `dbs_*`, `acws_*`, `insurance_*` columns on `suppliers_min`. Old columns are left in place
  (read-only) for one release, then removed later.
- `src/lib/contractorCredentials.ts`: `CredentialKey` becomes a plain string;
  `getSupplierCredentials()` takes the credential-type rows plus the supplier's credential rows;
  `isContractorBlocked()` gains an `unsupervisedAnswered` notion so a blank answer holds check-in.
  The `contractor_mandatory_credentials` setting is retired — "required" now lives on each type.
- `useContractorEnforcement.ts` becomes a react-query hook loading active credential types for the
  current jurisdiction; new `useSupplierCredentials(supplierId)` for read/upsert.
- `ContractorEnforcementTab.tsx` becomes a full CRUD manager (add/edit/reorder/deactivate) following
  the `LeaveTypesTab` pattern, with the required checkbox inline and the existing explanatory copy.
- Call sites updated: `ContractorScreening.tsx`, `useCheckInFlow.ts`, `AddVisitDialog.tsx`,
  `useKioskCheckInFlow.ts`, `KioskCheckIn.tsx`.
