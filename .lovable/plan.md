
# Centrim Life Presence Engine — Implementation Plan

## Phase 1: Foundation & Navigation ✅ IN PROGRESS

### Completed
- [x] **Home Workbench page** — 3 big action buttons (Check-In, Check-Out, Resident Leave), summary cards, pinned Active Now list, day-grouped history
- [x] **Updated routing** — Home Workbench is now `/` (landing page), sidebar updated with Home link + Leave Requests
- [x] **Volunteer person type** — added to `VisitorType` union

### Remaining Phase 1
- [ ] **Kiosk mode** — new `/kiosk` route with 3 large tiles, one-question-per-screen flow, full-screen photo/signature capture

---

## Phase 2: Contractor & Screening
- [ ] Contractor flow overhaul (supplier autocomplete, AU/UK screening templates)
- [ ] Jurisdiction toggle (AU/UK) in settings

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

## Database Changes Needed
- [ ] `suppliers_min` table
- [x] `volunteer` added to visitor type
- [ ] `jurisdiction` column/table
- [ ] `change_reason` column on `audit_log`
- [ ] `signature_url` column on `visitors`
