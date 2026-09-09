# Phase 8D — Provisioned kiosk device binding

Today a kiosk decides which site it belongs to from `?site=<id>` in the address bar,
remembered in browser storage (`kioskSiteId()` in `src/contexts/OperatingContext.tsx`),
and every kiosk server function takes the site as a plain argument it trusts. Anyone who
edits the address can point a kiosk at another site, and clearing the browser detaches it.

This phase replaces that with a device that is **provisioned once by an administrator**
and then proves who it is on every request.

## How it will work for staff

**Provisioning (Settings > Kiosk devices).** An administrator adds a device: friendly
name (e.g. "Main entrance tablet"), site, optional note. The screen shows a one-time
activation code (12 characters, grouped for reading aloud) valid for 15 minutes,
displayed once with a copy action. The code is never shown again; only a hashed form is
stored.

**Activation (on the kiosk).** An unbound kiosk shows "This device is not set up yet"
with a code entry pad. On a correct code the server issues a long-lived device token,
marks the code used, and the kiosk stores the token in the safest place available. From
then on the kiosk opens straight into its bound site with the site name always visible in
the footer. No staff login is needed for visitor check-in or check-out.

**Managing devices.** The list shows each device: name, site, status (active / suspended /
revoked / awaiting activation), last seen, app version, and last check-in performed.
Actions: rename, rotate credential, suspend and resume, revoke, and "Replace device"
(revoke + issue a fresh activation code in one step). Multiple kiosks per site are normal.

**Re-provisioning.** A kiosk cannot change site by itself. Changing site means an
administrator revokes it and issues a new code — the kiosk then shows the not-set-up
screen again.

## Failure states (each an explicit kiosk screen, Lucide icon plus text)

| Situation | Kiosk shows |
| --- | --- |
| No credential yet | "This device is not set up yet" + code entry |
| Revoked or suspended | "This kiosk has been turned off. Please ask a staff member." — no visitor actions |
| Expired credential | Same message plus "needs setting up again" |
| Code already used / wrong / expired | Inline "That code cannot be used. Ask an administrator for a new one." |
| Offline | Existing offline queue continues; banner "Working offline — records will be sent when the connection returns" |
| Site mismatch (URL says another site) | Address parameter is ignored entirely; bound site is shown |
| Clock skew | Server decides all expiry; the kiosk never validates time itself |

## Technical section

### Data model (additive, public schema, GRANTs + RLS on each)

- `kiosk_devices` — `id`, `branch_id` (not null), `name`, `status`
  (`pending`/`active`/`suspended`/`revoked`), `token_hash`, `token_prefix` (first 8 chars,
  for display only), `token_issued_at`, `token_expires_at`, `last_seen_at`,
  `last_seen_version`, `created_by`, `revoked_by`, `revoked_at`, timestamps.
- `kiosk_activation_codes` — `id`, `device_id`, `code_hash`, `expires_at`, `used_at`,
  `used_ip_hash`, `created_by`, `attempts`.
- `kiosk_device_events` — append-only: `device_id`, `branch_id`, `event`
  (`provisioned` / `activated` / `activation_failed` / `rotated` / `suspended` /
  `resumed` / `revoked` / `replaced` / `auth_failed` / `heartbeat`), `actor_user_id`,
  `detail jsonb`, `created_at`.

Grants: `authenticated` reads devices and events, `service_role` full. No `anon` grant
anywhere — the kiosk never reads these tables directly, only through functions. RLS:
device and event reads require `settings.administer` **and** `user_can_access_site`;
writes only through the definer functions below.

Secrets are stored hashed with `pgcrypto` (`crypt`/`gen_salt('bf')`), matching the
existing `kiosk_security` PIN pattern. Full token and full activation code exist in
memory only during the call that creates them.

### Server functions (security definer, mirroring existing `kiosk_*` patterns)

- `kiosk_provision_device(p_branch_id, p_name)` → device id + one-time code. Requires
  `settings.administer` and site access.
- `kiosk_activate(p_code, p_device_label)` → device token, site id, site name. Callable
  by `anon`. Marks the code used inside the same transaction (a second attempt fails).
- `kiosk_device_context(p_token)` → site id, name, status, jurisdiction. Called on kiosk
  start and on resume; updates `last_seen_at`.
- `kiosk_rotate_token(p_device_id)`, `kiosk_set_device_status(p_device_id, p_status)`,
  `kiosk_replace_device(p_device_id)` — all `settings.administer` + site access.
- A shared internal `kiosk_resolve_device(p_token)` returns the site id or raises. **Every
  existing kiosk function gains a `p_device_token` argument** and derives `p_branch_id`
  from it, ignoring any client-supplied site: `kiosk_check_in`, `kiosk_check_out`,
  `kiosk_presence_list`, `kiosk_resident_directory`, `kiosk_staff_directory`,
  `kiosk_supplier_directory`, `kiosk_returning_lookup`, `kiosk_contractor_lookup`,
  `kiosk_watchlist_check`, `kiosk_resident_leave`, `kiosk_resident_return`,
  `kiosk_prefill_visitor`, `kiosk_open_key_holds`, and the emergency family.

Rate limiting: activation attempts capped at 5 per device and 20 per hour per source
(counted in `kiosk_activation_codes.attempts` and `kiosk_device_events`); failed token
resolution capped likewise, each failure logged as `auth_failed`. No edge function is
needed — all of this is database-side, consistent with the existing kiosk design.

### Client

- `src/lib/kioskDevice.ts` — token storage. Preference order: IndexedDB (survives
  storage-clear prompts less often than localStorage but is the best broadly supported
  option), falling back to `localStorage`. The token is opaque; losing it means
  re-provisioning, which is the intended safe failure. Non-extractable WebCrypto key
  material is noted as a later hardening step, not built now.
- `src/contexts/KioskDeviceContext.tsx` — resolves the device on kiosk start, exposes
  `{ deviceToken, siteId, siteName, status }`, heartbeats every 10 minutes.
- `kioskSiteId()` is removed; `OperatingContext` takes the site from the device context
  for `/kiosk/*` routes and from `SiteContext` for staff routes. The `?site=` parameter is
  ignored on kiosk routes.
- Kiosk hooks pass `p_device_token` instead of `p_branch_id`.
- New screens: `KioskActivation.tsx` (code entry, reusing the `KioskPinPad` visual
  language) and a device-blocked state in `KioskErrorState.tsx`.
- `src/components/settings/KioskDevicesCard.tsx` — device list and actions, added to the
  existing kiosk settings section. No navigation change.

### Behaviour of kiosk-originated records

Unchanged in substance, correctly attributed in origin:

- **Privacy** — acknowledgements recorded against the bound site, `device` set to the
  device name instead of a generic "Kiosk".
- **Screening** — same configured questions and outcomes; no override on the kiosk, as now.
- **Companions** — created as canonical parties exactly as today, under the bound site.
- **Badges** — printing follows the site setting; the device name appears in the audit entry.
- **Emergency attendance** — the staff PIN path is unchanged, but the roll call is now
  scoped by the bound device rather than a passed site id.

### Audit

Every provision, activation, activation failure, rotation, suspend/resume, revoke,
replace and kiosk configuration change writes both a `kiosk_device_events` row and an
`audit_log` entry with the acting user and site. Token values never appear in either.

### AU/UK separation

Devices are bound to a site, and a site already carries its jurisdiction and pack, so an
AU device can never resolve UK configuration. Nothing about server separation changes.

## Defaults chosen

Activation code 12 characters, single use, 15-minute expiry; device token 256-bit random,
365-day expiry with a warning in settings from 30 days out; heartbeat every 10 minutes;
5 activation attempts per code; devices per site unlimited; provisioning and management
require `settings.administer`; revoked devices keep their history and are shown greyed in
the list rather than deleted.

## Acceptance criteria

- A kiosk with no credential offers only activation — no visitor action is reachable.
- Editing `?site=` on an activated kiosk changes nothing; the bound site stays.
- Clearing browser storage returns the kiosk to activation, never to another site.
- The same activation code cannot be used twice; the second attempt is logged and refused.
- A revoked or suspended device is refused server-side within one call, even if the token
  is replayed from another machine.
- Check-in performed on a device writes the bound site, whatever the client sends.
- The full token and full code appear exactly once, at creation, and are never re-readable.
- Two kiosks at one site operate independently, each with its own last-seen.
- A user without `settings.administer` cannot see or manage devices.
- No screen shows a device as active unless the server said so.

## Tests

Pure tests over token storage and the device context reducer (unbound, active, suspended,
expired, offline). Database tests: activation happy path, replay refused, expired code,
revoked token refused, cross-site token cannot read another site's presence, site derived
from token overrides a spoofed argument, rate limit trips, audit rows written. Plus
typecheck, build, full suite and a live activation-then-check-in run.

## Rollback

All tables and functions are additive. The updated kiosk functions keep `p_branch_id`
accepted but ignored for one release, so an unmigrated kiosk fails closed rather than
crossing sites. Rolling back means restoring `kioskSiteId()` and dropping the three
tables; no visit data is affected.

## Out of scope

Weekly email delivery; contractor document verification queue; seed data; navigation or
broad UI redesign; historical reconciliation apply.
