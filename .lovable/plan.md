# Keys Register completion and repeat-visitor verification

Most of this is already built. Confirmed in the project today:

- A Keys Register page exists under Visitor Management in the left menu, with colour-coded status, grouping by property/resident, issue and return actions, and a full history of who issued which key to whom.
- The keys tables are staff-only (no public access) and issuing/returning is an authenticated staff action.
- The kiosk repeat-visitor pieces are wired: recognise by mobile, personal card code and name, the "visited last time" suggestion, the reworked companions step, and the permanent personal code saved with the visit.

So the remaining work is the one genuinely missing piece, plus a live check of the kiosk journey.

## 1. Show key holding on a visit record

Today a key issue can be linked to a visitor, but the visit itself gives no hint that this person is holding a key.

- On the visit record (visitor profile and the visit list row), show a small "Key issued" marker whenever that person currently holds an unreturned key, with the key label and due-back time.
- From a checked-in contractor or visitor, add an "Issue key" action that opens the same issue form used on the Keys Register, pre-filled with that person.
- Clicking the marker opens that key on the Keys Register.
- At staff checkout, if the person still holds a key, show a clear warning with two choices: record the return now, or note why it is staying out. Checkout proceeds either way and the outstanding key stays flagged.

No new key status is stored on the visit — it is read live from the keys register, so it can never drift out of sync.

## 2. Walk the kiosk as a repeat visitor

Run the full journey in the live preview and confirm each point, then report back with what happened:

- Type a returning visitor's name and see their saved details fill in after leaving the surname box.
- Confirm the "here to see ..." one-tap suggestion appears and selects the right resident.
- Choose "yes" then "no" on companions, add and remove a companion, and step back and forward to confirm nothing gets stuck.
- Finish check-in and confirm the visit is saved with the same permanent personal code as last time, and that the code shows on the success screen.

Anything that misbehaves gets fixed in the same pass.

## Technical notes

- New shared hook read of open `key_issues` by `visitor_id`, surfaced in `VisitorProfile`, the visit list row, and `CheckOutSheet`.
- Reuse the existing issue/return dialogs from `KeysRegister.tsx` by lifting them into a shared component rather than duplicating.
- Kiosk walkthrough via Playwright against localhost, checking the saved row's `person_qr`, `group_id` and companion records.
