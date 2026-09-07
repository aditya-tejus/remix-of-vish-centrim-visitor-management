# Wings, label printing, outbreak visibility, food register privacy

## 1. Assign real wings to residents

There are currently no wings at all, and all 8 residents have no wing set — that is why the evacuation roll call groups everyone as "Unassigned wing".

Create three wings and assign each resident by room number:

- Rose Wing — rooms 1-9 (Patricia Wilson 3, Dorothy Brown 6, Robert Davis 8, Betty Clark 9)
- Garden Wing — rooms 10-19 (Mary Johnson 12, George Thompson 15, Harold Lewis 18)
- Lakeside Wing — rooms 20+ (Frank Harris 21)

Names, colours and floors stay editable in Residents settings afterwards. New residents added later still need a wing chosen when created — the resident form already offers it.

## 2. Brother QL label printing

Browsers cannot talk to a Brother QL printer directly, so this is done in two parts:

- A dedicated 62 mm x 100 mm label layout matching the current badge design (name, colour-coded type strip, date, who they are visiting), rendered at exact label dimensions with the correct print margins so it comes out right when the QL is the selected printer in the print dialog.
- A new "Label printer" section in Settings > Printing: printer mode (Standard printer / Brother QL label), label size (62x100 mm, 62x29 mm), and a "Print test label" button. When Brother QL mode is on, every badge print uses the label layout and page size instead of the A4-style card.

Note on limits: a fully driverless integration (silent printing with no dialog) needs a small local print agent installed on the reception PC — not something the web app can do alone. The plan above gets correct label output through the QL driver via the print dialog; if you later want silent printing I can add an agent endpoint setting that posts the label to a local service.

## 3. Outbreak Mode visibility

- Header: a clear Outbreak Mode pill next to the occupancy chip, shown in red when on, with an admin-only click-through to toggle it off/on (staff see it read-only). Hidden entirely when off to avoid noise.
- Dashboard (Home workbench): when Outbreak Mode is on, a banner explaining that check-ins are blocked on any symptom or high temperature, plus the live occupancy warning card showing current on-site count against the configured maximum, coloured amber near the limit and red at it.

## 4. Food Register privacy and retention

- A privacy notice on the food registration step (both kiosk and staff check-in) and at the top of the Food Register page, following the existing privacy-notice style: why the record is kept (resident safety and food-related incident investigation), what is captured, lawful basis by jurisdiction (UK GDPR legitimate interests / Australian Privacy Principles), retention period, and how to request access or deletion.
- Food records follow the existing visitor retention period, as chosen. The cleanup job will delete food records older than `retention_period_days_visitor`, and records attached to a visitor under legal hold are exempt, same as visitor records. The Data Retention settings page will state plainly that food records follow the visitor period.

## Technical notes

- Data change: insert three rows into `wings`, then update `resident_details.wing_id` by room number. No schema change needed — `wing_id` already exists and `useResidents` already resolves the wing name through the relationship.
- New settings keys: `label_printer_mode`, `label_size`. Existing `badge_printing_enabled` and `outbreak_mode` are reused.
- `src/lib/printBadge.ts` gains a label variant with `@page { size: 62mm 100mm; margin: 2mm }` and a compact layout; callers pass the configured mode.
- Header toggle lives in `AppHeader.tsx` writing the `outbreak_mode` setting, guarded by the admin role and written through the existing settings save path with an audit-log entry.
- Food retention added to `supabase/functions/cleanup-visitors/index.ts`, joining `food_register` to `visitors` to honour `legal_hold`.

Not included: the staff dashboard item, and any silent/driverless label printing.
