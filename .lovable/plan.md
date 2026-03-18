

# Centrim Life Presence Engine — Gap Analysis and Improvement Plan

## Specification Absorbed

I've reviewed the full spec and the current codebase. Here is a structured gap analysis mapping the spec requirements against what exists today, followed by a phased implementation plan.

---

## Current State vs Spec — Key Gaps

### 1. Navigation & Landing Screen
| Spec | Current | Gap |
|------|---------|-----|
| Home Workbench with 3 big action buttons (Check-In, Check-Out, Resident Leave) | Visit List page is the landing; no workbench | **Major** — need new Home Workbench page |
| Kiosk mode with 3 tiles | Public Check-In exists but is basic | **Major** — need full kiosk mode |
| Active Now list pinned on Home Workbench | Not present | **Major** |
| History grouped by day with date cards | Date navigator exists on Visit List | Partial |

### 2. Person Types
| Spec | Current | Gap |
|------|---------|-----|
| Visitor (single + group) | Exists | OK |
| Contractor (with supplier autocomplete, SWMS/RAMS, PPE, permits) | Basic contractor type exists, no supplier list or AU/UK screening | **Major** |
| Volunteer | Not in person types | **Missing** |
| Resident Leave (separate module) | Exists via AddVisitDialog resident flow + Leave Requests page | Partial — not cleanly separated |
| Optional "Other" (hidden unless enabled) | Not present | Minor |

### 3. Screening & Check-In Flow
| Spec | Current | Gap |
|------|---------|-----|
| Mixed field types, staff sees compact panel | Health questions exist per type | Partial |
| Kiosk shows one question per screen | Not implemented | **Major** |
| Visitor check-in must NOT prompt resident leave | Currently resident is a type in AddVisitDialog | Needs separation |
| Photo + signature optional end-of-flow steps, configurable per type | Camera capture exists, no signature | **Missing signature** |
| Photo/signature OFF by default for UK visitors | No jurisdiction awareness | **Missing** |

### 4. Printing
| Spec | Current | Gap |
|------|---------|-----|
| Brother QL badge printing | Handover print dialog exists | **No badge printing** |
| Failures must not block check-in; toast + reprint | Not implemented | **Missing** |

### 5. Settings & Governance
| Spec | Current | Gap |
|------|---------|-----|
| Required sections: Presence, Screening, T&C, Alerts, Automation, Printing, Profiles & Badges, Resident Leave, GDPR, Audit Log, Lock & Governance | Current: GDPR, Forms, Returns, Integration, Audit Trail, Feedback | **Many sections missing** |
| Every change requires change reason + audit log | Not implemented | **Major** |
| Locked sections need admin override reason | Not implemented | **Major** |
| Audit log write failure blocks settings change | Not implemented | **Major** |

### 6. UK GDPR Mode
| Spec | Current | Gap |
|------|---------|-----|
| Minimisation defaults ON | GDPR page exists | Partial |
| DSAR tools visible only to UK DPO role | SAR dialog exists but no role gating | **Missing** |
| Retention/anonymise controls | Some retention UI exists | Partial |

### 7. Reports
| Spec | Current | Gap |
|------|---------|-----|
| Evacuation Report (snapshot history) | Evacuation page exists with drills | Partial — no snapshot history export |
| Presence Log (filterable) | Visit List has filtering | Partial |
| Visit Trends | Reports page has charts | OK |

### 8. Resident Leave Self-Service
| Spec | Current | Gap |
|------|---------|-----|
| Option C (NO PIN): Room/Unit → short list → confirm | Current flow uses AddVisitDialog wizard | **Needs rework** |
| Global resident name search OFF by default | Not configurable | **Missing** |

### 9. Other Missing Items
- **Coverage Checklist page** — not present
- **Jurisdiction awareness (AU/UK)** — not present
- **Touch targets 44-48px** — not audited
- **Supplier autocomplete for contractors** — not present
- **Volunteer type** — not present

---

## Phased Implementation Plan

### Phase 1: Foundation & Navigation (3 tasks)
1. **Create Home Workbench page** — 3 big action buttons (Check-In, Check-Out, Resident Leave), pinned Active Now list, day-grouped history
2. **Add Kiosk mode** — new `/kiosk` route with 3 large tiles, one-question-per-screen flow, full-screen photo/signature capture
3. **Add Volunteer person type** — add to `VisitorType`, form fields, screening config

### Phase 2: Contractor & Screening (2 tasks)
4. **Contractor flow overhaul** — `suppliers_min` table or static list, supplier autocomplete, AU/UK screening templates (SWMS/RAMS, PPE, permits, insurance, infection/safeguarding)
5. **Jurisdiction toggle (AU/UK)** — settings flag that controls screening templates, GDPR defaults, photo/signature defaults

### Phase 3: Resident Leave Separation (2 tasks)
6. **Separate Resident Leave module** — remove resident from AddVisitDialog, create standalone Resident Leave flow (Option C: Room → short list → confirm), configurable name search
7. **Ensure visitor check-in never prompts resident leave**

### Phase 4: Settings & Governance (3 tasks)
8. **Expand Settings tabs** — add missing sections: Presence, Terms & Conditions, Alerts (overdue recipients), Automation (auto-checkout), Printing, Profiles & Badges, Resident Leave config, Lock & Governance
9. **Settings governance** — change reason modal on every save, audit log write, admin override for locked sections, transactional audit (fail = rollback)
10. **Badge printing settings** — Brother QL config, print-on-check-in toggle, failure-tolerant flow with toast + reprint

### Phase 5: GDPR & Compliance (2 tasks)
11. **UK GDPR mode enhancements** — DPO role gating for DSAR tools, minimisation defaults, retention/anonymise controls
12. **Photo + signature** — optional end-of-flow steps configurable per person type, OFF by default for UK

### Phase 6: Reports & Coverage (2 tasks)
13. **Evacuation snapshot history** — save/export drill snapshots
14. **Coverage Checklist page** — `/coverage` route listing every spec requirement with implemented/pending status

### Phase 7: Polish
15. **Touch target audit** — ensure 44-48px minimums across all interactive elements
16. **Font size audit** — names 16-18px, body 13-14px per spec
17. **Edge states and validation messages** — empty states, error handling, loading skeletons

---

## Database Changes Needed
- `suppliers_min` table (name, abn/company_number, contact, is_active)
- Add `volunteer` to visitor type options
- Add `jurisdiction` column to `settings` or a dedicated `site_config` table
- Add `change_reason` column to `audit_log`
- Add `signature_url` column to `visitors`

---

## Recommended Approach
Given the scope, I recommend tackling this in the order above, one phase per conversation cycle. Each phase is independently testable. Phase 1 (Home Workbench) gives the most visible UX improvement and aligns the app with the spec's primary UX model.

**Next step**: Tell me which phase to start with, or say "start from Phase 1" and I'll begin implementation.

