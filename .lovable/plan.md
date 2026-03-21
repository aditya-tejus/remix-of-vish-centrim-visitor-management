

## Analysis

### Current State
- A `kiosk_resident_lookup_mode` setting exists (`show_all` | `search_first`) and is stored in the `settings` table.
- The kiosk check-in flow (`KioskCheckIn.tsx` line 82-86) already respects this setting -- if `search_first`, residents only appear after typing 3+ characters.
- This setting is currently located under **Resident Leave Settings** (the wrong place). It should be under **Visitor** and **Volunteer** person-type settings since it controls what happens when those personas check in and select "who are you visiting."

### What Needs to Change

#### 1. Move/duplicate the privacy setting to Visitor and Volunteer settings
Add a "Resident Privacy" card inside the Visitor and Volunteer `PersonTypeSettings` accordion sections. This card will contain:
- **Resident Lookup Mode**: "Show All Residents" vs "Search First (3+ chars)" toggle
- Clear privacy-focused description explaining why a care home might want this off

The setting key will follow the existing prefixing convention: `kiosk_resident_lookup_mode_visitor` and `kiosk_resident_lookup_mode_volunteer`, falling back to the global `kiosk_resident_lookup_mode` if no per-type override exists.

#### 2. Update the kiosk check-in hook to use per-type settings
In `useKioskCheckInFlow.ts`, after the `selectedType` is known, load the type-specific setting (e.g., `kiosk_resident_lookup_mode_visitor`) and fall back to the global setting.

#### 3. Verify kiosk front-end behaviour
The existing filtering logic in `KioskCheckIn.tsx` (lines 74-87) already handles both modes correctly. No changes needed there -- it reads `flow.residentLookupMode` which will now be type-aware.

### Files to Edit

| File | Change |
|------|--------|
| `src/components/settings/PersonTypeSettings.tsx` | Add a "Resident Privacy on Kiosk" section for visitor and volunteer types |
| New: `src/components/settings/ResidentPrivacyTab.tsx` | Small component with the lookup mode toggle + save button |
| `src/hooks/useKioskCheckInFlow.ts` | Load type-specific `kiosk_resident_lookup_mode_{type}` setting, fall back to global |

### Technical Detail

**Settings key convention:**
- `kiosk_resident_lookup_mode` (global fallback, already exists)
- `kiosk_resident_lookup_mode_visitor` (per-type override)
- `kiosk_resident_lookup_mode_volunteer` (per-type override)

**Hook change in `useKioskCheckInFlow.ts`:**
```typescript
// Add type-specific key to settings query
.in("key", [..., `kiosk_resident_lookup_mode_${selectedType}`])
// Prefer type-specific, fall back to global
const typeSpecific = data?.find(d => d.key === `kiosk_resident_lookup_mode_${selectedType}`);
const global = data?.find(d => d.key === "kiosk_resident_lookup_mode");
const mode = typeSpecific?.value || global?.value || "search_first";
```

**No database migration needed** -- the `settings` table already supports arbitrary key-value pairs with upsert on conflict.

