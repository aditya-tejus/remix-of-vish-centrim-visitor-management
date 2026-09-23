# Automatic sign-out: a set time each day

Automatic sign-out becomes one simple rule: anyone still signed in at the site's chosen closing time is signed out. The "after X hours" and "whichever comes first" options are removed.

## What changes for reception and administrators

Settings > Visitors / Contractors / Volunteers / Staff > Automation:

- Switch: Sign people out automatically
- One choice: **Closing time** — picked from times on the hour (e.g. 6:00 pm, 8:00 pm, 10:00 pm, 11:00 pm)
- Plain-language summary, e.g. "Contractors still signed in at 10:00 pm are signed out automatically."

Removed from the card: the rule dropdown and the hours-on-site choice.

Residents are still never included. Each site's own local time is used, so an Australian site and a UK site each close off at their own 10:00 pm.

Times on the hour only: the background check runs hourly, so a whole-hour closing time is acted on within minutes instead of drifting up to an hour late. The card no longer needs the "up to an hour later" caveat; it will say the check runs shortly after the closing time.

## Behaviour

- At the site's closing time, anyone still signed in of that person type is signed out.
- Anyone left over from an earlier day is also closed off (unchanged).
- Someone who signs in after the closing time is not signed out that night; they are closed off at the next day's closing time.
- Records are marked "Signed out automatically" with the reason "Signed out automatically at end of day (10:00 pm)", and each run writes an audit entry — all unchanged.

## Existing saved rules

Any site currently set to "after X hours" or "whichever comes first" is treated as end-of-day using its saved closing time (default 10:00 pm). Nothing is switched on or off; an enabled rule stays enabled.

## Technical notes

- Migration on `public.auto_checkout_rules`: convert `mode` values `hours` and `either` to `end_of_day`, set the `mode` default to `end_of_day` and constrain it to that single value (column kept for forward compatibility), drop the `hours` column, and round any `end_of_day_time` with non-zero minutes down to the hour.
- `src/lib/autoCheckout.ts`: drop `AutoCheckoutMode` variants and `HOUR_CHOICES`/`hours`; `isDueForAutoCheckout` keeps only the end-of-day branch; `describeRule` and `reasonForRule` simplify to the single sentence. Add an `END_OF_DAY_CHOICES` list of whole-hour times.
- `supabase/functions/auto-checkout/rules.ts`: same simplification, kept in parity.
- `supabase/functions/auto-checkout/index.ts`: stop selecting/passing `hours` and `mode` branching; audit details record only the closing time per person type.
- `src/hooks/useAutoCheckoutRules.ts`: drop `hours` and `mode` from the read/upsert payload.
- `src/components/settings/AutoCheckoutRuleCard.tsx`: replace the mode dropdown, hours select and free `type="time"` input with one whole-hour closing-time select; update the info line.
- Hourly `pg_cron` schedule (`0 * * * *`) stays as is.
- `src/test/autoCheckout.test.ts`: remove hours/either cases; keep and extend disabled, site-local closing time across time zones, carried-over prior day, late arrival not closed, resident exclusion, defaults, reason text and description. Run the full suite, typecheck and build, then an authenticated live check that a seeded overstay closes at the configured time and is labelled.
