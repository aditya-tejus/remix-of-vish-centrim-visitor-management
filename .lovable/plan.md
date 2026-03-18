
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
- [x] `ContractorScreening` component with AU/UK templates
- [x] Contractor check-in flow integrated into AddVisitDialog
- [x] Jurisdiction toggle (AU/UK) in Settings → Presence tab
- [x] Jurisdiction loaded from DB and used by contractor screening

## Phase 3: Resident Leave Separation ✅ DONE
- [x] Separate Resident Leave module
- [x] Ensure visitor check-in never prompts resident leave

## Phase 4: Settings & Governance (in progress)
- [x] Expand Settings tabs (Presence, Screening, T&C, Alerts, Automation, Printing, Profiles & Badges, Resident Leave, Returns, GDPR, Integration, Audit, Feedback, Lock & Governance)
- [ ] Settings governance (change reason, audit log, admin override, transactional audit)
- [ ] Badge printing settings (Brother QL, failure-tolerant)

---

## Phase 5: Database Foundation — Replace Mock Data & Extend Schema
- [ ] Create `staff_members` table (name, role, phone, email, is_active, branch_id)
- [ ] Extend `resident_details` with: `mobility_level`, `dols_lps_flag`, `risk_assessment_level`, `medication_notes`, `mobility_aids`, `destination_categories`
- [ ] Add columns to `visitors`: `group_id` (uuid), `work_type` (text), `work_location` (text), `print_status` (text), `qr_code` (text), `visit_purpose` (text), `visited_resident_ids` (uuid[]), `safeguarding_hold` (boolean)
- [ ] Add `change_reason` (text) to `audit_log`
- [ ] Add `wwcc_number`, `wwcc_expiry`, `police_check_date`, `dbs_number`, `dbs_expiry`, `lone_working_declaration` (boolean) to `contractor_screening` jsonb or as columns on visitors
- [ ] Replace all `mockResidents` arrays with queries to `visitors` WHERE `type='resident'` + `resident_details`
- [ ] Replace all `mockStaff` arrays with queries to `staff_members` table
- [ ] Wire resident photos into visit target selection UI

## Phase 6: Staff Desktop — Batch 1 (Enhance Existing Screens 1, 3, 6, 8, 10)

### Screen 1 — Home Workbench enhancements
- [ ] Search bar (name/resident/company) filtering Active Now + History
- [ ] Exceptions rail: Overdue Residents, Print Failures, Screening WARN, Auto-checkouts
- [ ] Fixed Emergency button top-right
- [ ] Inline Reprint + status tags (ACTIVE/WARN/AUTO) on ActiveNowList rows

### Screen 3 — Visitor Check-In polish
- [ ] Visit purpose categories (Social, Professional, Delivery, Maintenance, Inspection/Audit)
- [ ] Multi-resident visit support (multi-select whom_to_visit linked to resident records)
- [ ] Professional visitors auto-tagged as "clinical visit" (different retention rules)
- [ ] Terms acceptance checkbox + "View Terms" modal
- [ ] Conditional Photo/Signature step (reads from settings)
- [ ] Success state with print queued indicator

### Screen 6 — Contractor Check-In polish
- [ ] Work type button group (Maintenance, Cleaning, IT, Medical, Building, Other)
- [ ] Work location optional dropdown
- [ ] AU: WWCC verification field + Police check / National Criminal History Check capture
- [ ] UK: DBS certificate number + expiry capture (not just yes/no)
- [ ] UK: Lone working declaration (if unsupervised in resident areas)
- [ ] Contractor-specific terms acceptance

### Screen 8 — Check-Out enhancement
- [ ] Person type tile selector before checkout list
- [ ] Search within checkout list

### Screen 10 — Resident Leave page overhaul
- [ ] New page `/resident-leave` with 3 tabs: Away Now, Mark Away, Mark Returned
- [ ] Away Now: table with overdue highlighting, actions (Mark Returned, Edit Expected Return)
- [ ] Mark Away: resident select + form with destination categories (Home visit, Medical appointment, Day trip, Hospital, Other) — not free text
- [ ] Leave exceeding 24h triggers different workflow (social leave vs medical leave vs hospital transfer)
- [ ] Expected return overdue → automatic escalation to manager + next of kin
- [ ] UK: DoLS/LPS flag check — if resident lacks capacity, require authoriser name before leave proceeds
- [ ] AU: Medication dispensed indicator for outing period
- [ ] AU: Mobility aids noted (wheelchair, walker)
- [ ] Mark Returned: quick action

## Phase 7: Staff Desktop — Batch 2 (New Screens 2, 4, 5, 7, 9, 15-17)
- [ ] Screen 2: Person Type Selector tiles (Visitor, Contractor, Volunteer, Other; Visitor has "QR Fast Lane" sub-option)
- [ ] Screen 4: Group Check-In (multi-row, batch print, post-confirm summary)
- [ ] Screen 5: QR Fast Lane — scan → resolve → select target → screening → terms → confirm; duplicate scan = already checked in → checkout prompt
- [ ] Screen 7: Volunteer Check-In (minimal fields + optional screening/terms)
- [ ] Screen 9: Group Checkout prompt ("Check out whole group?" → Whole group / Just this person / Cancel)
- [ ] Screen 15: Evacuation Report (snapshot history from `evacuation_drills`)
- [ ] Screen 16: Presence Log (filterable by date, type, company, work type, method, risk; export with permission gating)
- [ ] Screen 17: Visit Trends (counts per day/week by person type, using recharts)

## Phase 8: Safeguarding & Compliance
- [ ] **Watchlist enforcement during check-in**: When visitor name matches `visitor_watchlist`, block and alert staff with instructions
- [ ] **Banned visitor hard-block**: `alert_type = "banned"` entries must prevent check-in entirely (not just warn)
- [ ] AU: Influenza vaccination status check (mandatory during flu season)
- [ ] AU vs UK privacy notice separation (APP notice vs GDPR notice — currently uses GDPR language for both)
- [ ] UK: Lawful basis varies by visit type (legitimate interest for social, legal obligation for contractors, vital interests for emergency)
- [ ] UK: Right to erasure must exclude safeguarding-held records (`safeguarding_hold` flag)
- [ ] UK: Data minimisation — kiosk/public check-in should not collect address for social visitors
- [ ] AU: Configurable retention per data type (visitor vs contractor vs clinical visit) — currently hardcoded 60 days

## Phase 9: Notifications & Escalation
- [ ] Resident return overdue notification — email/SMS to manager + next of kin after configurable delay
- [ ] Contractor overstay notification — alert if contractor exceeds expected duration
- [ ] Visitor time limit warning — configurable per outbreak mode (e.g. 2-hour limit)
- [ ] Night-time check-in alert — check-in outside normal hours pings duty manager
- [ ] Failed screening alert — if any health question answered "yes", notify infection control lead immediately

## Phase 10: Kiosk Mode (Screens 30-36)
- [ ] KioskLayout component (no sidebar, touch-first, 48px targets, large text)
- [ ] Screen 30: Kiosk Home tiles (Check-In, Check-Out, Resident Leave if enabled)
- [ ] Screen 31: Kiosk Check-In person type tiles
- [ ] Screen 32: Kiosk Visitor Check-In (1 question per screen, large buttons)
- [ ] Screen 33: Kiosk QR Fast Lane
- [ ] Screen 34: Kiosk Contractor Check-In (step-by-step)
- [ ] Screen 35: Kiosk Check-Out (QR scan preferred, fallback name search)
- [ ] Screen 36: Kiosk Resident Leave Option C (Leaving/Returning tiles → Room entry → resident list → confirm → destination chips)

## Phase 11: UX States & Polish
- [ ] Loading state (skeleton placeholders) on all screens
- [ ] Empty state (illustration + message + CTA) on all screens
- [ ] Error state (alert + retry) on all screens
- [ ] Permission denied state (lock icon + "Contact admin") where applicable
- [ ] Returning visitor shortcut ("Recent visitors" quick-select for staff)
- [ ] Resident photo on visit target selection
- [ ] Large text mode toggle (accessibility for older receptionists)
- [ ] Offline mode (queue check-ins locally, sync when online — AU rural facilities)
- [ ] Shift handover report (auto-generate who's on site, who left, upcoming returns)
- [ ] Touch target audit (44-48px)
- [ ] Font size audit (names 16-18px, body 13-14px)

## Phase 12: Coverage Checklist
- [ ] Coverage Checklist page (`/coverage`) listing all 36+ screens with status and links

## Database Changes Summary
- [x] `suppliers_min` table
- [x] `volunteer` added to visitor type
- [x] `signature_url` on visitors
- [x] `supplier_id` on visitors
- [x] `contractor_screening` jsonb on visitors
- [x] Jurisdiction via settings table
- [ ] `staff_members` table (new)
- [ ] `resident_details` extended (mobility_level, dols_lps_flag, risk_assessment_level, medication_notes, mobility_aids)
- [ ] `visitors` extended (group_id, work_type, work_location, print_status, qr_code, visit_purpose, visited_resident_ids, safeguarding_hold)
- [ ] `audit_log` extended (change_reason)
- [ ] Contractor compliance fields (wwcc, dbs, police check, lone working)
