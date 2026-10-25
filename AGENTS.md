# Architecture rules

- Keep kiosk screening and returning-detail projection in `src/lib/kioskPrivacy.ts` as pure tested rules; server RPCs remain responsible for verification and site isolation.
- Returning kiosk v2 RPCs return an explicit server-computed verification flag; names alone never unlock contact, destination, reusable QR or visit metadata, including through compatibility RPCs.
- Person-type configuration resolves explicit site choices before account choices before defaults; default changes must not rewrite saved administrator choices.
- External-message audit events describe intended recipients and actual delivery state, not delivery success; legacy audit rows remain unchanged.
- Keep emergency evidence/counting in `src/lib/emergencyPolicy.ts`; legacy statuses never establish physical verification, and server triggers enforce method, site, permission and closed-event guards.
- Emergency offline replay carries outcome/method/time and operator UUID without personal record details; never replay evidence under a different signed-in operator.
- Shared visual roles live in global CSS/Tailwind tokens and existing UI primitives; reception-primitives contains presentation-only action/metric/attention/kiosk pieces, so no workflow or data logic is duplicated.
- Self-host font weights through package CSS imports so reception and kiosk typography works without a remote font request.
- Ordinary staff arrivals use `checkin/CheckInSheet` and `useCheckInFlow` with staff-only readiness rules; keep group organiser consent and resident movement separate until parity is established, so one reception entry cannot bypass another entry's requirements.