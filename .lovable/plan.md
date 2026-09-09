# Phase 7B Plan — Dedicated Kiosk Experience and QR Fast Lane

Baseline: Phase 7A closure commit 2d0589f263c6cfbb02585da4768acb26275a7260. Plan only; no code changed.

## What exists today (verified by inspection)

- Kiosk routes: `/kiosk` (attract), `/kiosk/home`, `/kiosk/checkin`, `/kiosk/checkout`, `/kiosk/resident-leave`, `/kiosk/qr-scan`, `/kiosk/evacuation`, all under `KioskLayout`, plus a separate `/public-checkin` page.
- Kiosk check-in already has a full staged flow (type, details, who you are visiting, food, companions, screening, contractor questions, terms, confirm), settings-driven returning-visitor lookup, watchlist check, outbreak handling, and shared kiosk states (skeleton, error, success, idle warning, PIN pad, progress stepper).
- The kiosk knows which site it is by `?site=` in the address, remembered on the device.
- Idle handling: warning at 60 seconds, reset at 90 seconds, with the roll-call screen deliberately exempt.
- A rotating five-minute code already exists for "check in from your phone".

Four real problems were confirmed, and this phase exists mainly to fix them:

1. **The Scan QR screen skips screening and terms.** It matches a code against the on-site list in the browser and immediately creates a new check-in with the health declaration set to false and no terms acceptance. This breaks the rule that a code must never bypass screening or site policy.
2. **The kiosk is not site-isolated for lookups.** The two public helpers the kiosk relies on — the on-site list and the returning-person lookup — take no site and return records from every site. A kiosk at one home can surface people from another.
3. **An orphaned staff "QR Fast Lane" page still exists** (`src/pages/QRFastLane.tsx`), unrouted, with the same bypass behaviour and the staff sidebar. It is a second, unsafe check-in path.
4. **The welcome screen has a hard-coded site name** ("Sydney Care Centre") instead of the configured site.

## 1. Kiosk information architecture

```text
Attract screen  ->  Welcome (site name, date/time)
                      |
   +------------------+---------------------+-------------------+
   | Check In         | Check Out           | Resident leave    | Scan my code
   | (hero)           |                     | (only if enabled) | (Fast Lane)
```

Screen-by-screen: Attract -> Welcome -> chosen task -> steps -> confirmation -> automatic return to Attract. One task per screen, one primary action per screen, Start Over always available, help always available, staff access stays hidden behind the existing press-and-hold.

## 2. New visitor flow

Unchanged in structure, tightened in presentation: who you are -> your details -> who you are visiting -> optional food question -> anyone with you -> screening -> terms and privacy -> confirm -> welcome message and badge step. Only steps that apply to the chosen person type and the site's enabled modules are shown; the step counter reflects the real number of steps.

## 3. Returning visitor flow

Kept on the existing settings-driven lookup (phone, personal code, or name, per site and person type), which calls a restricted server helper rather than reading visitor records. Changes: the lookup becomes site-scoped, the match is shown as name only for confirmation, saved details are pre-filled, and screening and terms are still asked every visit.

## 4. QR Fast Lane

Fast Lane means "fewer taps", never "fewer checks".

- Entry: a scanned personal code or the Scan tile.
- The code is resolved by a restricted server helper, scoped to this site, returning only what the kiosk needs to greet and prefill.
- The kiosk then skips only identity and detail entry. Screening, terms, destination (if required for that type) and any site policy step are still presented, pre-answered where allowed by settings but always confirmed.
- Fast Lane ends in the same confirmation and badge behaviour as a normal check-in.
- The current client-side matching in `KioskQRScan` is removed.

## 5. Manual fallback

Camera unavailable, denied or failing: the screen falls back to a large keypad-friendly code entry with clear wording, then to the ordinary check-in path ("I don't have a code"). No dead ends, and camera failure never blocks a visit.

## 6. Contractor and volunteer routing

Both remain person types inside the same kiosk check-in, not separate screens. Contractors continue through supplier recognition and the configured compliance questions with warn/block per site; volunteers follow the ordinary path with their own configured questions. No staff administration, supplier records, credential documents or compliance history are visible on the kiosk — the visitor sees only pass, "please see reception", or the question being asked.

## 7. Duplicate scan and existing active visit

If a scanned or matched person already has an open visit at this site:
- offer "Check out" as the primary action and "This isn't me / start again" as the secondary;
- never silently create a second visit;
- a repeat scan within a short window shows the same confirmation instead of acting twice.

## 8. Timeout, inactivity and reset

Keep 60s warning / 90s reset with the roll-call exemption. Additions: a longer allowance while a visitor is typing into a field or reading terms, full state clear on reset (including any scanned code), and no personal detail left on screen after reset.

## 9. Failed save and network recovery

Match Phase 7A behaviour: on failure the kiosk stays on the confirm step, keeps everything entered, shows a plain "not saved, try again" message, prevents double submission, and creates exactly one record on retry. Offline is stated honestly; no silent queueing is promised.

## 10. Privacy-safe destination display

Resident search stays search-first where configured; results show name and, where the site allows it, area only — no room numbers, no clinical or contact detail. The confirmation shows "Visiting <name>", never a room. Staff destinations follow the existing lookup mode setting.

## 11. Badge completion

Ends on the existing badge behaviour: if badge issuing is on for the site and person type, offer the badge, otherwise go straight to the welcome confirmation. No printer hardware work.

## 12. Site binding and isolation

Device binding stays as it is (site in the address, remembered on the device). The welcome screen shows the real configured site name. Every kiosk lookup, list and write is bound to that site.

## 13. Anonymous access review

- Add an optional site parameter to the on-site list and returning-lookup helpers so anonymous kiosk calls are limited to one site.
- Remove the kiosk's direct write to the audit table in `KioskCheckIn.tsx`; route it through the existing restricted logging path.
- Confirm no kiosk screen reads visitor, resident, supplier, key or food tables directly.
- Re-run the security linter and record the classified warning count.

## 14. Responsive behaviour

Verified at 1280 (kiosk), 768 (tablet) and 375 (phone, for the "check in from your phone" path): single column below 768, minimum 48px touch targets, 16px+ body text, no horizontal overflow, keyboard-safe field positioning.

## 15. Icons

lucide-react only, always with a text label. No emojis anywhere.

## 16. Files expected to change

- `src/pages/kiosk/KioskQRScan.tsx` — rewritten as Fast Lane with camera, manual fallback and no bypass.
- `src/pages/kiosk/KioskHome.tsx` — real site name, tile set driven by enabled modules.
- `src/pages/kiosk/KioskCheckIn.tsx` — accept an incoming scanned identity; remove the direct audit write.
- `src/hooks/useKioskCheckInFlow.ts` — Fast Lane entry state, site-scoped lookup.
- `src/hooks/useVisitors.ts` — pass the kiosk site to the public list call.
- `src/pages/kiosk/KioskCheckOut.tsx`, `KioskLayout.tsx` — duplicate-visit handling, timeout refinements.
- `src/pages/QRFastLane.tsx` — removed (dead, unsafe duplicate path).
- `src/components/kiosk/*` — small shared additions only where reuse is genuine.

## 17. Data, permission and migration impact

- No new visitor, person or code model. Existing personal codes and visit codes are reused.
- One non-destructive migration: optional site parameter on the two kiosk lookup helpers, with existing behaviour preserved when no site is supplied.
- No new tables, no new permissions, no widening of anonymous access.

## 18. Acceptance tests

1. New visitor completes kiosk check-in; one record, correct site.
2. Returning visitor is recognised, details pre-filled, screening and terms still asked.
3. Fast Lane scan cannot complete without screening and terms.
4. Fast Lane at site B does not recognise a person known only at site A.
5. Camera blocked: manual entry works; unknown code offers ordinary check-in.
6. Scan of someone already on site offers check-out, creates no second visit.
7. Double tap on confirm creates one record.
8. Forced save failure keeps entries and allows exactly one successful retry.
9. Idle warning then reset clears all personal detail.
10. No room numbers or contact details appear on any kiosk screen.
11. Contractor block/warn behaves per site setting with no staff data shown.
12. Kiosk network trace shows restricted helpers only, no sensitive table reads.
13. Staff reception routes and Phase 7A behaviour unchanged.

## 19. Non-goals

No printer hardware, no email/SMS/push, no biometrics or facial recognition, no pre-registration or invitations, no group check-in redesign, no emergency redesign, no settings consolidation, no new reports, no Phase 7C-7F work.

## Risks

- Rewriting the scan screen changes behaviour some testers may have relied on; the old behaviour was unsafe and is intentionally removed.
- Adding a site parameter to shared kiosk helpers touches paths reception also uses indirectly; defaults must preserve current behaviour.
- Camera behaviour varies by device and cannot be fully proven in an automated browser test; manual fallback is therefore mandatory.

## Open questions

1. Should a personal code be reusable indefinitely, or expire after a set period per site?
2. When a returning visitor's screening answers are still within their validity window, may they be pre-answered for confirmation, or must every answer be re-tapped?
3. Should the Fast Lane tile be hideable per site for sites that do not issue codes?
