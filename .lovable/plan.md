# Centrim Life Visitor Management — audit and redesign plan (Phase 9)

This plan covers three separate settings: Australian residential aged care (AU RAC), Australian retirement villages (AU RV) and English care homes (England). It keeps every working workflow, all live data, permissions, audit history and the database structure. Nothing here gets removed. Changes are added on top, and every phase can be rolled back.

## 1. Audit summary (evidence from current code)

Status key: Built = works end to end. Partial = works, but has a gap or a misleading screen. Missing = not built.

| Area | Status | Evidence | Finding |
|---|---|---|---|
| Today workbench | Built | `src/pages/HomeWorkbench.tsx` (14 KB) | Readable. Counts for "on site now" and "overdue" fixed in 8F. Too many cards compete with the urgent actions. |
| Visit List | Built | `src/pages/VisitList.tsx`, `src/hooks/useVisitViews.ts` | Fast. The live view ignores the date filter (correct). The filter bar is dense on tablet. |
| Staff check-in | Partial | `src/components/AddVisitDialog.tsx` (**80 KB, monolithic**) plus a second path, `components/checkin/*` (`CheckInSheet`, `useCheckInFlow`) | **Two parallel check-in implementations.** This risks rules drifting apart (screening, companions, food). |
| Kiosk check-in | Partial | `src/pages/kiosk/KioskCheckIn.tsx` (**67 KB**), `useKioskCheckInFlow.ts` | Line 279: `screeningBlocked = evaluation.blocked \|\| (outbreakMode && screeningFlagged)`. When outbreak mode is on, any flagged answer becomes a **hard block**. That conflicts with case-by-case measures under CQC Regulation 9A and Quality Standard 7 (blanket denial). |
| Kiosk check-out | Partial | `KioskCheckOut.tsx` uses `kiosk_presence_list` | The foyer screen can list the names of **everyone on site**. That is too much disclosure under the APPs and UK GDPR. It should be search-first by default. |
| Returning visitor | Partial | `kiosk_returning_lookup` | A name-only lookup returns that person's contact details. This is open blocker 2 in SECURITY_REVIEW. |
| Group / companions | Built | `GroupCheckIn.tsx`, `lib/companionCheckout.ts` | Works. Companion check-out confirmation is clear. |
| Contractor verification | Built | `ContractorDocumentReviews.tsx`, `contractor_document_review` | Works. The kiosk gets the outstanding-check decision only (good). |
| Resident movements | Built | `ResidentLeave.tsx`, `KioskResidentLeave.tsx` | Residents on leave stay on the Away list. In a village, an independent resident is pushed through "leave" language that suits aged care, not villages. |
| Keys and fobs | Built | `KeysRegister.tsx` (**40 KB**) | Works, but the file is too large to keep safely. |
| Evacuation | Partial | `Evacuation.tsx` (**52 KB**), `useEvacuation.ts` line 239 sets everyone to `unaccounted` | Only "safe / unaccounted / missing". It cannot tell **known on site**, **resident at home (unknown)** and **physically confirmed** apart. That is critical for villas. |
| Reporting | Built | `Reports.tsx` (27 KB), `VisitorReport.tsx`, `VisitorAnalytics.tsx` (24 KB) | Overlapping report screens. The analytics charts add clutter. |
| Settings | Built | `pages/Settings.tsx`, `SettingsNav.tsx`, `SettingsAccessContext` | Grouping is good. Health questions look switched on by default for new types. Default should be off. |
| Permissions | Built | `usePermissions.ts`, `role_permissions` | Only 3 roles (admin/staff/user). No receptionist, manager or clinical lead roles. |
| Segment packs | Built | `lib/segmentPacks.ts`, `OperatingContext.tsx` | The UK pack is labelled "UK" and treated as one regime. **Change it to England** (CQC/Reg 9A), and add a "not configured" state for Scotland, Wales and Northern Ireland. |
| Shell / navigation | Built | `AppSidebar.tsx`, `lib/navigation.ts` (8F) | Order is correct. Mobile drawer is fine. |
| Notifications | Missing | `NotificationService` returns false | No email or SMS is ever sent. Any screen that says "notify" is misleading. |
| Visual language | Partial | `index.css --primary 217 91% 60%`, Inter | A bright generic blue. Needs a deliberate deep brand blue and a warmer feel. |

### Stale or unverified documentation
- SECURITY_REVIEW open blocker 5 ("devices bound by `?site=` only") is **out of date**: Phase 8D added device binding. Update it with the evidence.
- SECURITY_REVIEW counts 43 linter warnings. The current linter reports about 105. Re-classify them. Do not claim the system is fixed.
- INTEGRATION_CONTRACTS still lists the Stage 2 follow-up "kiosk visitor creation writes to `visitors`". `kiosk_check_in` / `kioskd_check_in` now exist. Check whether the direct insert policy is still in place before marking it closed.
- Caveats that must stay in the docs: no independent security review, no notification delivery, retention and controller details unset, emergency exports not tamper-evident, and WCAG 2.2 AA is a design target, not a certification.

## 2. False affordances and risks (fix first)
1. Outbreak mode turns a flagged answer into a hard block (kiosk). Change: it becomes "Please see reception". Staff make the decision and record the reason.
2. The kiosk check-out list shows everyone on site. Change: search-first by default, with initials and the arrival time only.
3. A name-only returning lookup shows contact details. Change: show them only after a mobile number or QR match. For a name match, show masked details.
4. Any "send / notify" wording without a delivery channel. Change: label it "Recorded for staff (no message sent)".
5. Evacuation counts residents at home in a villa as missing. Change: add the new statuses (section 4).
6. Health questions on by default. Change: off by default for new types. Existing site choices stay as they are.

## 3. Example journeys and edge cases (used as UAT scripts)
- **AU RAC, Sunday afternoon:** a daughter, her two children and a dog visit Mum in Wing B. Steps: kiosk, then search the resident, then companions, then the dog noted, then a badge. Outbreak is active. One child answers "sore throat", so the kiosk shows "see reception". The nurse offers a mask and a garden visit, and records the reason. The visit goes ahead.
- **AU RAC, end of day:** the son forgets to check out. At 9 pm automatic sign-out closes the visit, labelled as automatic. Today shows no false overdue alert the next morning.
- **AU RV:** an independent villa resident drives out for 3 days and does not log it. The fire alarm goes off. Roll call shows the villa as "Resident at home — unconfirmed". The warden physically checks the villa and records "Not home — confirmed". This is never labelled "missing".
- **AU RV:** a resident's guest stays overnight. The guest checks in through the resident. They are not screened by default.
- **England:** a person with an active watchlist entry arrives. The screen shows a soft alert to staff only, with the documented measure (supervised visit). There is no automatic denial unless a hard block was recorded with a reason and a review date.
- **England:** a resident with a DoLS authorisation leaves with family. The leave record shows the DoLS flag and the agreed conditions. Return is confirmed.
- **Contractor:** a plumber's insurance expired yesterday. The grace rule applies, the warning shows and the manager decides. A rejected document blocks check-in and the reason is shown to staff.
- **Edge cases:** the device goes offline mid check-in (queued). A badge printer is missing. Two people share the same name. A late arrival comes after the closing time. A resident is moved between sites. A visit is kept under legal hold.

## 4. Target design

### Navigation (keep 8F order, consolidate inside pages)
Today, Visitor List, Residents (in a village, "Residents and households"), Visitor Profiles, Registers, Reports (merge Visitor Analytics and Visit Trends into the Visitor Report as tabs), Settings, Emergency Roll Call, Kiosk Mode. All existing routes stay. Old routes redirect to the matching tab.

### Terminology per pack (in `segmentPacks.ts`)
| Concept | AU RAC | AU RV | England |
|---|---|---|---|
| Area / place | Wing / Room | Stage / Villa or Unit | Unit or Floor / Room |
| Resident movement | Leave / outing | Away from village (optional, self-reported) | Leave / outing |
| Regulator note | Aged Care Quality Standard 7, Aged Care Act | Retirement Villages Act (NSW 1999 / Vic 1986) — village rules, not aged-care rules | CQC Regulation 9A, UK GDPR, ICO |
| Screening default | Off, optional questions | Off | Off |
| Roll call | Known on site / safe | Known on site / at home unconfirmed / confirmed | Known on site / safe (PEEP) |
Scotland, Wales and Northern Ireland: the site shows "jurisdiction pack not configured". There is no implied regulation.

### Emergency roll call statuses (additive)
`known_on_site` (from attendance) → `physically_confirmed_safe` / `not_present_confirmed` / `unaccounted`. Village residents start as `at_home_unconfirmed`, not unaccounted. Each mark records who, when and where.

### Roles (additive; admin, staff and user keep working)
New role options: Receptionist, Site manager, Clinical/care lead, Village manager, Contractor coordinator. Each maps to the existing `app_permission` list in `role_permissions`. The kiosk stays a separate device credential, never a user role.

### Visual language
- Crisp white surfaces, light blue tints (around 214 60% 97%), and a deep brand blue as primary (around 220 70% 28%). A warm neutral text colour. A warm accent for dignified moments (welcome or thank-you screens).
- Typography: replace Inter with **Source Sans 3** (humanist, highly legible for older adults). Body text 16 px minimum, 20 px on the kiosk.
- No gradients. Charts only in Reports. One accent per screen. Status colours come from the existing semantic tokens.
- Kiosk: touch targets 56 px minimum (72 px for main actions), one question per step, a "Back" and "Need help? Ask reception" on every step, and a privacy summary before submit.

## 5. Phases (executed in order, each tested and checked live before the next)

### Phase 9A — Safety and privacy corrections (logic only, no visual change)
- Outbreak decision support: in `useKioskCheckInFlow.ts` and `lib/screeningPolicy.ts`, outbreak plus a flagged answer leads to a `refer_to_staff` outcome (not blocked). A staff override records the measure and reason in `audit_log`. Only explicit hard-block rules still block.
- Kiosk check-out becomes search-first (minimum 2 letters). The display is masked (first name and last initial). A site setting can still show the full list.
- Returning lookup: the name-only path returns masked contact details (UI change plus a change to the `kioskd_returning_lookup` result, new version only, old one kept until removed).
- Health questions default to off for new person types (`usePersonTypes` defaults). No change to existing values.
- Notification wording audit: replace any "sent" claims.
- Tests: outcome matrix (outbreak on/off × flagged/clear × hard rule), masking, defaults.

### Phase 9B — England, AU RV and AU RAC packs
- `segmentPacks.ts`: rename the UK pack to England with CQC Reg 9A wording. Add the RV pack differences (optional away logging, household wording, no clinical fields). Add a guard for other UK nations.
- Operating context screen: show the pack, the regulator note, and "configuration is not legal compliance".
- Tests: term resolution per pack, unconfigured-nation guard.

### Phase 9C — Emergency roll call statuses
- Additive migration: extend the attendance status options with `at_home_unconfirmed`, `physically_confirmed_safe`, `not_present_confirmed`. Add `confirmed_by`, `confirmed_at`, `confirmation_method`, all nullable. Existing rows are untouched.
- Split `Evacuation.tsx` (52 KB) into `evacuation/RollCallBoard`, `RollCallRow`, `PointSummary`, `VillaSweepList` and `CloseDrillDialog`.
- The kiosk roll call and the report show the three-way split. The village sweep list is ordered by stage and villa.
- Tests: initial status per pack, confirmation audit, report totals.

### Phase 9D — Design system refresh
- Change tokens in `index.css` and `tailwind.config.ts` (brand blue, warm neutrals, font). Shared components: `PageHeader`, `StatTile`, `StatusPill`, `ActionBar`, `EmptyState`, `KioskStep`, `KioskBigButton`, `PrivacySummary`.
- Update `docs/DESIGN_SYSTEM.md`.
- Check contrast at 4.5:1 for body text and 3:1 for large text and controls.

### Phase 9E — Break up monolithic screens (no behaviour change)
- `AddVisitDialog.tsx` (80 KB) becomes step components that reuse `components/checkin/*`. One shared rules module (`lib/checkInRules.ts`) is used by staff check-in, the kiosk and group check-in.
- `KioskCheckIn.tsx` (67 KB) becomes `kiosk/steps/*` (Identify, Destination, Companions, Questions, Privacy, Confirm).
- `KeysRegister.tsx`, `VisitorProfilePage.tsx` and `Reports.tsx` get split by section.
- Regression: the full test suite plus scripted Playwright journeys before and after the split.

### Phase 9F — Screen redesigns
- **Today:** urgent strip (overdue, outbreak, roll call open, documents to review), then "On site now", then "Expected", then quiet history. No more than 3 cards at the top.
- **Visit List:** sticky search, type chips, one-line rows, row actions (check out, profile). Tablet shows two columns.
- **Visitor profile:** summary header, then tabs (Visits, Questions, Companions, Documents, Privacy).
- **Staff check-in:** 50vw sheet, 4 steps, keyboard first.
- **Kiosk:** large-type steps, privacy by default, idle timeout kept (90 s).
- **Settings:** a "what this changes" preview stays. Role-aware read-only banner.
- **Reports:** Visitor Report with tabs (Activity, Trends, Exports). Charts are limited to 2.

### Phase 9G — Roles
- Additive values in the `app_role` enum plus `role_permissions` seed rows. A role editor in Users and access (admin only, audited).
- Tests: the permission matrix per role, and the settings write still limited to `settings.administer`.

### Phase 9H — Documentation truth pass
- Update SECURITY_REVIEW: blocker 5 resolved with evidence, a new linter count, items still open.
- Update INTEGRATION_CONTRACTS: follow-up items verified, or kept open.
- Update the roadmap and `AGENTS.md` (shared check-in rules module, no screen file over about 25 KB).

## 6. Acceptance (QA / UAT)
- All journeys in section 3 pass in Playwright, signed in, at 1280, 820 (tablet) and 390 (mobile).
- Kiosk: every control is at least 56 px. Never more than one decision per step. No data from another person is shown without a matching mobile number or QR.
- Outbreak never auto-denies without an explicit hard rule. Every staff override is audited.
- Village roll call never shows an at-home resident as "missing".
- Existing data counts are identical before and after each migration. Audit rows are kept.
- Full test suite, typecheck and build pass. The linter shows no new findings compared with the baseline.
- Keyboard-only and screen-reader landmark checks pass on Today, Visit List, kiosk and roll call. WCAG 2.2 AA is reported as a design target only.

## 7. Risks
- Splitting the large files may cause regressions. Mitigation: behaviour-locking tests first, then one file per step.
- Enum additions can't easily be undone. Mitigation: use additive values only, unused until the UI ships.
- Changing the font and colours affects every screen. Mitigation: change the tokens only, and review screenshots for each page.
- Legal wording: packs give operational guidance only, and every regulator note carries the caveat "not legal advice".

## Technical notes
- No destructive migrations. Every new column is nullable. Old RPCs are kept until the new versions are verified.
- Site isolation (`user_can_access_site`), device binding (`kioskd_*`) and the audit triggers stay unchanged.
- No mock functions. Unsupported features (SMS/email) stay visibly unavailable.
