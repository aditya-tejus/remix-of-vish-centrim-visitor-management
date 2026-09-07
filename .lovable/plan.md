# Kiosk: repeat visitors, companion fixes, contractor key register

## 1. Returning visitor fast lane (all optional, per setting)

New "Been here before?" panel on the kiosk check-in details step, plus a shortcut tile on the kiosk home screen. Three recognition methods, each independently switched on or off in Settings > Visitor > Kiosk:

- Mobile number: visitor types their mobile, we find their last visit and pre-fill name, email, address and who they were visiting.
- Personal QR: a permanent code issued to the visitor (shown on the success screen and printable/emailable), scanned to load their profile instantly.
- Name search: type first and last name, pick the matching card, confirm.

Behaviour once matched: a confirmation card shows the saved details with "That's me" / "Not me". Confirming skips straight past the details step to who they're visiting, with the last resident pre-selected as a one-tap suggestion. Health questions and terms are always asked fresh — never pre-answered.

If all three switches are off, the kiosk behaves exactly as it does today.

Privacy: matching is done through a server-side lookup that returns only the matched person's own details, never a browsable list.

## 2. Companion step fixes

- The Yes/No answer stays visible and changeable on the companions screen; picking "No" clears any half-entered companions immediately.
- Back from the companions screen returns to the Yes/No question rather than out of the step.
- Each companion row gets a clear remove button, and an "Add another" button below.
- The review screen shows companions with the ability to jump back and change them.

## 3. Contractor key register (full register)

New records:

- Keys: a managed list of keys with a label/number, key type, optional link to a resident or property/wing, notes, and active status. Managed in Settings > Contractors > Key Register.
- Key issues: which key, who took it (contractor visit), issued at, issued by, expected return, returned at, returned to, condition/notes.

A key can only be issued when it is not already out; the list shows availability at a glance.

Kiosk and staff flows:

- Contractor check-in gains an optional "Keys issued" step (only when the key register is enabled): staff/contractor selects one or more keys, which are then marked as out.
- Contractor checkout prompts for key return; any keys still out are flagged and the person cannot silently finish — staff are alerted and the outstanding key is recorded.
- A Key Register page lists all keys, current holder, overdue returns, and full issue history for audit.

## 4. Not included

Visitors checking out a resident during their own kiosk checkout — deferred, stays staff-only for now.

## Technical notes

- New settings keys: `kiosk_returning_lookup_mobile`, `kiosk_returning_lookup_qr`, `kiosk_returning_lookup_name`, `contractor_key_register_enabled`.
- Extend the existing `kiosk_prefill_visitor` security-definer function with a mobile-based variant and a QR-based variant so the anonymous kiosk never queries `visitors` directly.
- Persistent visitor QR: store a stable `person_qr` on a lightweight lookup keyed by name+mobile, reused across visits (current `qr_code` stays per-visit for checkout).
- New tables `keys` and `key_issues` in the public schema, each with grants, RLS (staff read/write; anon insert limited to kiosk issue/return through a definer function) and `updated_at` triggers.
- Companion state changes are local to `useKioskCheckInFlow` and `KioskCheckIn`.
