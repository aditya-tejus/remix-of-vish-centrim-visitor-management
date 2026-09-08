# Centrim Life integration boundary (Stage 1)

## Purpose
Visitor Management must not own residents, staff, properties, suppliers, documents,
notifications, audit or identity. Those belong to other Centrim Life modules. Stage 1
puts a typed boundary in front of all of them so the real services can be dropped in
without touching feature code.

- Contracts: `src/services/contracts/index.ts`
- Temporary implementations: `src/services/adapters/local/index.ts` (all named `LocalPrototype*`)
- Registry / swap point: `src/services/registry.ts` (`serviceProvenance` shows what is still local)

## Adapters and their replacement contract

| Contract | Temporary adapter reads | Replaced by | Required from Centrim Life |
|---|---|---|---|
| `SiteDirectoryService` | `branches`, `wings` | Properties/Sites module | Organisation → site → area tree with jurisdiction and site structure (RAC, retirement village, care home) |
| `ResidentDirectoryService` | `visitors` (type `resident`), `resident_details` | Residents/Clinical module | Resident identity + location; support/mobility/DoLS/emergency contacts as a separate, permissioned read |
| `StaffDirectoryService` | `staff_members` | Staff/HR module | Staff identity, department, site assignment, active status |
| `SupplierDirectoryService` | `suppliers_min`, `contractor_people`, credential tables | Supplier/contractor compliance module | Supplier record, worker identity, and an outstanding-checks decision (never raw documents to a kiosk) |
| `DocumentService` | Supabase storage bucket `contractor-documents` | Files/Documents service | Upload + short-lived signed URL, retention aware |
| `NotificationService` | none — records intent in `audit_log`, returns `false` | Notifications service | Email/SMS/in-app delivery with per-event recipients. **Blocker: no delivery channel exists today; nothing is actually sent.** |
| `AuditService` | `audit_log` | Shared audit service | Append-only events with actor, site, reason |
| `PermissionService` | `user_roles`, `user_site_access` | Platform auth | User identity, role, and the sites they may access |

Nothing in this table should be treated as the final source of truth. The local tables
remain only so the prototype stays usable during review.

## Tenancy model
- `organisations` → `branches` (site) → `wings` (area: wing for RAC/care homes, stage for villages).
- Operational records carry `branch_id`: visitors, resident details, staff, suppliers,
  contractor people, keys, food register, watchlist, leave requests, incidents, evacuation records.
- `user_site_access` lists which sites a signed-in user may see; admins see all.
- `SiteProvider` (`src/contexts/SiteContext.tsx`) holds the current site for staff screens.

## Legacy data strategy (non-destructive)
- A generic legacy organisation and a legacy placeholder site were created.
- Every pre-existing row with a null site was assigned to that placeholder site. No rows
  were deleted or rewritten beyond filling the site reference.
- The placeholder site is flagged (`is_legacy_placeholder`) so it can be split into real
  sites later, and `SiteContext` exposes `isLegacySite`.
- Old tables remain; `people` / `visits` / `visit_parties` are the forward model and a
  compatibility view keeps existing screens working until they are migrated.

## Kiosk data boundary
The kiosk is unauthenticated and can no longer read sensitive tables. It uses narrow
server functions only:

`kiosk_resident_directory`, `kiosk_staff_directory`, `kiosk_presence_list`,
`kiosk_check_out`, `kiosk_resident_leave`, `kiosk_resident_return`,
`kiosk_watchlist_check`, `kiosk_supplier_directory`, `kiosk_contractor_lookup`.

Each returns the minimum fields needed. The kiosk cannot read visitor history, resident
clinical/support data, contractor credential documents, or emergency records.

Known Stage 2 follow-ups:
- Contractor credential detail cards are staff-only; the kiosk sees outstanding-check
  names via `kiosk_contractor_lookup` and must be reworked to use that decision alone.
- Kiosk visitor creation still writes to `visitors` under a narrow insert policy and
  should move behind a dedicated `kiosk_check_in` function.
- Kiosk evacuation access is PIN gated in the UI but still reads through the same hooks.

## Settings scope
`settings_scoped` + `resolve_setting` support jurisdiction, organisation, site, area,
person type and role, with the flat `settings` table as final fallback. Helpers live in
`src/lib/settingsScope.ts`. No new toggles were added in Stage 1.
