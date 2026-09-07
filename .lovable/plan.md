# Kiosk repeat visitors, companion fixes, and a Keys Register

## 1. Repeat visitors — recognition happens as they type

No separate "been here before?" screen and no extra tile. The visitor just starts checking in as normal:

- They enter first name, surname and mobile on the details step.
- As soon as name + mobile match a past visit, a quiet card slides in: "Welcome back, Sarah — we've filled in the rest from your last visit." Email and address fill themselves in, and they can edit anything.
- If nothing matches, nothing happens — the form behaves exactly as it does today. No "have you been here before?" prompt that a first-timer has to dismiss.

Then the visiting step becomes one tap for regulars:

- Top of the screen: "Here to see John Smith (Room 12)?" with a big Yes button, based on who they visited last time.
- Below it: "Someone else" which opens the normal resident search/list (respecting the existing privacy lookup mode).

Settings (Visitor and Volunteer kiosk sections), each independently switchable:

- Recognise returning visitors by name + mobile (on/off)
- Suggest the resident they visited last time (on/off)
- Personal QR badge — a permanent code the visitor keeps and scans to be recognised instantly (on/off)

With everything off, the kiosk works as it does today. Health questions, terms and food questions are always asked fresh, never pre-answered.

Privacy: matching runs server-side and returns only the one matched person's own details; a mobile number that doesn't match returns nothing, so the kiosk can never be used to browse visitors.

## 2. Companion step fixes

- The Yes/No answer stays on screen and can be changed at any time; choosing "No" clears anything half-entered.
- Back from the companions screen returns to the Yes/No question first, not out of the step.
- A clear remove button on every companion row, plus "Add another" below.
- The review screen lists companions with a link back to change them.

## 3. Keys Register (new section in the left menu)

A standalone Keys Register page, staff-operated — issuing is a staff action, not something a contractor does themselves at the kiosk.

Main view — every key in the village at a glance, colour coded:

- Green: in the cabinet / available
- Amber: issued and within expected return time
- Red: overdue or reported lost
- Grey: retired / decommissioned

Grouped by property or resident, so a unit with three keys (one held by the resident, one in the cabinet, one out with a plumber) reads clearly on one row: "Unit 12 — 3 keys: 1 with resident, 1 available, 1 issued to ABC Plumbing (due 4:00 pm)".

Each key record holds: key number/label, key type (front door, master, mailbox, garage, gate), the property/unit or resident it belongs to, how many copies exist, current holder, storage location (cabinet/hook), and notes.

Issue and return, done by staff:

- Issue: pick a key, pick who it's going to (a checked-in contractor, a staff member, or a resident/family member), set expected return, add notes, and it flips to issued. A key already out can't be issued again.
- Return: one tap to return, capturing time, who received it back, and condition notes.
- Overdue keys surface at the top of the page and on the daily dashboard alert area.
- Full history per key — every issue and return with times and names — for audit.

Contractor link:

- When a contractor is checked in, staff can issue a key straight from their visit record.
- At contractor checkout (kiosk or staff), if that person still holds a key, a clear warning appears and staff must either record the return or note why it's still out. The checkout is recorded either way, with the outstanding key flagged.

## 4. Not included

Visitors taking a resident out during their own kiosk checkout — stays staff-only for now.

## Technical notes

- Settings keys per person type: `kiosk_returning_recognition_{type}`, `kiosk_suggest_last_resident_{type}`, `kiosk_personal_qr_{type}`, following the existing `{setting}_{person_type}` convention.
- Recognition uses a new security-definer function (extending the `kiosk_prefill_visitor` pattern) matching on name + normalised mobile, returning a single row including last resident visited; a second variant matches a personal QR.
- Persistent visitor QR stored on a stable per-person value reused across visits; the existing per-visit `qr_code` continues to drive checkout.
- New tables `property_keys` and `key_issues` in the public schema, each with GRANTs, staff-only RLS (no anon access — issuing is authenticated), and `updated_at` triggers. Overdue status is derived, not stored.
- New route `/keys` plus an entry in `AppSidebar`, with an overdue-key count badge.
- Companion changes are confined to `useKioskCheckInFlow.ts` and `KioskCheckIn.tsx`.
