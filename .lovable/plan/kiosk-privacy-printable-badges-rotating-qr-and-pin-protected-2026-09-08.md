# Kiosk privacy, printable badges, rotating QR, and PIN-protected evacuation on the kiosk

Four changes, all independent.

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

## 4. Emergency roll call on the kiosk, behind a staff PIN

A small, discreet icon in the kiosk footer. Pressing and holding it (or tapping it several times) opens a numeric PIN pad. With the correct PIN, the kiosk shows the live evacuation roll call and staff can action it there.

- PIN is set in Settings (Evacuation / Emergency section), stored securely and never shown in the kiosk screen; 5 wrong attempts locks the pad for 60 seconds.
- After unlocking, the kiosk shows the same roll call used on the desktop: everyone on site grouped by stage/wing then villa/room, with each person on their own line, assistance needs, phone and next of kin.
- Staff can start a drill/evacuation if none is running, mark people safe with one large tap, mark unaccounted, and see live "X of Y accounted for" progress per area. Every action records the time; the PIN session is attributed to a staff name chosen on unlock.
- Big touch targets, no hovers, and a clear Exit that returns to the welcome screen. The kiosk idle timeout is paused while the roll call is open so it never closes mid-evacuation.

## Technical notes

- `src/pages/kiosk/KioskResidentLeave.tsx`: read `kiosk_resident_lookup_mode_resident` with fallback to `kiosk_resident_lookup_mode`; gate `filteredResidents` / `filteredAway` behind a 3-char query in `search_first`.
- Badge: extend `src/lib/printBadge.ts` markup with mobile, room/wing and a QR image; resolve room/wing from `visitedResidentIds` via `useResidents`; QR value `visitor.personQr || visitor.qrCode || visitor.id`. Wire into `VisitorProfilePage.tsx` and the `CheckInSheet` confirmation.
- `src/pages/kiosk/KioskAttract.tsx`: 5-minute interval regenerating a `?t=<epoch-bucket>` token; `KioskCheckIn` validates bucket age and shows a re-scan notice if stale.
- New `src/pages/kiosk/KioskEvacuation.tsx` + `src/components/kiosk/KioskPinPad.tsx`, route `/kiosk/evacuation`, trigger rendered in `KioskLayout` footer. Reuses `buildRollCall` from `src/lib/evacuation.ts` and `useEvacuation` for drill create/attendance updates.
- PIN: stored as a salted hash in `settings` (`kiosk_staff_pin_hash`), verified through a `SECURITY DEFINER` function so the hash is never sent to the kiosk; attempts logged to `audit_log`.
- Evacuation writes from the kiosk run under the anonymous kiosk session, so `evacuation_drills` / `evacuation_attendance` policies need a check that these paths stay limited to drill creation and status marking.
