

## Analysis

### Current Problem
The **Kiosk Lookup Settings** card (Resident Lookup Mode + Staff Lookup Mode) sits inside `ResidentLeaveSettingsTab.tsx` under **Resident Settings → Leave Configuration**. These settings control how **visitors and volunteers** find residents/staff during kiosk check-in — they have nothing to do with resident leave configuration.

### What already exists in the right place
- `ResidentPrivacyTab.tsx` — per-type resident lookup mode toggle, already wired into Visitor and Volunteer settings via `PersonTypeSettings.tsx`. This **correctly handles** resident lookup mode per persona.

### What's missing
- **Staff Lookup Mode** has no per-type equivalent yet. It's only managed globally from the misplaced card in Resident Leave settings.
- The hook (`useKioskCheckInFlow.ts` line 57) loads `kiosk_staff_lookup_mode` globally but doesn't check for a type-specific override like it does for resident lookup mode.

### Plan

#### 1. Remove Kiosk Lookup Settings from Resident Leave Settings
Strip lines 101–168 from `ResidentLeaveSettingsTab.tsx` (the entire second `<Card>`). Also remove the `residentLookupMode` and `staffLookupMode` state variables and their save keys — leave settings should only save leave-related keys.

#### 2. Create `StaffPrivacyTab.tsx`
Mirror the `ResidentPrivacyTab` pattern. Offers three modes: "Search First", "Group by Department", "Free Text Only". Uses key `kiosk_staff_lookup_mode_{personType}` with fallback to global `kiosk_staff_lookup_mode`.

#### 3. Add Staff Privacy section to Visitor & Volunteer settings
In `PersonTypeSettings.tsx`, add a "Staff Lookup on Kiosk" accordion section (using `Users` icon) for visitor and volunteer types, right after the existing "Resident Privacy on Kiosk" section.

#### 4. Update `useKioskCheckInFlow.ts` for per-type staff lookup
Add `kiosk_staff_lookup_mode_${selectedType}` to the settings query. Prefer type-specific, fall back to global — same pattern already used for resident lookup mode.

### Files

| File | Change |
|------|--------|
| `src/components/settings/ResidentLeaveSettingsTab.tsx` | Remove Kiosk Lookup Settings card + related state/save logic |
| New: `src/components/settings/StaffPrivacyTab.tsx` | Staff lookup mode selector per person type |
| `src/components/settings/PersonTypeSettings.tsx` | Add "Staff Lookup on Kiosk" section for visitor/volunteer |
| `src/hooks/useKioskCheckInFlow.ts` | Add type-specific staff lookup key to query + fallback logic |

