

## Deep-Dive Analysis: Kiosk Mode Flow Gaps

### 1. Data Flow Misalignment — Kiosk vs Desktop Check-In

The desktop check-in (`useCheckInFlow.ts` + `CheckInSheet.tsx`) and the kiosk check-in (`KioskCheckIn.tsx`) are completely independent implementations with no shared logic. Here is what the desktop flow supports that the kiosk ignores:

```text
Feature                         Desktop    Kiosk    Gap
─────────────────────────────────────────────────────────
Dynamic form fields (form_fields)   ✓         ✗      CRITICAL
Returning visitor lookup            ✓         ✗      HIGH
Photo capture                       ✓         ✗      MEDIUM
Resident/Staff picker (structured)  ✓         ✗      HIGH
Companion details                   ✓         ✗      MEDIUM
Vaccination fields (vacc_fields)    ✓         ✗      MEDIUM
Contractor screening (AU/UK)        ✓         ✗      HIGH
Address field                       ✓         ✗      LOW
Watchlist check timing              ✓         ~      Kiosk checks at submit only
T&C per type (tc_content_*)         ✓         ✓      OK
Health questions per type           ✓         ✓      OK
Privacy notice component            ✓         ✗      MEDIUM
Feedback on checkout                ✓         ✗      HIGH
```

**Root cause**: `KioskCheckIn` was built as a standalone component with hardcoded fields (`firstName`, `surname`, `email`, `mobile`, `whomToVisit`) instead of reusing `useCheckInFlow` or at least querying the `form_fields` table.

### 2. Check-Out Flow Gaps

The desktop `CheckOutSheet` triggers `FeedbackDialog` after checkout. The kiosk `KioskCheckOut` does **not** check for active feedback surveys or show any feedback prompt. It also lacks:
- Checkout reason selection (desktop has type-specific reason dropdowns)
- Companion checkout handling
- Overstay warnings

### 3. Resident Leave Flow Gaps

- No confirmation step before marking leave (single tap = immediate action)
- No leave type selection (desktop supports leave types from `leave_types` table)
- No expected return date capture
- No companion/accompanied-by information
- Returning mode shows `v.address` as subtitle instead of room/wing

### 4. UI/UX Issues (Kiosk-Specific)

**A. Check-In Page**
- `max-w-xl` (576px) is too narrow for a kiosk tablet (typically 10-12" landscape). Content feels cramped on large screens.
- Type selection auto-advances on tap (no confirmation), meaning accidental taps skip directly to details.
- "Who are you visiting?" is a plain text input — no way to search residents/staff. Desktop has a structured Resident/Staff picker with room numbers and wings.
- No visual feedback for required fields (no asterisks except on first/surname).
- The screening step has no progress indicator for how many questions answered vs total.
- No keyboard/on-screen keyboard considerations for kiosk devices.

**B. Check-Out Page**
- Search input gets `autoFocus` but kiosks often don't have physical keyboards. No on-screen prompt.
- No alphabetical grouping or "scroll to letter" for long visitor lists.
- The `max-h-[400px]` scrollable area is fixed — doesn't adapt to screen size.

**C. Resident Leave Page**
- Single-tap departure with no confirmation is dangerous — a resident could be marked as "away" by accident.
- No search on the returning list.
- Room number shown as `initials` prop on person cards (misusing the initials field).

**D. General Kiosk UX**
- No "Cancel / Start Over" button visible on any step (only Back). Users stuck mid-flow must wait for idle timeout (90s).
- No accessibility: no ARIA labels, no focus management, no high-contrast mode.
- Success screen countdown (5s) may be too fast for users who need to read the confirmation.
- QR route (`/kiosk/qr`) in home tiles leads to nowhere — no route defined in `App.tsx`.

### 5. Proposed Solution

**A. Refactor KioskCheckIn to use shared logic**
- Extract a `useKioskCheckInFlow` hook that wraps `useCheckInFlow` or shares its query logic.
- Query `form_fields` for the selected type and render fields dynamically (respecting `is_active`, `required`, `sort_order`).
- Add returning visitor search (query `visitors` table by name/phone).
- Add structured Resident/Staff picker using `useResidents` / `useStaffMembers`.
- Add contractor screening step (reuse `ContractorScreening` component with `compact` mode).
- Add vaccination fields step when configured.

**B. Wire kiosk checkout to feedback system**
- After successful checkout, query `feedback_surveys` for active survey matching the visitor type with `checkout` trigger.
- If found: show a kiosk-optimized feedback screen (large emoji buttons, one question per screen).
- If `centrim_compliance` source: show QR code or external link card.
- If none: skip to success screen.

**C. Fix Resident Leave flow**
- Add a confirmation step (show resident name, room, wing) before executing.
- Add leave type selector (from `leave_types` table).
- Add optional expected return date/time picker.
- Add search on the returning list.

**D. UI/UX improvements**
- Increase max width to `max-w-2xl` (672px) or responsive `max-w-[90vw]` for landscape tablets.
- Add a persistent "Cancel" / "Start Over" button in the kiosk header or footer.
- Add confirmation on type selection before advancing.
- Replace plain text "who are you visiting" with searchable resident/staff list.
- Add alphabetical scroll index for checkout and resident lists.
- Fix QR tile: either implement route or remove from home.
- Make success screen countdown configurable (setting) and add a "Done" button for early exit.
- Increase `max-h` scroll areas to use `calc(100vh - ...)` for full-screen usage.

**E. Implementation priority**
1. KioskCheckIn dynamic fields + returning visitor + structured person picker (fixes the core data mismatch)
2. Kiosk checkout feedback integration
3. Resident leave confirmation + leave types
4. UI polish (widths, cancel button, QR route, accessibility)

### Technical approach
- Create `useKioskCheckInFlow` that calls `useFormFields(selectedType)`, `useActiveHealthQuestions(selectedType)`, `useActiveVaccinationFields(selectedType)`, and loads `tc_content_*` settings.
- Build step pipeline dynamically based on what's configured (same pattern as desktop).
- Reuse `ContractorScreening` component for contractor type.
- Add `KioskFeedbackScreen` component (kiosk-optimized version of `FeedbackDialog`).
- Add confirmation modal to `KioskResidentLeave` before executing leave/return.

