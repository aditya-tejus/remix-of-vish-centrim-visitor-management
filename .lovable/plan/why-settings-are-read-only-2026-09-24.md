# Why settings are read only

## Cause (checked)
Settings can only be changed by an administrator. You just created a new account, **info@ecaret.com.au**. New accounts start as **staff**, and staff can look at settings but can't change them. That's why every control is greyed out and marked "Read only".

Current accounts:
- vishnu@centrimlife.com.au — administrator (can edit)
- vishnu@ecaret.com.au — staff (read only)
- info@ecaret.com.au — staff (read only)

## Fix
1. Make **info@ecaret.com.au** an administrator. Keep its staff role as well.
2. Leave the other accounts as they are, unless you want vishnu@ecaret.com.au made an administrator too.
3. Record the change in the audit log (actor, account, new role).
4. Sign in again or refresh, then check that Settings can be edited.

No app screens change. New sign-ups still start as staff, so nobody can give themselves administrator access.

## Technical details
- One-off data change: insert `user_roles (user_id, 'admin')` for that user, plus a matching `audit_log` entry.
- `useAuth` reads the first role alphabetically, so `admin` is picked ahead of `staff`.
