# Phase 7E Hardening — honest settings gating, storage labels and save results

Review of the delivered Phase 7E work against the build request. Three gaps are confirmed by reading the code and the database, and this plan closes them without new permissions, schema, policy or value migration.

## What the review confirmed

1. **Only one screen actually enforces permission.** The page header explains who may change a section, but of the live screens only Visitor types (and the existing privacy and permissions cards) check anything. Operating context still gates on `role === "admin"` directly; Presence, Badges and printing, Keys and fobs, Integrations, Governance, Kiosk code and every per-visitor-type screen render fully editable controls for anyone who can open Settings. The header therefore says "read-only" while the controls underneath still work.
2. **Saves can report success after a failure.** Badges and printing, Governance and Integrations save each value in a loop and throw the result away, then always show "saved". Presence saves the occupancy values in a loop and reports one combined error without saying which value failed or keeping the screen in a retry state.
3. **Some storage labels are wrong.** Presence and Keys and fobs are labelled "Saved for this site", but both write plain keys shared by every site. The per-visitor-type sections are labelled "some per site, others account-wide"; in fact almost all of those values are account-wide, set separately per visitor type. Only Visitor types (site-suffixed with an account-wide fallback) and Operating context (on the site record) match their current labels.
4. **Previews read saved values only.** The preview panel calls the same data hooks as the rest of the app, so it shows what is saved, not what is typed. Nothing pretends otherwise today, but the panel does not say so either.

Also confirmed, and important to state honestly: the database allows settings writes only to the **administrator role**. The granular permission checks in the app are a clarity and safety gate on top of that; they are not what stops a write. The plan will not claim the app-level gate is the security boundary.

## What will change

### A. One shared read-only fence

Add a small settings access context. The Settings page resolves the permission for the open section once and provides it. A `ReadOnlyFence` wrapper renders the section inside a disabled native fieldset when the person may not edit, so every nested control — switches, inputs, selects, save buttons, dialog triggers — is disabled at once, with a single clear explanation at the top. Values stay visible.

Screens that own a save button also read the context directly, so their save button is disabled with a reason rather than only visually inert.

### B. Truthful saves

For Presence, Badges and printing, Governance and Integrations: collect the result of every write, and if any fails keep the typed values, show which part failed in plain language, and offer "Try again". Show "Saved" only when every value was written. This mirrors what Visitor types already does. No change to what is saved.

### C. Accurate storage labels

Correct the storage note for Presence, Keys and fobs, the five per-visitor-type sections, Compliance and Audit so each says what actually happens ("Shared across all sites", "Set separately for each visitor type and shared across all sites", "A record, not a setting"). Remove wording that implies inheritance where none exists. No stored value changes.

### D. Preview honesty (deliberately small)

Full draft preview for every screen would mean lifting the state of twenty separate editors and is out of proportion for a hardening pass. Instead:

- Visitor types already refreshes the preview after saving; extend that to a live draft for **that screen only**, since it already holds all its rows in one place.
- Every other preview gains a plain line: "Shows your saved settings. Save to see changes here."

The limitation is documented rather than hidden.

## Files to change

| File | Change |
| --- | --- |
| `src/hooks/useSettingsAccess.ts` | Add a provider/consumer pair so children read the same result; permission map unchanged except the corrections below |
| `src/components/settings/ReadOnlyFence.tsx` | New: disabled-fieldset wrapper with the explanation |
| `src/pages/Settings.tsx` | Wrap each section in the fence; correct `STORAGE_NOTE`; pass the draft into the preview for Visitor types |
| `src/components/settings/OperatingContextTab.tsx` | Replace the direct `role === "admin"` check with the section permission |
| `src/components/settings/PresenceTab.tsx` | Permission-gated save; per-value error, retry, kept values |
| `src/components/settings/PrintingTab.tsx` | Same |
| `src/components/settings/LockGovernanceTab.tsx` | Same |
| `src/components/settings/IntegrationTab.tsx` | Same |
| `src/components/settings/KeysPolicyTab.tsx` | Permission-gated save (error handling already correct) |
| `src/components/settings/KioskStaffPinCard.tsx` | Permission-gated save |
| `src/components/settings/PersonTypesTab.tsx` | Drop the `role === "admin"` bypass; publish its draft rows to the preview |
| `src/components/settings/preview/*.tsx` | Accept optional draft rows; add the "shows saved settings" line where no draft exists |
| `src/components/settings/SettingsNav.tsx` | Scope badges corrected to match the storage notes |
| `roadmap.md`, `docs/SECURITY_REVIEW.md` | Record the gate, its real boundary, the preview limitation and the remaining audit gap |

Not touched: the ten unused files, database, policies, permissions, stored values, Phase 7A–7D screens.

## Permission by live section (all existing, none added)

| Section | Permission | Note |
| --- | --- | --- |
| Operating context, Visitor types, Visitors, Contractors, Volunteers, Staff, Resident movements, Presence and emergency, Badges and printing, Feedback surveys, Governance, Integrations | `settings.administer` | Database still requires the administrator role |
| Keys and fobs | `keys.manage` | Narrower permission kept |
| Privacy and retention | `privacy.manage` | Existing card check kept |
| Users and access | `settings.administer` | Existing card check kept |
| Audit and exports | read-only screen; export stays behind `data.export` | Nothing is saved here |

## Controls that cannot be fully gated in this pass

- Anything a screen opens in a pop-up **after** the trigger is disabled is unreachable, so the fence covers it; but a screen that opens a dialog from code rather than a button would not be covered. None found in Settings today; this is stated as a known boundary.
- Drag-to-reorder in the question and field managers is not a form control. The fence disables the surrounding controls; reordering will be blocked explicitly in those three managers rather than relying on the fieldset.
- The kiosk code card writes through a database function; the app gate is presentational only, as with everything else here.

## Acceptance tests

1. Every live section opens; an administrator can still change and save each one exactly as before.
2. **Restricted-account test:** with your approval, sign in as a second, non-administrator account and walk the sections. Expected: values visible, every control disabled, one clear explanation, no save possible by clicking. If you would rather not use a second account, the fallback is a temporary staff-role session created only for the test and ended immediately, and the result will be reported as such.
3. Forced failure on each rewritten save: error shown, typed values kept, "Try again" works, no false "Saved".
4. Partial failure (one value rejected): message names what failed; no success message.
5. Storage labels match reality: change a value at one site and confirm the other site does or does not see it, exactly as the label claims.
6. Visitor types draft preview updates as you type and is clearly marked as unsaved.
7. Other previews show the "saved settings" line and no stale claim.
8. Regression: reception, kiosk, badge printing, emergency roll call, food register, contractors unchanged; tablet width has no sideways scroll; typecheck, build, and the linter still at 47 documented warnings.
9. No test data or changed settings left behind; verified by query.

## Risks

- The disabled-fieldset approach touches every settings screen at once; a mistake shows up as controls disabled for administrators. Test 1 is the guard.
- Correcting labels will make some settings visibly account-wide that people may have assumed were per-site. That is the honest position; migrating them to per-site storage is a separate, larger decision.
- Dropping the `role === "admin"` bypass on Visitor types means an administrator without `settings.administer` in the permission table would lose edit access in the app. Worth confirming the administrator role holds that permission before the change lands; the plan's first step is that check.

## Open questions

1. Are you comfortable with a temporary non-administrator session for the read-only test, or should that test be reported as code-verified only?
2. Should per-visitor-type settings eventually become per-site, or is account-wide the intended behaviour? Not changed in this pass either way.
3. Should the remaining unaudited settings screens start writing history entries now, or is that a separate piece of work?

## Non-goals

No new permissions, tables, policies or settings keys. No value migration. No deletion of the unused files. No external integrations, notification delivery or printer hardware. No Phase 7F work.
