# Supabase Auth SMTP — Setup Runbook

Goal: password-reset and welcome (confirm-signup) emails for Capital OS test users
are delivered from the project's own Gmail sender instead of Supabase's
rate-limited built-in service (which does not actually deliver in new projects).

- Project: `tvekoojdilkjptjzpvqo` — https://supabase.com/dashboard/project/tvekoojdilkjptjzpvqo
- App URL: https://capital-os-nine.vercel.app
- Brand templates: [supabase/templates/reset-password.html](../supabase/templates/reset-password.html),
  [supabase/templates/confirm-signup.html](../supabase/templates/confirm-signup.html)
- Helper script: [scripts/auth-smtp-values.js](../scripts/auth-smtp-values.js)

## Step 0 — Prerequisites (one time)

1. Google account 2FA must be enabled (required for app passwords).
2. Generate a Gmail App Password: https://myaccount.google.com/apppasswords
   - Name it `capital-os-auth`. Copy the 16-char password — you will paste it
     into Supabase. It is NOT stored in the repo or in env files.

## Step 1 — Print your paste-ready values

```bash
node scripts/auth-smtp-values.js
```

This prints Host / Port / Username / Sender values read from `.env.local`
(`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `EMAIL_FROM`).

## Step 2 — Dashboard → Authentication → SMTP Settings

- Toggle **Enable Custom SMTP** ON
- Sender name: `Capital OS` (or the value the script printed)
- Sender email: the address from `EMAIL_FROM` (must match the Gmail account
  that owns the app password, or be a verified alias of it)
- Host: `smtp.gmail.com` · Port: `587` · Username: the Gmail address
- Password: paste the 16-char app password
- Save, then press **Send test email** to your own inbox.

## Step 3 — URL Configuration (same Authentication section)

- Site URL: `https://capital-os-nine.vercel.app`
- Additional Redirect URLs — add:
  - `https://capital-os-nine.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback` (local dev)

Without `/auth/callback` in the allowlist, reset links land on a Supabase
error page instead of the app's `/reset-password` form.

## Step 4 — Templates (optional but on-brand)

Authentication → Emails → Templates:

- **Reset Password** → paste `supabase/templates/reset-password.html`
- **Confirm Signup** → paste `supabase/templates/confirm-signup.html`

Both use `{{ .Email }}` and `{{ .ConfirmationURL }}`. Leaving the defaults is
fine functionally.

## Step 5 — Verify end to end

```bash
node scripts/auth-smtp-values.js --verify
```

The script fires a real password-reset for the QA admin account and a fresh
signup confirmation probe, then tells you what to check:

1. Reset email arrives → custom SMTP confirmed working. Click the link —
   `/reset-password` must render. Change the QA password, change it back.
2. Nothing arrives → Dashboard → Logs → Authentication; filter `error`.
   Typical causes: wrong app password, port 587 blocked on Supabase's side
   (rare), sender email not the Gmail account / unverified alias.
3. Delete the unconfirmed `smtpverify-…` probe user afterwards.

## Ongoing: daily deliverability watchdog

Once SMTP is live, set up the automated check
([.github/workflows/auth-smtp-watchdog.yml](../.github/workflows/auth-smtp-watchdog.yml)):

every day at 07:00 UTC it triggers a real password-reset for a fresh
plus-alias of a QA inbox, IMAP-polls until the message physically arrives, and
opens/updates a GitHub issue (`auth-deliverability` label) if it doesn't —
auto-closing on recovery.

Add these **repository secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (same as `.env.local`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key |
| `WATCHDOG_EMAIL_USER` | Watchdog inbox address (QA Gmail) |
| `WATCHDOG_EMAIL_PASS` | Gmail App Password for that inbox |
| `SUPABASE_ACCESS_TOKEN` *(optional)* | PAT — enables the GoTrue log sweep on failure |
| `SUPABASE_SERVICE_ROLE_KEY` *(optional)* | Mirrors failures into the in-product Email Health timeline |

The probe checks **two legs** per run — password-reset **and** signup
confirmation — each with its own fresh plus-alias, then reports which legs
delivered (`reset_status`, `signup_status`, `failed_legs` outputs). On
failure it opens/updates the `auth-deliverability` issue with leg-level
detail, sweeps GoTrue logs for SMTP errors (when the PAT is set), and writes
an `auth_deliverability_failed` critical event into `email_health_events`
(so it surfaces on the Email Health dashboard). Recovery auto-closes the
issue and logs `auth_deliverability_recovered`.

Requirements: the inbox needs 2FA + an app password (IMAP enabled is default
on Gmail). Plus-aliases need no setup. Test the whole path immediately with
**Run workflow** on the Actions tab.

Manual checks remain available anytime:

```bash
node scripts/auth-smtp-values.js --verify        # API-level probe
node scripts/auth-smtp-values.js --await-inbox   # full delivery probe (needs WATCHDOG_* creds)
```

## Rollback / disable

Toggle Custom SMTP off — Supabase reverts to the built-in service. Nothing in
the app changes; the app's own outreach SMTP (`email_accounts` + Settings)
is a separate system.

## Security notes

- The app password can send email as the account — treat it like a password.
  Revoke it from the Google account when rotating.
- Gmail caps app-password sending at ~500 recipients/day — plenty for auth
  traffic, wrong tool for bulk outreach (that's the outreach SMTP system).
