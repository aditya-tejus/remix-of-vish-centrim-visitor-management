# Automatic sign-out

Some facilities want people who forget to sign out to be closed off automatically, rather than sitting on the on-site list overnight. This adds that as a setting each site controls, and makes every automatic sign-out clearly visible on the record.

## What exists today

- A per-visitor-type "Automation" panel in Settings already shows an on/off switch and an "after X hours" choice, but it saves to one shared account-wide list, so every site gets the same rule.
- A background job file exists in the project but is not scheduled to run, so nothing is signed out automatically today.
- Visit records already have a "reason for sign-out" field, but nothing marks a sign-out as automatic.

## What will be built

**1. The setting (Settings > each visitor type > Automation)**

Per site, per visitor type (Visitor, Contractor, Volunteer, Staff):

- Switch: Sign people out automatically
- Rule: **After a set number of hours** (4 / 8 / 12 / 24) or **At the end of the day** (a time the site picks, e.g. 10:00 pm) or **Whichever comes first**
- Plain-language summary line showing exactly what will happen, e.g. "Contractors still signed in after 12 hours, or at 10:00 pm, are signed out automatically."

Residents are excluded entirely — the Automation panel on Resident Settings will not offer this, because a resident living on site is not an overstay.

Each site's own time zone is used for the end-of-day time, so an Australian site and a UK site each close off at their own local time.

**2. The automatic sign-out itself**

An hourly background check looks at each site, applies that site's rules per visitor type, and signs out anyone still on site past the rule. It never touches residents, and it never changes an already closed visit. Companions on a visit are closed off with the visit so the on-site count stays honest.

**3. How it is recorded**

- The visit is marked as signed out automatically, with the rule that caused it ("after 12 hours" / "end of day 10:00 pm").
- The Visit List row and the visitor profile show "Signed out automatically" next to the time instead of a plain sign-out, so staff never mistake it for an observed departure.
- Each run writes an audit entry with the site, the rule, the number of records and who/what performed it (the system).

## Not included

Notifications or emails about automatic sign-outs, changes to kiosk behaviour, contractor verification, or any visual redesign.

## Technical notes

- New table `public.auto_checkout_rules`: `branch_id`, `person_type`, `enabled`, `mode` (`hours` | `end_of_day` | `either`), `hours`, `end_of_day_time`, timestamps, unique on `(branch_id, person_type)`. Grants for `authenticated` + `service_role`; RLS: read for users with site access, write gated on `has_permission('settings.administer')` and `user_can_access_site`. A `resident` row is rejected by check constraint. Existing flat `auto_checkout_*` settings keys are read once as the seed value for a site's first save, then left alone.
- `public.visitors`: add nullable `auto_checked_out boolean default false` and reuse existing `checkout_reason` text for the rule description. No backfill.
- Rewrite `supabase/functions/auto-checkout/index.ts` to loop branches (using `branches.timezone` and `jurisdiction`), read rules, compute cutoffs per person type, update matching `visitors` rows (`status='checked-out'`, `check_out_time`, `auto_checked_out=true`, `checkout_reason`), close the matching `visits`/`visit_parties` attendance rows the same way, and write one `audit_log` entry per site run via `log_audit`. Batched and idempotent; a second run in the same hour finds nothing.
- Schedule hourly with `pg_cron` + `pg_net` (`0 * * * *`). Hourly is the least frequent cadence that still honours an end-of-day time within an hour; the worst-case delay is 59 minutes.
- Settings UI: replace the auto check-out block in `AutomationSettingsPerType.tsx` with the new site-scoped rule editor (Lucide icons, read-only fence honoured). `AutoCheckoutTab.tsx` and the auto-checkout block in `AutomationTab.tsx` (both unreachable) are removed to avoid a second place to set the same rule.
- Display: `statusPresentation.ts` / `VisitorTable.tsx` / `VisitorProfilePage.tsx` show the automatic marker.
- Tests: pure cutoff logic (hours, end-of-day across time zones, either-mode), resident exclusion, rule resolution defaults, and record marking. Full suite, typecheck, build, plus an authenticated live check that a seeded overstay is closed off and labelled.
