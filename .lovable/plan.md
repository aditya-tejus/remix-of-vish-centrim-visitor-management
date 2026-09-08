# Fix Resident Return Notifications

## What's actually wrong

Three separate faults, all confirmed:

1. **The screen is empty because there are no branches set up.** The settings live per branch, and the database currently has zero active branches. With no branch to select, the page shows only the empty "Branch" dropdown and none of the alert sections — so there is nothing to switch on or save.
2. **Nothing reads the settings.** Even when saved, the grace period, escalation delay, recipient lists, safe-return switch and next-of-kin option are stored and never used anywhere. The overdue-resident warning on the dashboard is driven by a completely different, older on/off switch and fires the moment the expected time passes, ignoring the grace period entirely.
3. **The staff picker is fake.** It offers six invented names (Sarah Mitchell, James Okafor, etc.) instead of the real staff records in the system.

## What will change

**Works without branches**
- If no branches exist, the page shows one clear "All sites" setting instead of an empty dropdown, and saves normally.
- If branches are added later, the dropdown reappears with "All sites" as the default entry.

**Real staff**
- The staff picker searches actual staff records (name, role, department) instead of the invented list. If a saved staff member is later deactivated, they show as removed with a prompt to pick someone else.

**Settings that actually drive alerts**
- Overdue resident alerts respect the grace period: a resident is only flagged once the expected return time plus the grace period has passed.
- The overdue section's own on/off switch controls whether the alert appears — the old separate switch is retired and its current value carried over so nothing changes unexpectedly.
- Escalation: once the escalation delay has also passed, the alert is shown at raised severity and labelled "Escalated", with the recipient list named on the card so staff know who was told.
- Safe return: when a resident is marked returned, a confirmation entry is written to the audit trail listing who was notified, and the next-of-kin option is recorded against that entry.
- Recipients are shown on each alert card so staff can see at a glance who is responsible.

**Clearer screen**
- Save button explains what is unsaved; a short line under each section states the resulting behaviour in plain words, e.g. "Alert Nurse Lead 30 minutes after the expected return time".

## Notes on email sending

Recipient lists are configured and recorded, but no email is actually sent yet — the app has no email sending set up. The alerts appear in the app and audit trail. If you want real emails going out to those addresses, that's a follow-up step and I'll need your confirmation to add email sending.

## Technical detail

- `ReturnNotificationSettingsTab.tsx`: branch list optional, synthetic "All sites" entry backed by a `branch_id IS NULL` row; replace `AVAILABLE_STAFF` mock with a `staff_members` query.
- Migration: allow `branch_id` to be nullable on `branch_notification_settings` with a partial unique index on the null-branch row.
- New `useReturnNotificationPolicy` hook to read the effective policy (branch row, falling back to the all-sites row).
- `UrgentActions.tsx`: replace the `no_return_notification_enabled` lookup with the policy hook; apply grace and escalation windows to the overdue-resident filter.
- Resident return handlers (`MarkReturnDialog` / `checkInReturn` path): write a `return_notification_sent` audit entry with recipients and NOK flag when safe-return is enabled.
- `NotificationsTab.tsx`: remove the now-duplicated standalone switch.
