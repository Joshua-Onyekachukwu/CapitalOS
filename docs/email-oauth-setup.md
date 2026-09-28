# Email sending — XOAUTH2 (Google's current protocol)

## Why not app passwords

Research + reproduction (2026-09-28): two consecutively issued Gmail app
passwords for `onyekachukwujoshua39@gmail.com` were rejected by Gmail SMTP and
IMAP with `535 5.7.8 BadCredentials` while the account was healthy, TLS
connected fine, and Advanced Protection was off. Google removed "less secure
apps" in May 2022 and has been progressively deprecating app-password access
for SMTP/IMAP; the supported protocol is **OAuth 2.0 (XOAUTH2)**.

Consequently:
- `SMTP_PASS` was removed from `.env.local` and from Vercel (all targets).
- The dead `GOOGLE_REDIRECT_URI` var was removed from Vercel — both OAuth
  routes derive the redirect URI from the request origin, so the same code
  works on localhost and production.
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` remain: they select the SMTP
  endpoint and identify the OAuth user (they are not a password).

## Architecture

`src/lib/services/email/smtp-sender.ts` picks the first available strategy:

1. **Per-user Google XOAUTH2** — `email_accounts` rows with
   `provider='google'` (created by Settings → Connect Gmail). The stored
   refresh token (AES-256-GCM encrypted with `EMAIL_TOKEN_ENCRYPTION_KEY`) is
   exchanged for short-lived access tokens; mail is sent from **the user's
   own address**.
2. **Per-user custom SMTP** — their own host/user/password (app-password
   style auth is fine on their own non-Google server).
3. **Global XOAUTH2** — env `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` +
   `GOOGLE_REFRESH_TOKEN` (optional; a refresh token minted via OAuth
   Playground with the mail scope). Sends from `SMTP_USER`/`EMAIL_FROM`.
4. **Global app password (legacy)** — only if `SMTP_PASS` is set. Kept as a
   fallback for non-Google SMTP relays; unset in this project.

The reply poller reads the same `email_accounts` rows: OAuth accounts are
polled through the Gmail API, `custom_smtp` accounts through IMAP
(`src/lib/services/email/imap-poller.ts`).

## Connect flow (per-user)

1. Dashboard → Settings → **Connect Gmail** → `GET /api/auth/google`.
2. Scopes requested: `https://mail.google.com/` (**required** for SMTP/IMAP
   XOAUTH2 — the `gmail.send`/`gmail.readonly` API scopes do **not** grant
   SMTP access), plus userinfo for identity.
3. Callback exchanges the code, identifies the signed-in user via the
   `@supabase/ssr` session, encrypts tokens, and upserts
   `email_accounts (user_id, provider='google')`.
4. Google Cloud Console must list
   `https://capital-os-nine.vercel.app/api/auth/google/callback` (and
   `http://localhost:3000/api/auth/google/callback` for dev) under
   **Authorized redirect URIs** — the callback's error text names the exact
   URI if Google reports a mismatch.

## Global send without per-user connect (optional)

1. Open <https://developers.google.com/oauthplayground> → gear icon →
   check "Use your own OAuth credentials" (Client ID/Secret from `.env.local`).
2. Authorize `https://mail.google.com/` (full scope is required for SMTP).
3. Exchange the code, copy the **refresh token**, and set it on Vercel as
   `GOOGLE_REFRESH_TOKEN` (production + preview), then redeploy.

## E2E procedure

```bash
# Prereq: a Google account connected (email_accounts has a provider='google' row)
node scripts/email-e2e-oauth.cjs verify   # token refresh + SMTP XOAUTH2 auth
node scripts/email-e2e-oauth.cjs full     # real send + threaded reply + cron poll + DB assertions
node scripts/email-e2e-oauth.cjs cleanup  # remove E2E threads/messages
```

`full` sends two real emails from the connected Gmail to
`buffy.qa+prod-e2e-20260927@gmail.com` (override with `E2E_RECIPIENT`), seeds
the thread + outbound `email_messages` row, triggers the deployed
`/api/cron/daily` poller with `CRON_SECRET`, and asserts the inbound reply
row, thread match and reply status.

## Signup note

Signup is auto-confirmed at the app level until real email activation exists
(see `docs/supabase-url-configuration.md` for the required Supabase URL
configuration and the re-enable checklist).
