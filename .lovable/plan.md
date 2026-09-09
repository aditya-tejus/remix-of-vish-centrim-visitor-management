# Phase 7A closure — remaining behavioural verification

Verification only. No feature work, no schema, permission, policy or server-function changes, no Phase 7B. All tests use temporary records created and removed within the same pass, on one site only, so site isolation and privacy are unaffected.

## Can a failure be simulated safely today?

There is no built-in failure switch, and adding one to production code would be wrong. Both the save path and the checkout path in the visitor hook do a single network write and handle the error (check-in surfaces a failed save and keeps entered data; checkout rolls the row back and raises "check-out-not-saved").

Safe approach: block the write at the browser level in the test script only, using Playwright request interception to fail the specific outgoing call (the visitor insert for save, the visitor update or the checkout function call for checkout). Nothing in the app changes, no data is written, and the interception disappears when the test browser closes. This is the standard way to exercise these paths and is the approach proposed below.

## Test matrix

### 1. Returning-visitor lookup
- Setup: create one temporary visitor through the normal front-desk check-in and check them out, so they exist as a past visitor with a mobile number.
- Action: start a new check-in, use the returning-visitor lookup with that mobile number (and separately by name), confirm the match.
- Expected UI: the match is offered, requires explicit confirmation, and only then prefills name and contact details; no unrelated person is offered; nothing prefills before confirming.
- Expected data: a second visit record for the same person, on the same site, with today's check-in time; no duplicate person record.
- Cleanup: remove both temporary visits and the person record.
- If it fails: fix in the lookup and prefill code only — no schema change.

### 2. Companion leaving independently
- Setup: check in one temporary visitor with two companions.
- Action: open checkout for that visitor and choose the option where only one companion leaves.
- Expected UI: the visit stays on the on-site list, the companion count drops by one, wording makes clear who is still on site.
- Expected data: the visitor row stays checked in with no check-out time, remaining companion count reduced by one, companion details updated.
- Then: check out the rest and confirm the visit closes with a check-out time.
- Cleanup: remove the temporary visitor and derived records.
- If it fails: fix in the checkout sheet or companion checkout helper only.

### 3. Forced save failure and retry
- Setup: test script blocks the visitor insert call.
- Action: complete a front-desk check-in and confirm.
- Expected UI: a clear failure message, the sheet stays open, all entered details preserved, a retry action available, no visitor added to the list.
- Then: stop blocking, retry, confirm success.
- Expected data: no record while blocked; exactly one record after retry, not two.
- Cleanup: remove the record created by the successful retry.
- If it fails: fix error handling and retry state in the check-in flow only.

### 4. Forced checkout failure and retry
- Setup: check in a temporary visitor; script then blocks the checkout write.
- Action: check them out.
- Expected UI: a clear failure message, the visitor stays on the on-site list (row restored), retry available.
- Then: unblock, retry, confirm the departure is recorded with a duration.
- Expected data: still checked in while blocked; checked out with a single check-out time after retry.
- Cleanup: remove the temporary visitor and derived records.
- If it fails: fix rollback and retry handling in checkout only.

### 5. Duplicate-submit prevention
- Setup: none beyond a fresh check-in form; optionally slow the network in the test browser so the window between clicks is visible.
- Action: click Confirm twice in quick succession; repeat the same double-click on the checkout confirm action.
- Expected UI: the button becomes unavailable after the first click; one confirmation only.
- Expected data: exactly one visitor record and one set of derived records; exactly one check-out time.
- Cleanup: remove the temporary records.
- If it fails: strengthen the existing in-flight guard in the affected component only.

## Cleanup discipline
Every temporary person is created with a clearly marked test surname, counted before and after, and removed together with derived visit records at the end of the pass. A final count confirms zero test rows remain. Records created by the live user during the session are left untouched.

## Risks
- Test-only request blocking must target the exact call; too broad a block can produce a misleading result. Each blocked run asserts what was blocked.
- Double-click timing can be missed on a fast local machine; network slowing in the test browser makes the result reliable.
- Creating and removing test visitors writes audit entries; these remain by design and are noted rather than deleted.

## Acceptance criteria
All five items pass as described, no duplicate records are produced, no failed request is left unhandled in the interface, typecheck and build stay clean, no production code is weakened for testing, and the results plus any remaining gaps are recorded in the roadmap and security notes.

## Non-goals
Pre-registration, group check-in, QR fast lane, kiosk redesign, notification delivery, reporting changes, and anything in Phase 7B onwards.
