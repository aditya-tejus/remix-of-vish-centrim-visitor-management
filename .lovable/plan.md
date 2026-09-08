# Kiosk privacy, printable badges, rotating QR, and staff logins

Four fixes, all small and independent.

## 1. Resident privacy setting is ignored on the kiosk leave/return screen

The "only show resident names after 3 letters" setting is already respected on the visitor check-in screen, but the kiosk **Resident leaving / coming back** screen ignores it and lists every resident by default.

Fix: that screen reads the resident privacy setting (per-type resident value, falling back to the global one).
- Search-first mode: no names shown until 3 characters are typed by name or villa/room number; before that a short prompt ("Start typing a name or room number").
- Show-all mode: unchanged.
- The same rule applies to both the "leaving" list and the "coming back" list.

## 2. Printable visitor badge from the profile

A **Print badge** action on the visitor profile and on the desk check-in confirmation, printing a card with:
- Name and person type
- Mobile number
- Visit date (and check-in time)
- Room / villa and wing of the resident being visited
- QR code (their stored personal code, so the same code works for check-out)

It reuses the existing badge print layout, so it works with both a normal printer and the Brother label roll already configured in Settings.

## 3. Kiosk welcome QR refreshes every 5 minutes

The QR on the kiosk welcome screen (for checking in from your phone) currently never changes. It will regenerate every 5 minutes with a fresh short-lived token in the link, so a photographed code stops working. Links older than the window land on the kiosk check-in page with a "please scan the code again" message.

## 4. Staff logins with limited permissions

Staff already sign in with their own account and a role of admin or staff. Today both roles can do everything.

As requested: **staff can change settings, but cannot edit or delete visitor records.** Admins keep full access. (If you'd rather have it the other way round, say so and I'll flip it.)
- Editing a visitor's details and deleting records become admin-only, both in the screen (buttons hidden/disabled with a short "Admins only" note) and enforced in the database so it cannot be bypassed.
- Checking people in and out stays available to staff — that is daily work, not editing a record.
- Kiosk self-service stays as it is: visitors can only check themselves in or out, never change an existing record.

## Technical notes

- `src/pages/kiosk/KioskResidentLeave.tsx`: read `kiosk_resident_lookup_mode_resident` with fallback to `kiosk_resident_lookup_mode`; gate `filteredResidents` / `filteredAway` behind a 3-char query in `search_first`.
- New `src/components/PrintBadgeButton.tsx` (or extend `VisitorBadge` print path) feeding `printBadgeAuto` with mobile, room/wing resolved from `visitedResidentIds` via `useResidents`, and the QR value `visitor.personQr || visitor.qrCode || visitor.id`; add QR rendering to the badge markup in `src/lib/printBadge.ts`. Wire into `VisitorProfilePage.tsx` and the `CheckInSheet` confirmation.
- `src/pages/kiosk/KioskAttract.tsx`: 5-minute interval regenerating a `?t=<epoch-bucket>` token; `KioskCheckIn` validates the bucket age and shows a re-scan notice if stale.
- RLS: split `visitors` UPDATE/DELETE policies so full-record updates and deletes require `has_role(auth.uid(),'admin')`, while check-in/check-out writes remain open to `authenticated`; settings writes stay open to admin and staff. UI gating via `useAuth().role`.
