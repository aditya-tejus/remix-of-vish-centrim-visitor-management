# Slim down the "Been here before?" panel on the kiosk

## The problem

On the details screen, the returning-visitor panel is a full bordered card with a
heading, an explanation line, a mobile field with a "Find me" button, a card-code
field with its own button, and sometimes a "we couldn't find you" line. On a kiosk
screen it pushes the actual name fields below the fold, so most people — who are
first-timers — scroll past a block that isn't for them.

## The design principle

The fast lane should be an **offer, not a gate**. It should occupy one line until
someone taps it, and it should never compete visually with the form people
actually have to fill in.

## What changes

1. **Collapsed by default — one tappable line.**
   Replace the card with a single full-width row: a small refresh icon plus
   "Been here before? Tap to find your details" and a chevron. Roughly 56px tall,
   quiet styling (muted background, no heavy border), sitting directly above the
   name fields.

2. **Expands in place when tapped.**
   Tapping opens a compact panel with one input at a time, not two stacked pairs:
   - If both lookup options are on, show one input with a small segmented toggle
     above it: "Mobile" / "Visitor card". One field, one large "Find me" button
     underneath at full width (easier to hit than a side-by-side button).
   - If only one option is on, no toggle — just the field and the button.
   - A "Skip, I'll type my details" text button collapses it again.

3. **The panel disappears once it's done its job.**
   After a successful match, the collapsed row and the panel both go away; only
   the confirmation stays. After a failed lookup, show the "couldn't find you"
   line inside the panel and auto-collapse it after the person starts typing
   their first name, so it stops taking space.

4. **Tighter match confirmation.**
   Keep "Is this you?" but reduce to name (large), mobile, and last resident on
   one wrapped line — drop the email row. Buttons stay full-width and 56px.

5. **Slimmer "welcome back" strip.**
   Once details are pre-filled, replace the bordered success box with a single
   line of small green text with a tick — no border, no card padding.

Net effect: the details step opens with the name fields visible without scrolling
for everyone, and returning visitors still get a one-tap shortcut.

## Technical notes

- All changes are contained in `src/pages/kiosk/KioskCheckIn.tsx`, in the
  `step === "details"` block (the fast lane, match confirmation, and welcome-back
  strip). No changes to `useKioskCheckInFlow.ts`, the lookup RPC, or settings.
- Add local state `fastLaneOpen` and `lookupMode: "mobile" | "code"` (initialised
  to whichever option is enabled first).
- Existing behaviour preserved: `flow.returningOptions.mobile/qr` still control
  which options appear; if both are off the row is not rendered at all.
- Touch targets stay at kiosk sizes (h-14 inputs/buttons); styling uses existing
  semantic tokens and rounded-xl/2xl radii.
