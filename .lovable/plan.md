

# Preload Resident Leave Form Fields + Sync Web Dialogs

## Overview

Insert 5 default form fields into `form_fields` table for `visitor_type = 'resident'`, then update the two web app dialogs (`ResidentOutingDialog` and `ResidentLeaveDialog`) to fetch and render any active health/compliance questions configured in Settings. No seed health questions per your request.

## Step 1 — Insert seed form fields (database insert, not migration)

Insert 5 rows into `form_fields` with `visitor_type = 'resident'`:

| field_key | label | field_type | required | sort_order |
|-----------|-------|------------|----------|------------|
| `leave_mode` | Short Outing or Leave | `select` | true | 1 |
| `destination` | Where are they going? | `text` | true | 2 |
| `expected_return` | Expected return date & time | `text` | false | 3 |
| `accompanied_by` | Who are they going out with? | `select` | true | 4 |
| `comments` | Comments | `textarea` | false | 5 |

## Step 2 — Update ResidentOutingDialog

- Import `useActiveHealthQuestions` from `useHealthQuestions`
- Fetch active health questions for `visitor_type = 'resident'`
- Add state for `healthAnswers: Record<string, string>`
- If questions exist, render them in a collapsible section before the submit button (both short-outing and planned-leave modes)
- Include answers in the `comments` or `details` payload passed to `onMarkAway`

## Step 3 — Update ResidentLeaveDialog

- Import `useActiveHealthQuestions`
- Fetch active health questions for `visitor_type = 'resident'`
- Add state for `healthAnswers`
- Insert a "Pre-Departure" step between "Companions" (step 4) and "Confirm" (step 5), making steps: Resident → Schedule → Reason → Companions → Pre-Departure → Confirm
- Only show the step if there are active questions; skip it automatically if none configured
- Include answers in the `comments` field of the submitted visitor object

## Files changed

| File | Change |
|------|--------|
| Database (insert tool) | 5 rows into `form_fields` |
| `src/components/ResidentOutingDialog.tsx` | Add health questions section |
| `src/components/ResidentLeaveDialog.tsx` | Add pre-departure questions step |

No migrations needed. Settings and Kiosk already consume these hooks — no changes required there.

