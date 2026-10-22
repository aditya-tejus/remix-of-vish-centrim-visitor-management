# Architecture rules

- Keep kiosk screening and returning-detail projection in `src/lib/kioskPrivacy.ts` as pure tested rules; server RPCs remain responsible for verification and site isolation.
- Returning kiosk v2 RPCs return an explicit server-computed verification flag; names alone never unlock contact, destination, reusable QR or visit metadata, including through compatibility RPCs.
- Person-type configuration resolves explicit site choices before account choices before defaults; default changes must not rewrite saved administrator choices.
- External-message audit events describe intended recipients and actual delivery state, not delivery success; legacy audit rows remain unchanged.