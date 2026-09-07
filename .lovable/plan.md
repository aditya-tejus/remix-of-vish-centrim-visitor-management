# Key expiry policy + printable key holder card

Two additions to the Keys Register, both built on what already exists (keys, issues, due-back dates, staff-only access).

## 1. Key expiry policy in Settings

A new "Keys" section in the Settings side menu (Global group) with:

- **Default loan period** — how long a key is out by default (e.g. 2 hours, end of day, 24 hours, 7 days, no default). Pre-fills the due-back date when a key is issued.
- **Grace period** — minutes/hours after the due time before a key counts as overdue (default 0).
- **Block check-in when someone holds an overdue key** — off by default. When on, a person who already has an overdue key cannot check in until the key is returned or renewed.
- **Warn only** option for sites that want the alert without stopping entry.
- **Who can renew** — any staff member, or admins only.

Every change to these settings writes to the audit trail, matching the existing settings governance rule.

### What blocking looks like

- Reception check-in and the kiosk both check whether the person arriving already holds an overdue key.
- In warn mode: an amber notice naming the key and how long it is overdue; staff can continue.
- In block mode: entry is stopped with a clear message and a staff override that requires a written reason (same override pattern already used for symptom blocking), recorded in the audit trail.
- Matching uses the linked visitor record where one exists, and falls back to a name match for repeat visitors who arrive as a new record. This fallback is name-based, so it is deliberately paired with a staff override rather than a hard dead end.

### Renew action

- In the Keys Register, every key that is out gets a **Renew** action next to Return.
- Renewing asks for a new due date (with the same quick choices: +2 hours, end of day, tomorrow, +7 days) and an optional reason.
- The key immediately drops out of the overdue list, the renewal appears in that key's history, and it is written to the audit trail with who renewed it and why.

## 2. Printable key holder card

A print action on each issued key (and offered right after a key is issued) that opens the browser print dialog with a small card showing:

- Key name, copy number and key type
- Resident and property/area the key belongs to
- Who is holding it and who issued it
- Date and time issued, and the due-back date in the site's 12-hour format
- A colour band matching the key status, and the key's short reference so the card can be matched back to the register

It uses the same print approach as visitor badges: a standard A4-centred card, plus the exact-size label layout for the Brother QL label printer already configured under Printing. Reprinting is always available from the register, and a print is noted in the key's history.

## Technical notes

- Settings live in the existing `settings` table as string values, using the current key naming style: `key_default_loan_period`, `key_overdue_grace_minutes`, `key_overdue_enforcement` (`off` | `warn` | `block`), `key_renew_role`.
- New `src/components/settings/KeysPolicyTab.tsx`, plus a `keys` entry in `SettingsNav.tsx` and `Settings.tsx`.
- New `src/hooks/useKeyPolicy.ts` reads the policy; `useKeys.ts` and `useOpenKeyIssues.ts` apply the grace period when computing `overdue`, and gain a `renewIssue()` call that updates `expected_return` on `key_issues`.
- Check-in enforcement hooks into `useCheckInFlow.ts` / `AddVisitDialog.tsx` and `useKioskCheckInFlow.ts` / `KioskCheckIn.tsx`, next to the existing contractor and symptom gates.
- New `src/lib/printKeyCard.ts` mirroring `printBadge.ts` (standard + Brother QL label layouts), reusing `getBadgeConfig()`.
- No schema change is required: renewals update the existing `expected_return` column, and renewal/print events are recorded in `audit_log` and the issue's notes.
