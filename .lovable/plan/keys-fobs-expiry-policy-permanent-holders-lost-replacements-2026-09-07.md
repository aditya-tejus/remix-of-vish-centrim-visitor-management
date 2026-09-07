# Keys & fobs: expiry policy, permanent holders, lost replacements, printable holder card

Everything below builds on the existing Keys Register (keys, issues, due-back dates, staff-only access).

## 0. Keys, fobs and cards

The register already supports an "Access fob" type; wording and options get widened so it clearly covers non-key items: front door, mailbox, garage/shed, **access fob**, **swipe card**, master key, other. Labels across the page, filters and print become "Keys & fobs" so staff aren't confused when adding a fob. No separate register.

## 1. Expiry policy in Settings

A new "Keys & fobs" section in the Settings side menu (Global group):

- **Default loan period** — pre-fills the due-back time when something is issued (2 hours, end of day, 24 hours, 7 days, or none).
- **Grace period** — how long after the due time before it counts as overdue (default 0).
- **When someone holds an overdue key** — off / warn at check-in / block check-in.
- **Who can renew** — any staff member, or admins only.
- **Permanent holdings** — whether permanent issues are allowed, and an optional yearly review reminder for them.

Changes write to the audit trail, per the existing settings governance rule.

### Blocking at check-in

- Reception check-in and the kiosk check whether the arriving person already holds something overdue.
- Warn mode: an amber notice naming the item and how overdue it is; staff can continue.
- Block mode: entry stops with a clear message plus a staff override that requires a written reason (same pattern as the symptom block), recorded in the audit trail.
- Matching uses the linked visitor record where one exists, falling back to a name match for repeat visitors arriving as a new record — which is why the override exists.
- Permanent holdings are never overdue and never block anyone.

### Renew action

Each item that is out gets **Renew** beside Return: pick a new due time (+2 hours, end of day, tomorrow, +7 days, or make permanent), add an optional reason. It leaves the overdue list immediately, shows in that item's history, and is written to the audit trail.

## 2. Permanent keys for residents

- When issuing, staff can choose **Permanent (resident's own key)** instead of a due-back time.
- These show as "Held permanently — {resident}" in a soft neutral colour rather than the blue "issued out" or red "overdue" states, and are excluded from the "Keys out right now" and overdue counts.
- A separate summary tile, "Permanently with residents", and a filter for them.
- Return still works normally (e.g. when a resident moves out or the fob is deactivated).

## 3. Lost keys and automatic replacement copies

- Marking an item **Lost** asks for a short note and, by default, offers **Issue a replacement**.
- Choosing that creates a new record for the same property/resident and type, automatically numbered as the next copy (if copies 1–3 exist, the replacement becomes copy 4), starting as available in the cabinet.
- The lost record stays on file as "Lost", greyed out, still searchable, and its history notes which copy replaced it — so audits still see the full trail.
- If the lost item was out with someone, that issue is closed as "not returned — lost".

## 4. Printable holder card

A print action on each issued item (and offered right after issuing) opens the browser print dialog with a small card showing:

- Item name, copy number and type (key, fob, card)
- Resident and property/area it belongs to
- Who is holding it, who issued it, and when
- Due-back date in the site's 12-hour format, or "Permanent"
- A colour band matching the status and the item's short reference

Same print approach as visitor badges: an A4-centred card plus the exact-size Brother QL label layout already configured under Printing. Reprints are always available from the register and are noted in the item's history.

## Technical notes

- Settings stored in `settings` as strings: `key_default_loan_period`, `key_overdue_grace_minutes`, `key_overdue_enforcement` (`off` | `warn` | `block`), `key_renew_role`, `key_permanent_allowed`.
- Migration on `key_issues`: add `is_permanent boolean not null default false`. Migration on `property_keys`: add `lost_at timestamptz`, `lost_notes text`, `replaced_by_key_id uuid` (self reference) so the lost-to-replacement trail is queryable. Existing `status` already carries `lost` / `retired`.
- Replacement copy number is derived as `max(copy_number) + 1` for the same property/resident + key type.
- `useKeys.ts` / `useOpenKeyIssues.ts`: apply grace period to `overdue`, ignore permanent issues, add `renewIssue()`, `markLost({ replace })`.
- New `src/components/settings/KeysPolicyTab.tsx` plus a `keys` entry in `SettingsNav.tsx` and `Settings.tsx`; new `src/hooks/useKeyPolicy.ts`.
- Check-in enforcement added beside the existing contractor/symptom gates in `useCheckInFlow.ts` / `AddVisitDialog.tsx` and `useKioskCheckInFlow.ts` / `KioskCheckIn.tsx`.
- New `src/lib/printKeyCard.ts` mirroring `printBadge.ts`, reusing `getBadgeConfig()`.
- Renewals, lost marks, overrides and prints are recorded in `audit_log`.
