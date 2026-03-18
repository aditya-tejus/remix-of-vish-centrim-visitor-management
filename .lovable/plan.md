

## Resident Booking Process — Reversed Flow

### Understanding

Residents have an **inverted flow** compared to visitors/contractors/staff:
- **Visitors**: Check-in first → visit → Check-out later
- **Residents**: **Check-out first** (leaving facility) → external visit → **Check-in on return**

### Current State

The `AddVisitDialog` already partially handles residents differently (sets status to `"checked-out"`, shows "Dining Check-Out" title, different visit info fields). But it doesn't fully implement the correct resident booking flow you described.

### Proposed 5-Step Resident Booking Wizard

When "Resident" is selected as the type, the wizard steps change to:

```text
Step 1: Resident Selection
  - Search/select from existing resident profiles (mockResidents list)
  - Show room number, wing for identification
  - Option to add new resident

Step 2: Basic Details
  - Companions (using existing companion fields system)
  - Communication mobile number
  - Communication email
  - Expected return date (date picker)
  - Checkout reason (dropdown: Medical Appointment, Family Visit,
    Shopping, Social Outing, Other + free text)

Step 3: Custom Questions
  - Dynamic questions from DB (health_questions table, type=resident)
  - Same question types as current (yesno, text, select, checkbox, etc.)

Step 4: Temperature Check
  - Body temperature input
  - Health declaration confirmation

Step 5: Review & Confirm Check-Out
  - Summary of all details
  - Privacy acknowledgment & terms
  - Submit button labeled "Confirm Check-Out"
  - Status saved as "checked-out" with check_out_time set
```

### Database Changes

Add two columns to the `visitors` table:
- `expected_return_date` (timestamp, nullable) — for resident return tracking
- `checkout_reason` (text, nullable) — reason for leaving

### Code Changes

1. **Migration** — Add `expected_return_date` and `checkout_reason` columns to `visitors` table

2. **`src/types/visitor.ts`** — Add `expectedReturnDate` and `checkoutReason` fields to the `Visitor` interface

3. **`src/hooks/useVisitors.ts`** — Map the new DB columns in `dbToVisitor` and include them in insert/update operations

4. **`src/components/AddVisitDialog.tsx`** — Major refactor for resident flow:
   - Change step labels to `["Resident", "Details", "Questions", "Temperature", "Confirm"]` when type is resident
   - Step 1: Resident-specific search showing room/wing info
   - Step 2: Companions + communication fields + return date picker + checkout reason dropdown
   - Step 3: Custom questions (reuse existing health questions UI)
   - Step 4: Dedicated temperature input step
   - Step 5: Review summary with "Confirm Check-Out" action
   - On submit: set `status: "checked-out"`, `checkOutTime: new Date()`, `checkInTime: null`

5. **Resident Check-In on Return** — Add a "Check-In Return" action on the Visit List for checked-out residents, which sets `status: "checked-in"` and `checkInTime: new Date()`

### UI/UX Notes

- The wizard dynamically switches between 4 steps (non-resident) and 5 steps (resident)
- Step indicator updates labels accordingly
- Submit button text changes to "Confirm Check-Out" for residents
- Visit List will show a "Check In" button for checked-out residents to record their return

