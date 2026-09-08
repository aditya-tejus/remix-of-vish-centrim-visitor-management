# Control which person types appear, and what they're called on the kiosk

Right now the list of person types is fixed in code: the kiosk always offers Visitor, Contractor and Volunteer (Staff is missing entirely), and the wording can't be changed. This adds a single place in Settings to decide which types are offered, where, and what the kiosk calls them.

## What changes for you

A new "Person Types" panel at the top of Settings (above the per-type sections), with one row per type: Visitor, Contractor, Volunteer, Staff, Resident.

Each row has:
- **Kiosk** switch — show this type on the kiosk's "Who are you?" screen.
- **Front desk** switch — show this type on the staff check-in panel and the New Check-In page.
- **Kiosk name** — free text, e.g. "Family & Friends" instead of "Visitor", "Trades" instead of "Contractor". Blank means the standard name.
- A short line of guidance so it's clear what the type is used for.

Rules that protect day-to-day use:
- Visitor cannot be switched off at the front desk (a home always needs to sign someone in).
- Resident isn't a check-in type — its row only controls the resident leave/return tile on the kiosk.
- Turning a type off hides it from new check-ins only; existing records, lists and reports are untouched.
- The left-hand Settings navigation still lists every type so a switched-off type can be reconfigured and turned back on.
- Every change is written to the audit trail, like other settings.

**Staff on the kiosk:** Staff sign-in is added as a kiosk option and ships switched on, so staff can sign in and out at the kiosk the same way visitors do.

Renaming affects kiosk wording only. Internal lists, filters and reports keep the standard names so reporting stays consistent.

## Where it takes effect

```text
Kiosk "Who are you?"   -> only kiosk-enabled types, shown with the kiosk name
Kiosk resident leave   -> tile hidden if Resident kiosk switch is off
Staff check-in panel   -> only desk-enabled types
New Check-In page      -> only desk-enabled types
Settings navigation    -> unchanged, all types always reachable
Visit list / reports   -> unchanged, standard names
```

## Technical notes

- New settings rows following the existing per-type convention:
  `person_type_kiosk_{type}`, `person_type_desk_{type}` (`"true"`/`"false"`, missing = enabled),
  `person_type_label_{type}` (string, missing/blank = built-in label).
- New `src/hooks/usePersonTypes.ts` — one query over those keys, returns `{ type, kioskEnabled, deskEnabled, kioskLabel, label }[]` plus helpers `kioskTypes` and `deskTypes`; treats missing rows as enabled so nothing changes for existing sites.
- New `src/components/settings/PersonTypesTab.tsx` — table of switches + label inputs, saves via upsert on `settings` and writes an `audit_log` row (same shape as `FoodRegisterSettingsTab`).
- `src/pages/Settings.tsx` / `SettingsNav.tsx`: add a "Person Types" entry under Global (or a pinned row above Person Types) rendering the new tab.
- `src/pages/kiosk/KioskCheckIn.tsx`: replace the hardcoded `TYPES` array with the hook output; add a `staff` entry (UserCog icon, "Staff member sign-in") to the built-in definitions; skip the type step automatically when only one type is enabled.
- `src/pages/kiosk/KioskHome.tsx`: hide the Resident Leave tile when Resident's kiosk switch is off.
- `src/pages/PersonTypeSelector.tsx` and `src/components/checkin/StepIdentify.tsx` (type chooser in the staff check-in sheet): filter by `deskTypes`.
- `src/hooks/useKioskCheckInFlow.ts`: staff type already flows through the existing settings-driven pipeline (`kiosk_staff_lookup_mode_staff`, form fields, questions for `visitor_type = 'staff'`) — no pipeline change needed beyond allowing the type through.
- No schema change; values live in the existing `settings` table.
