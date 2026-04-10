

# Resident Leave: Settings + Kiosk Parity

## Problem

1. **Settings gap**: Resident settings exclude "Check-In Form Fields" and "Check-in Questions" (health/compliance). These sections are currently restricted to non-resident types. But when a resident goes on an outing, care homes need configurable pre-departure questions (e.g., "Do you have your medication?", "Do you have your mobile phone?", "Emergency contact confirmed?").

2. **Kiosk gap**: The web app (`ResidentOutingDialog`) collects destination, escort details, companion info, and notes. The kiosk (`KioskResidentLeave`) only asks for leave type and expected return — no configurable questions, no escort/companion capture, no T&C acknowledgment.

## Plan

### Step 1 — Add settings sections for Residents

In `PersonTypeSettings.tsx`, add two new accordion sections for the `resident` type:

- **"Leave Form Fields"** — reuses `FormFieldsManager` with `visitorType="resident"`. Admins can configure fields like "Destination", "Escort Name", "Contact Phone" that appear during resident departure.
- **"Leave Questions"** — reuses `HealthQuestionsManager` with `visitorType="resident"`. Admins can add yes/no or text questions like "Medication taken?", "Mobile phone charged?", "Key worker informed?".

These use the existing `form_fields` and `health_questions` tables with `visitor_type = 'resident'`, so no database changes needed.

**File**: `src/components/settings/PersonTypeSettings.tsx`
- Remove the `type !== "resident"` guard from form fields
- Remove the exclusion of `resident` from health questions
- Relabel them contextually: "Leave Form Fields" and "Leave Compliance Questions" when type is resident

### Step 2 — Add questions to Kiosk Resident Leave flow

In `KioskResidentLeave.tsx`, after the resident selects leave type and before the confirm screen:

- Fetch active `form_fields` and `health_questions` for `visitor_type = 'resident'` using existing hooks
- If any are configured, insert a new step in the leaving flow that renders them (kiosk-sized inputs)
- Store answers and pass them through to the checkout call

**File**: `src/pages/kiosk/KioskResidentLeave.tsx`
- Import `useFormFields` and `useActiveHealthQuestions` hooks
- Add a `"questions"` mode between `"leaving-confirm"` step's leave-type selection and the actual confirm action
- Render form fields and health questions using kiosk-appropriate large inputs
- Include answers in the checkout reason/details

### Step 3 — Relabel for clarity

In the settings accordion, when rendering for residents:
- "Check-In Form Fields" → "Leave Form Fields"
- "Check-in Questions" → "Pre-Departure Questions"

This makes it clear these apply to the resident departure workflow, not a check-in.

## Summary of changes

| File | Change |
|------|--------|
| `PersonTypeSettings.tsx` | Add form fields + health questions sections for resident type with contextual labels |
| `KioskResidentLeave.tsx` | Add configurable questions step between leave-type selection and confirm |

No database migrations needed — the existing `form_fields` and `health_questions` tables already support `visitor_type = 'resident'`.

