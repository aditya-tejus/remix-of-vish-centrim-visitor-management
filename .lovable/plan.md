

## Plan Update: Add Missing Screen Specifications

The current plan covers Phases 5–12 with domain improvements but is missing explicit entries for several screens from the 36-screen spec. These screens exist partially in code but aren't tracked in the plan.

### Items to add:

**Phase 6 additions (existing screens needing enhancement):**
- Screen 11 — Emergency Roll Call: grouped sections (Visitors/Contractors/Volunteers/Residents Away/Overdue), mark safe/not accounted, export snapshot, resident mobility data in roll call
- Screen 12 — Visitor Profiles List: search, filters, list columns, quick check-in action
- Screen 13 — Visitor Profile Detail: tabs (Summary, Badges, Visit History, Contact, Privacy UK), issue/revoke/reprint badge (revoke requires reason)
- Screen 14 — Reports Home: card layout linking to Evacuation Report, Presence Log, Visit Trends

**Phase 7 additions (settings screens as explicit items):**
- Screen 18 — Settings Home: sections listed, role-gated
- Screen 19 — Settings: Presence
- Screen 20 — Settings: Screening (tabs by person type + jurisdiction AU/UK)
- Screen 21 — Settings: Terms & Conditions (per person type, versioned)
- Screen 22 — Settings: Alerts (overdue recipients)
- Screen 23 — Settings: Automation (auto-checkout hours per type)
- Screen 24 — Settings: Printing (Brother QL template)
- Screen 25 — Settings: Profiles & Badges
- Screen 26 — Settings: Resident Leave Self-Service (Option C controls)
- Screen 27 — Settings: GDPR (UK) (minimisation, DSAR role, retention/anonymise)
- Screen 28 — Settings: Audit Log (filters + export)
- Screen 29 — Settings: Lock & Governance (lock enabled, locked sections)

**Phase 11 update — per-screen states:**
- Every screen must include: loading skeleton, empty state (illustration + message + CTA), error state (alert + retry), permission denied state (lock icon + "Contact admin") where applicable

**File change:** Update `.lovable/plan.md` to insert these items into their respective phases, keeping the existing structure intact.

