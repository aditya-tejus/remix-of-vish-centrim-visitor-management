# Make the food question optional at check-in

Today, anyone visiting a named resident is always asked "Are you bringing food?" — both on the kiosk and at the front desk. Some homes don't want that question in the sign-in flow at all. This adds a switch so each site can turn it on or off.

## What changes for you

- New "Food Register" section inside Visitor Settings and Volunteer Settings.
- A single switch: "Ask about food during check-in".
- Default: On, so nothing changes until someone turns it off.
- When Off: the food step disappears from the kiosk and from the staff check-in panel for that person type. Staff can still add a food record manually from the Food Register page at any time.
- Setting changes are written to the audit trail like other settings.

## Where it takes effect

```text
Kiosk check-in  -> Food step shown only if switch is On
Staff check-in  -> Food step shown only if switch is On
Food Register   -> unchanged; manual entry always available
```

## Technical notes

- New settings rows, following the existing per-type convention:
  `food_register_checkin_visitor`, `food_register_checkin_volunteer` (`"true"` / `"false"`, seeded `"true"`).
- New component `src/components/settings/FoodRegisterSettingsTab.tsx` (switch + audit_log write, same shape as `ResidentPrivacyTab`), registered in `PersonTypeSettings.tsx` for the visitor and volunteer sections only.
- `src/hooks/useKioskCheckInFlow.ts`: add the key to the existing settings query, expose `foodStepEnabled`, and require it in the `food` pipeline condition (alongside type and `visitedResidentId`).
- `src/components/checkin/useCheckInFlow.ts`: fetch the same key for the selected type and AND it into `foodStepApplies`.
- Missing setting row is treated as On, so existing sites keep current behaviour.
- No database schema change; values are inserted/updated in the existing `settings` table.
