# Roadmap

## Stage 0 — Audit baseline
- [x] Full audit of routes, data, mocks, settings scope, risks (report delivered in chat)

## Stage 1 — Shared contract and safe foundation (in progress)
- [ ] A. Site/tenancy foundation: organisations, sites (reuse `branches`), areas (reuse `wings`), site_id on operational tables, legacy/unassigned backfill, current-site context for staff
- [ ] B. Shared-module boundary: typed service interfaces + explicitly named temporary local adapters (residents, staff/roles, properties/areas, suppliers/contractor people, documents, notifications, audit, auth/permissions)
- [ ] C. Domain boundary: `people` identity vs `visits`, visit parties for companions/groups, stable IDs for site/person type/visit status/destination; compatibility layer over `visitors`
- [ ] D. Access control and kiosk safety: remove broad anonymous policies, narrow kiosk RPCs, authenticated staff writes, site scope enforced in policies, replace unsalted MD5 kiosk PIN with salted hash
- [ ] E. Settings scope: typed settings model with jurisdiction/org/site/area/person-type/role scope + inheritance helpers
- [ ] F. Audit and verification: audit events for config/security changes, typecheck/lint/build, access tests, report residual linter warnings

## Constraints for Stage 1
- No visual redesign, no new features, no destructive drops, no irreversible migration, no hardcoded customer/site/user identifiers.
