# Phase 8D and 8E — already built, so this is a verification pass

Both areas you asked for already exist in the app and are recorded as complete:

- **Kiosk device setup (8D)** — the tablet setup screen, staff device management in Settings, and a site that is decided by the server from the device rather than by the tablet.
- **Contractor paperwork (8E)** — supplying a document, a reviewer queue with approve / reject / not required, expiry and grace warnings, and a check-in gate that uses the reviewer's verdict.

Rather than rebuild them and risk breaking working screens, this plan checks them end to end against the practice contractor records and fixes only what is actually broken.

## What I will check

**Kiosk setup**
1. Add a kiosk for one site in Settings, receive the 12-character code, and confirm it is shown once.
2. Set up a tablet with that code; confirm it binds to the right site even with a false site in the address bar.
3. Confirm a reused code is refused, and that pausing the kiosk shows the plain "Kiosk unavailable" message.
4. Confirm a kiosk check-in lands on the bound site only.

**Contractor paperwork**
1. From the practice contractor records at one AU and one UK site, confirm the compliance panel shows verified, awaiting review and expired states.
2. Submit a new document, confirm it appears in the reviewer queue as awaiting review, and confirm it does not count as verified.
3. Approve one and reject one with a reason; confirm the earlier version is kept and the history records who decided.
4. Confirm an expiring document warns and an expired required document stops check-in at both reception and the kiosk.
5. Confirm another site is unaffected by the first site's rules.

## What I will change

Only defects found during the checks. Anything I fix will be named, with the screen it affects. Test records created during the checks are removed afterwards.

## Out of scope

Reminder emails for expiring documents, scheduled expiry checks, an external contractor portal, changes to navigation or visual design, and any new kiosk or contractor features. If the checks show a genuine gap you want closed, that becomes its own slice.
