# Phase 7C — Person types, volunteers and group arrivals

Goal: support the way people actually arrive (one visitor, a volunteer shift, a bus of ten
family members or a school choir) without making ordinary visitor check-in any longer and
without inventing a second people or group system.

## What exists today (verified)

- Five person types are already configurable per site (Visitor, Contractor, Volunteer, Staff,
  Resident), each with switches for kiosk/desk visibility, name shown on the kiosk, questions,
  privacy, badge and roll-call inclusion.
- Volunteer is already a full type: it gets questions, privacy, a badge and roll-call inclusion,
  and can be recorded as visiting a resident. It has no volunteer-specific details.
- The check-in record already has a group field, and the kiosk already uses it when someone
  brings companions. Companions are also written as individual people on the visit.
- The old Group Check-In screen is unreachable (its address redirects to the visit list). It
  records the group only as free text in the comments, does not use the real group field, does
  not ask the check-in questions, does not ask for privacy consent, does not issue badges, is
  not tied to a site and does not wait for each save to succeed. It cannot be reused as is.
- The New Check-In chooser always shows every enabled type plus a code-scan card, even when a
  site only allows one type.
- The emergency roll call is built from everyone currently on site, including companions, so any
  attendee saved as their own record is automatically counted.
- Badges already have a lifecycle (issued, reprinted, voided) with an audit entry for each print.

## The plan

### 1. Person Type Selector

- Skipped entirely when only one type is enabled for that place (front desk or kiosk): the person
  goes straight into that check-in. No dead-end screen.
- Skipped when a returning person is recognised by their code and their type is already known;
  staff can still change it before saving.
- Never skipped when two or more types are enabled.
- At most five cards are visible: Visitor, Contractor, Volunteer, Staff, Other. Fixed order,
  Visitor always first. Each card is an icon plus a written label — no icon-only cards, no emojis.
- "Other" is hidden unless a site explicitly turns it on. When on, it behaves as a Visitor with a
  short mandatory "reason for visit" line, and reports it under its own name so it can be reviewed.
- The code-scan card keeps its current behaviour and stays hidden where codes are not issued.

### 2. Volunteers

- Volunteer stays the existing type; no new person system.
- Adds, only for volunteers and only when the site turns each on: role or programme, supervising
  staff member, and expected finish time. All three are optional by default.
- Volunteer questions and terms come from the existing per-type question and privacy settings.
  Nothing is silently pre-answered.
- Regular volunteers are recognised by the same returning-person lookup that visitors use, and
  the same badge rules apply.

### 3. Group arrivals

One organiser, many attendees, one shared arrival:

- An organiser starts the group arrival, gives the group a short name (for example "Rosewood
  Primary Choir"), says who or where they are visiting, and adds attendees by name.
- Every attendee is saved as their own check-in record, tied to the shared group. There is no
  second group table beyond the existing group field on each record; the group name is carried
  on each attendee's record so lists and reports can show it.
- Questions and terms: the organiser answers the shared terms once on the group's behalf and this
  is recorded as an organiser-declared answer with the organiser's name against every attendee.
  Where the site marks a question as "each person must answer", the kiosk or desk asks it per
  attendee. No question is quietly auto-answered without being labelled as organiser-declared.
- Anyone on the alert list is flagged at the moment their name is entered, before the group is
  saved, using the existing site-scoped alert check.

### 4. Partial completion and failures

- Attendees are saved one at a time. If some save and others fail, the group is shown as partly
  arrived: the saved attendees are on site and accountable, and the failed ones stay on screen
  with a Retry button. Nothing is silently dropped, and no one is double-saved on retry.
- A group can be added to later in the day (late arrivals join the same group).
- Leaving the screen with unsaved attendees warns first.

### 5. Checkout

- Individual checkout always works: any attendee can leave on their own, and the group stays open
  for the rest.
- Group checkout is a convenience on top: "Check out this group" lists everyone still on site with
  tick boxes, all ticked by default, and departs only those ticked.
- The visit list shows a group as a single line that expands to the individuals, with a count of
  who is still on site. Overdue tracking stays per person, using the existing rules.

### 6. Badges

- Badges follow the existing per-type rule. When badges apply, each attendee gets their own badge
  with their own code; printing is per person or "print all for this group".
- Reprinting uses the existing reprint path and is written to the audit trail as before.

### 7. Emergency roll call

- Every attendee already counts individually because they are individual records; the roll call
  additionally shows the group name and organiser next to each attendee so staff can sweep a
  group together and still mark people one by one.
- Marking safe stays per person. There is no "mark whole group safe" shortcut.

### 8. Privacy, site isolation, permissions, audit

- All group and volunteer reads and writes are stamped with the current site and never cross sites.
- The kiosk never displays contact details, rooms in browse mode, or other attendees' details
  beyond first name and surname on the confirmation screen.
- Creating a group arrival requires the existing "check someone in" permission; group checkout
  requires the existing checkout permission; editing an attendee's details requires the existing
  person-edit permission.
- New audit entries: group created, attendee added, attendee save failed, group checkout, and
  organiser-declared terms (recording the organiser's name and how many attendees it covered).
  Badge and check-in audit entries stay as they are.

### 9. States

Every new screen gets the shared loading, empty, error, permission-denied and offline states
already used elsewhere. Offline: the group screen refuses new saves with a clear message rather
than pretending to save.

### 10. Tablet and kiosk

- Group arrival is primarily a front-desk/tablet task: a single scrolling list of attendee rows,
  large touch targets, no horizontal scrolling at tablet width.
- On the kiosk, a group tile appears only if the site enables it; it collects the organiser and
  attendee names with the same large-target keyboard, and never shows resident or staff details.

## Technical detail

Files expected to change:

- `src/hooks/usePersonTypes.ts` — add the "Other" type (off by default), volunteer field switches,
  and a helper for "how many types are enabled here".
- `src/pages/PersonTypeSelector.tsx` — skip logic, fixed order, "Other" card, labelled icons.
- `src/components/checkin/StepIdentify.tsx`, `useCheckInFlow.ts`, `src/hooks/useKioskCheckInFlow.ts` —
  volunteer fields and "Other" reason; ordinary visitor flow unchanged in length.
- `src/pages/GroupCheckIn.tsx` — rewritten on the current check-in pipeline; route restored.
- New: `src/hooks/useGroupVisits.ts`, `src/components/groups/GroupAttendeeRows.tsx`,
  `src/components/groups/GroupCheckOutSheet.tsx`.
- `src/pages/VisitList.tsx`, `src/components/VisitorTable.tsx` — collapsible group rows.
- `src/components/CheckOutSheet.tsx` — group-aware individual checkout wording.
- `src/hooks/useEvacuation.ts`, `src/pages/Evacuation.tsx`, `src/pages/EvacuationReport.tsx` —
  show group name and organiser per attendee.
- `src/lib/badgeIssue.ts` — print-all-for-group helper reusing the existing badge lifecycle.
- `src/components/settings/PersonTypesTab.tsx` — the new switches, with plain-English explanations.
- `src/App.tsx` — restore the group route.
- `roadmap.md`, `docs/SECURITY_REVIEW.md`.

Database: one migration, additive only — `group_label` and `group_organiser` text columns on the
check-in table (the existing group field stays the key), plus `volunteer_role`,
`volunteer_supervisor` and `volunteer_expected_end`. No new tables, no new group or people model,
no policy widening; existing site-scoped policies already cover these columns. The kiosk group
path reuses the existing narrow kiosk check-in function with the extra fields passed through, so
no new anonymous database access is added.

## Acceptance tests

1. One enabled type: chooser is skipped; two or more: chooser shown in fixed order.
2. "Other" hidden by default; visible only when enabled, and requires a reason.
3. Ordinary visitor check-in has the same number of steps as today.
4. Volunteer check-in with and without the optional fields; questions and terms explicit.
5. Group of five saved: five individual records, one shared group, correct site.
6. Forced failure on attendee three: two on site, one retryable, no duplicate on retry.
7. Late attendee joins the same group.
8. One attendee leaves alone; group stays open; then group checkout departs the rest.
9. Roll call lists all five individually with group name; marking safe is per person.
10. Badges: per person and print-all; reprint audited.
11. Site A group invisible at site B, kiosk and desk.
12. Permission-denied and offline states behave.
13. Tablet width: no horizontal scrolling.
14. Phase 7A visit list and 7B kiosk behaviour unchanged.
15. All temporary test records purged and verified at zero; typecheck, build and security linter
    run, with the linter compared against the current 47 documented warnings.

## Non-goals

Pre-registration or invitations, external notifications, printer hardware, biometrics or facial
recognition, contractor credential expansion, emergency redesign, settings consolidation,
recurring group bookings, per-attendee photos, and anything in Phase 7D–7F.

## Risks

- Group screens are where a "quick" flow tends to grow; the guard is that ordinary visitor
  check-in code paths are not touched except for the volunteer/Other fields.
- Organiser-declared terms are an operational convenience with real regulatory weight; they must be
  clearly labelled as declared by the organiser, never presented as each attendee's own answer.
- Partial saves are the most likely source of an inaccurate on-site list; retry behaviour must be
  tested with forced failures, not assumed.

## Open questions

1. Should organiser-declared terms be allowed at all at your sites, or must every adult attendee
   answer for themselves (with the organiser answering only for children)?
2. Do you want "Other" at all, or should sites simply rename Visitor?
3. For a group, is a name-only attendee record enough, or do you need a phone number for at least
   the organiser plus anyone under a duty-of-care arrangement?
4. Should group checkout be allowed from the kiosk, or front desk only?
