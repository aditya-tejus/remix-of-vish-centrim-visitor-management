# Phase 8C — Weekly visitor activity report and site email delivery

Two parts: a **Visitor Report** screen at `Reports > Visitor Report`, and an optional
**weekly email** of that same report to named recipients per site.

## Part 1 — Visitor Report screen (no email required)

New route `/reports/visitor-report`, added as a card on the existing Reports page.
Nothing else in navigation moves.

**Week control:** current week by default (Mon–Sun in the site's timezone), with
Previous / Next week buttons and a "Custom range" option limited to 31 days.

**Site control:** users with more than one site get a site picker defaulting to the
current site; single-site users see the current site only, no picker.

**Table:** one row per accountable person per visit — a companion is its own row.
Columns:

1. Name
2. Person type
3. Role — "Main visitor" or "With <primary name>"
4. Arrived — date and time
5. Destination — resident visited, or work location / area for contractors
6. Left — time, or "Still on site", or "No sign-out recorded"
7. Record — blank for canonical, "Older record" for legacy fallback
8. Screening — only for users with `screening.view`: Clear / Needs attention / Blocked.
   Never the answers, never a health value.

Search by name, filter by person type and by "no sign-out recorded". Totals above the
table: people, visits, still on site, missing sign-outs.

**Export:** CSV via the existing export path, and a print-friendly layout (browser
print to PDF) with site name, week, timezone and generated-at stamp. Both are gated on
`data.export`; the screen itself on `presence.view`.

Dates render in the site's regional format (AU/UK both `dd MMM yyyy`, 12-hour time per
the existing convention) using the site's `timezone` column, falling back to the
browser timezone with a visible note when it is not set.

## Part 2 — Weekly email delivery

**Prerequisite that blocks this part:** this project has no sender domain configured, so
no email can be sent today. Part 2 ships only after the customer sets up a domain they
own. Part 1 is built first and is fully useful without it. No screen will ever show a
send as successful unless the provider accepted it.

Once a domain exists:

- **Settings per site:** enable/disable, recipient list (add/remove, each address
  confirmed as an operational recipient), send day (default Monday), send time (default
  08:00 site time), timezone shown read-only from the site.
- **Send now** button sends the previous full week to the configured recipients and is
  recorded exactly like a scheduled send.
- **Email body:** site name, week, totals, and the same table minus the screening
  column by default. A per-site switch can include a screening *status* column only;
  answers, temperatures and vaccination detail are never included. A line states the
  email contains personal information and is for named staff only.
- **Delivery record:** every attempt writes site, week, recipients, status
  (sent / failed / skipped-duplicate), provider message id and error text.

## Technical section

**Data.** Canonical `visit_parties` joined to `visits` is authoritative; legacy
`visitors` rows are used only where no canonical visit exists and are flagged as older
records. Reuse `buildAccountableRows` composition and add a pure
`src/lib/weeklyReport.ts` that turns a week window plus rows into report rows —
so screen, CSV and email render from one function.

**Reads.** One security-definer RPC `weekly_visit_report(site_id, from, to)` returning
already-site-scoped rows, so the email job and the screen use identical data. The
screen may also read through existing hooks; the RPC exists because the scheduled job
runs without a user session.

**New tables (additive, public schema, GRANTs + RLS on each):**

- `report_subscriptions` — one row per site: enabled, send_dow, send_time,
  include_screening_status, created/updated by.
- `report_recipients` — subscription id, email, added by, active.
- `report_sends` — subscription id, site id, week_start, week_end, status,
  recipient_count, provider_message_id, error, sent_at.
  Unique on `(site_id, week_start)` for scheduled sends — this is the duplicate guard.
  Manual test sends are marked `is_manual` and excluded from that constraint.

Read access to all three requires `settings.administer`; sends are written only by the
service role inside the job.

**Job.** An edge function `send-weekly-visit-report` runs hourly and sends for any site
whose local day/time has just passed and which has no scheduled send row for that week.
It inserts the `report_sends` row first (unique index makes a concurrent second run a
no-op), then sends, then updates status. A failed send is retried on the next hourly
run up to 3 times, then left as failed and visible in settings. Email goes through
Lovable's own email infrastructure (queue + templates), not a third-party account, and
not through Outlook — the Outlook connector would send from one person's mailbox, which
is wrong for a site notification.

**Audit.** Enabling/disabling, recipient changes, schedule changes, manual sends and
send outcomes each write an `audit_log` entry with the acting user and site.

**Retention.** `report_sends` keeps status metadata only — never the report body, never
recipient personal data beyond the email addresses in `report_recipients`. Rows older
than 12 months are purged by the existing cleanup function.

**Rollback.** Part 1 is a new route only. Part 2 disables by turning subscriptions off;
dropping the three tables and the function removes it with no effect on visits.

## Defaults chosen

Week Mon–Sun, current week default; custom range max 31 days; screen needs
`presence.view`, export needs `data.export`, email settings need `settings.administer`;
send Monday 08:00 site time; screening status excluded from email by default; retries 3;
Lovable email infrastructure as the provider; page size 100 with "Show more".

## Acceptance criteria

- Companions appear as their own rows with "With <primary name>" and their own times.
- A person still on site shows "Still on site"; a past visit with no sign-out shows
  "No sign-out recorded" — the two are never conflated.
- Switching site never shows another site's people; the RPC rejects a site the user
  cannot access.
- An empty week renders a plain "No visits recorded for this week" state, and the email
  for an empty week still sends with a zero summary.
- Legacy rows are marked "Older record".
- Running the job twice for the same site and week sends once.
- A user without export permission sees the table but no CSV or print action.
- A user without `screening.view` never sees the screening column, on screen or in CSV.
- No screen or log claims a send succeeded unless the provider accepted it.

## Tests

Unit tests over `weeklyReport.ts`: week boundaries across a timezone, companion rows,
missing vs still-on-site, legacy marking, site isolation, empty week, screening
gating, CSV shape. Plus a duplicate-send test against the unique constraint, an
unauthorised-site RPC test, and an email preview render test. Then typecheck, build,
full test run and an authenticated live check of the report screen.

## Out of scope

Kiosk device binding; contractor document verification; seed data; navigation or broad
UI redesign; historical reconciliation apply; any change to the profile pages.
