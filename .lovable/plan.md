# Phase 7E — Settings consolidation and configuration previews

Baseline confirmed: latest commit `e78488e72c599e8670487ec6df3d10d1de86c849` ("Implemented Phase 7D"). No database, permission or settings-value changes in this phase.

## What we found (verified in the current code)

- Settings live on one page (`/settings`) with a grouped left nav of 15 sections. That structure is sound and stays.
- Ten settings screens exist in the project but are not reachable from anywhere: Alerts, Automation, Health screening, Auto checkout, Feedback settings, Profiles & badges, Terms & conditions, Notifications, Leave approval, Site documents. Each duplicates a per-visitor-type screen that *is* reachable. This is the main source of "duplicate settings".
- Scope inheritance helpers (`src/lib/settingsScope.ts`, the scoped settings table and the resolve function) are written but no screen or hook uses them. Every visible setting is written flat, most with a site suffix in the key. So the scope badges shown today ("This site", "Organisation") are labels only — they do not describe where the saved value actually lives.
- Only two cards check permissions (permission matrix, privacy & retention). Every other settings screen lets any signed-in staff member save.
- Only a few screens write an audit entry (keys policy, kiosk PIN, privacy). Most saves leave no trace.
- Terminology already comes from operating-context packs, and icons are professional Lucide icons throughout — no emojis found.
- There are no previews anywhere: an administrator cannot see what the kiosk, a badge or the check-in questions will look like before saving.

## Goal

A site manager can open Settings, understand what each decision does, who may change it, where it applies, and see the result before saving — without a second settings system being introduced.

## 1. Information architecture and de-duplication

Keep the existing nav groups. Changes:

- Delete the ten unreachable screens listed above, after confirming each has a live equivalent. Where an orphan holds a control the live screen lacks (site documents, leave approval), fold that control into the live screen rather than deleting it.
- One home per decision. A short "Where else this appears" line links related screens instead of repeating the control.
- Each section gets a one-line purpose statement in plain language at the top.

## 2. Scope, inheritance and honesty about it

- Reuse the existing `SettingsScopeBadge`, but only show a scope badge where the value is genuinely stored at that level.
- Add a small shared `SettingRow` wrapper that shows, per setting: current value, where it came from (Inherited from organisation / Set for this site), and a "Reset to inherited" action when an override exists.
- Where a setting is stored flat today (no real inheritance), the badge reads "This site" and no inherited value is claimed. No migration of stored values in this phase.

## 3. Who can change what

- Introduce a single read-only/edit gate across settings using the existing `usePermissions` hook and existing permissions — no new permissions.
- Without permission: controls disabled, values still visible, one clear line explaining who can change it and how to request it. No hidden pages.
- Each section header states the role that may change it.

## 4. Effects, and 5. historical data

- Extend the existing `SettingExplainer` (already used on two screens) to every section: Controls / Applies to / Changed by / Current / Kiosk / Staff screens / Past records.
- Every explainer states plainly that records already saved do not change. Where a change does affect existing behaviour (retention windows, overdue thresholds recalculating), say so specifically instead of the generic line.

## 6. Terminology

All labels read from the operating-context pack: wing/room (AU residential aged care), stage/villa/property (AU retirement village), unit/room (UK care home). No hardcoded "resident room" or "wing" strings in settings copy.

## 7. Policy wording

Privacy, retention, screening and credential screens describe what the software does — "records are removed after this many days", "the kiosk will refuse check-in when a document is missing". No statement that a configuration makes the site compliant with any Act, standard or regulation. A standing note: settings support your process, they do not certify it.

## 8. Configuration previews

Four read-only previews, each rendered from the same data the live surfaces use:

- **Kiosk preview** — a scaled, non-interactive rendering of the kiosk welcome and check-in steps for the selected person type, showing exactly the questions, terms and fields configured.
- **Badge preview** — the existing badge markup rendered with sample data, respecting the badge/privacy toggles.
- **Person types preview** — the tile row a visitor sees, with the configured labels and hidden types omitted.
- **Screening preview** — the question list in kiosk order, showing which answers block entry and which only warn.

Previews use clearly marked sample data, never real people, and update as toggles change before saving.

## 9. Safe defaults and reset

- Every setting shows its default. "Reset to default" per setting and per section, always with a confirmation naming what will change.
- No destructive reset across all sections.

## 10. States

Permission denied, unsaved changes (with a leave-page guard), inline validation before save, save failure with retry, and a saved confirmation. Loading skeletons for sections that read the database.

## 11–13. Dead settings, integrations, accessibility

- Remove or wire up any control that writes a key nothing reads; list any left in place with the reason.
- Integrations screen stays a described boundary only: what would connect, what is not connected. No external calls, credentials or notification delivery added.
- Keyboard reachable, labelled controls, visible focus, AA contrast, labelled Lucide icons, no emojis.

## 14. Files expected to change

- `src/pages/Settings.tsx` — permission gate, unsaved-changes guard, preview panel slot.
- `src/components/settings/SettingsNav.tsx` — group/section trim after de-duplication.
- New: `SettingRow.tsx`, `SettingsSectionHeader.tsx`, `preview/KioskPreview.tsx`, `preview/BadgePreview.tsx`, `preview/PersonTypesPreview.tsx`, `preview/ScreeningPreview.tsx`.
- `SettingExplainer.tsx` — extended and applied across sections.
- Deletions: the ten unreachable settings components (with any unique control folded in first).
- New hook `useSettingsAccess` wrapping the existing permission check; optional `useSettingScope` read-only helper over the existing `resolveSetting`.
- Docs: `roadmap.md`, `docs/SECURITY_REVIEW.md`.

## 15. Data, RLS and audit

- No migration, no schema change, no policy change, no permission change, no settings-value change.
- Settings reads and writes stay site-scoped exactly as they are today.
- Audit gap is documented, not silently widened: this phase makes the missing audit entries visible in the security notes and adds audit writes only where an existing helper already exists. Broadening audit coverage is proposed as Phase 7F work.

## 16. Acceptance tests

1. Every nav section opens; no route or component is unreachable; no control appears twice.
2. A user without settings permission sees values, disabled controls and a clear explanation.
3. Changing a person type's questions updates the screening and kiosk previews before saving.
4. Badge preview matches an actual printed badge for the same settings.
5. Reset to default restores the documented default and asks for confirmation.
6. Navigating away with unsaved changes warns.
7. Save failure shows an error and keeps the entered values.
8. Terminology switches correctly between the AU aged-care, AU retirement-village and UK care-home sites.
9. Reception, kiosk, badges, emergency, food and contractor behaviour unchanged (Phase 7A–7D regression).
10. Typecheck, build, and security linter unchanged at the documented 47 warnings.

Rollback: all work is presentation-layer; reverting the commit restores current settings exactly, since no stored value or schema changes.

## Non-goals

No second settings system, no new settings keys, no migration of flat values into the scoped table, no external integrations or notification delivery, no new permissions, no printer hardware, no Phase 7F.

## Risks

- Deleting the ten orphan screens could remove a control someone expects; mitigated by folding unique controls into the live screen first and listing every deletion.
- Kiosk preview can drift from the real kiosk if it re-implements layout; it must reuse the kiosk components in a disabled state.
- Scope badges will remain partly aspirational until stored values move to the scoped table — stated openly rather than implied.

## Open questions

1. The ten unreachable screens — delete them, or is any of them a deliberately parked feature you want kept?
2. Should the settings edit gate use the existing `settings.administer` permission for everything, or keep privacy and permissions on their own narrower permissions as today?
3. Do you want the flat settings values actually migrated into the scoped inheritance table in a later phase, or is site-level storage sufficient for the pilot?
