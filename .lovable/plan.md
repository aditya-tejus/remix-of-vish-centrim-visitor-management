
# Centrim Life Presence Engine — Implementation Plan

## Phase 1: Foundation & Navigation ✅ DONE
- [x] Home Workbench page (3 action buttons, summary cards, Active Now list, day-grouped history)
- [x] Updated routing (Home = `/`, sidebar with Home link)
- [x] Volunteer person type added

### Remaining Phase 1
- [ ] Kiosk mode (`/kiosk` route)

## Phase 2: Contractor & Screening ✅ DONE
- [x] `suppliers_min` table created with seed data (6 AU + 2 UK suppliers)
- [x] `signature_url`, `supplier_id`, `contractor_screening` columns added to visitors
- [x] Supplier autocomplete hook (`useSuppliers`)
- [x] `ContractorScreening` component with AU (SWMS/PPE/permits/insurance/induction/infection) and UK (RAMS/DBS/CSCS/safeguarding/infection) templates
- [x] Contractor check-in flow integrated into AddVisitDialog (step 3 shows screening instead of health questions)
- [x] Jurisdiction toggle (AU/UK) in Settings → Presence tab
- [x] Jurisdiction loaded from DB and used by contractor screening

## Phase 3: Resident Leave Separation
- [ ] Separate Resident Leave module (Option C: Room → short list → confirm)
- [ ] Ensure visitor check-in never prompts resident leave

## Phase 4: Settings & Governance
- [ ] Expand Settings tabs (Presence, T&C, Alerts, Automation, Printing, Profiles & Badges, Resident Leave, Lock & Governance)
- [ ] Settings governance (change reason, audit log, admin override, transactional audit)
- [ ] Badge printing settings (Brother QL, failure-tolerant)

## Phase 5: GDPR & Compliance
- [ ] UK GDPR mode enhancements (DPO role gating, minimisation, retention/anonymise)
- [ ] Photo + signature (optional, configurable per type, OFF by default for UK)

## Phase 6: Reports & Coverage
- [ ] Evacuation snapshot history
- [ ] Coverage Checklist page

## Phase 7: Polish
- [ ] Touch target audit (44-48px)
- [ ] Font size audit (names 16-18px, body 13-14px)
- [ ] Edge states and validation messages

## Database Changes
- [x] `suppliers_min` table
- [x] `volunteer` added to visitor type
- [x] `signature_url` on visitors
- [x] `supplier_id` on visitors
- [x] `contractor_screening` jsonb on visitors
- [x] Jurisdiction via settings table
- [ ] `change_reason` column on `audit_log`
