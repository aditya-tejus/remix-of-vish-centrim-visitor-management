# Phase 7A verification — resident destination selection

## 1. Root cause

Verified against the running app: the "who are you visiting" control works correctly.

Opening the front-desk check-in, choosing Visitor, moving to Details and typing a first name and surname enables Next immediately, and the destination selector opens with the two expected choices (Resident, Staff Member). The earlier walkthrough stalled because the automated script targeted the fields incorrectly (it looked for form labels that are not wired as accessible labels, and it opened the destination selector before the name fields had been filled, leaving the Next button legitimately disabled).

So: the stall was a test-script problem, not a UI or selection defect.

One genuinely separate issue surfaced while checking scoping:

- The resident list used at the front desk is loaded without any site filter. Every resident record currently sits on the original site, so a person working at Riverstone (AU) or Willowbrook (UK) is offered residents belonging to a different site. This is a site-isolation and privacy issue, and it also means the destination list is empty-by-truth for the two newer sites once filtering is added.
- Names, room and area shown in the desk selector are appropriate for signed-in reception staff; the kiosk uses a separate, restricted directory, which stays untouched.

## 2. Does code need changing?

Yes, but only one small change: site-scope the resident list used by signed-in screens. No change is needed to the destination control itself.

## 3. Files expected to change

- `src/hooks/useResidents.ts` — filter residents by the current site, keeping the existing behaviour for the original/legacy site (records without a site stay visible there only).
- `src/components/checkin/StepDetails.tsx` — only if an explicit "No residents recorded for this site yet" message is wanted under the resident selector.
- `roadmap.md`, `docs/SECURITY_REVIEW.md` — record the verification result and the scoping fix.

No database, permission, policy or settings changes. No new component.

## 4. Smallest fix

1. Add the site filter to the resident query and re-use the existing site rules already applied to the visit list.
2. Add a short empty message in the resident selector so an empty list reads as "none recorded here" rather than a broken control.
3. Correct the automated walkthrough to target fields by placeholder and fill names before touching the destination selector.

## 5. Acceptance tests to complete Phase 7A

- Front desk: ordinary visitor check-in completed end to end, visitor appears in On site now, then checked out.
- Returning visitor found by search and pre-filled after confirmation.
- One companion added and departing individually.
- Destination: resident chosen, staff member chosen, and neither chosen.
- Site isolation: residents from the original site never appear when a different site is selected.
- Duplicate submit: pressing the final button twice creates one record.
- Save failure: the form stays open with details intact and offers a retry.
- Checkout failure: the visitor stays on site and the error is shown.
- Layout at 375px and 768px with no sideways scrolling.
- Kiosk unchanged: no direct reads of sensitive tables.
- All temporary records removed afterwards, then typecheck, build and security linter.

## 6. Scope confirmation

No Phase 7B–7F work: no group check-in, no QR fast lane, no volunteer screens, no emergency redesign, no settings consolidation and no new reports. Professional icons only, no emojis.
