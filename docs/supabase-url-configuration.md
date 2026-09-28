# Supabase Auth URL Configuration — required dashboard change

## Problem

Supabase-generated email links (email confirmation, password reset, magic
links) finalize on **`http://localhost:3000`** instead of the production app.

Evidence (2026-09-28): a fresh signup generated an admin action link ending in
`redirect_to=http://localhost:3000`; visiting it confirmed the account but the
final redirect died because nothing runs on the tester's localhost. Production
users clicking real confirmation emails would hit the same wall (and, until
2026-09-28, no confirmation email was even deliverable because no SMTP
provider is configured in Supabase — which is why signup is currently
auto-confirmed at the app level in `POST /api/auth/signup`).

## Root cause

The Supabase project's **Site URL** was never updated from the default
`http://localhost:3000`, and the production domain is not in the **Redirect
URLs allowlist**. Supabase uses the Site URL as the default `redirect_to`
for any email link that doesn't carry an explicit one, and refuses (or
mis-routes) redirects to domains not on the allowlist.

## Required change (2 minutes, Supabase dashboard)

1. Open <https://supabase.com/dashboard/project/tvekoojdilkjptjzpvqo/auth/url-configuration>
2. **Site URL** → set to `https://capital-os-nine.vercel.app`
3. **Redirect URLs** → add all of:
   - `https://capital-os-nine.vercel.app/**`
   - `https://capital-os-nine.vercel.app/auth/callback`
   - `https://capital-os-nine.vercel.app/auth/confirm`
   - `http://localhost:3000/**` (keep for local development)
4. Save.

> There is currently no Supabase access token in the environment, so this
> cannot be changed via the Management API from CI — it is a one-time
> dashboard edit by the project owner.

## App-side hardening already shipped

- `src/app/auth/callback/route.ts` exchanges the PKCE `code` and redirects to
  the app-relative `next` path — never an absolute URL, so a spoofed
  `next=https://evil.example` cannot bounce users off-domain.
- `POST /api/auth/signup` auto-confirms accounts (email_confirm) and signs
  users in immediately, so signup does not depend on email links at all while
  no provider is configured.
- Password reset (`/forgot-password`) already passes an origin-aware
  `redirect_to` — once the allowlist is fixed, reset links will land on the
  right domain with no further code changes.

## When real email activation is enabled later

1. Configure Supabase Auth SMTP (dashboard → Auth → SMTP, e.g. Resend/Postmark).
2. Turn **off** the app-level auto-confirm (remove `email_confirm: true` in
   `src/app/api/auth/signup/route.ts`, or flip it behind an env flag such as
   `SIGNUP_AUTO_CONFIRM=false`).
3. Pass `emailRedirectTo: ${origin}/auth/confirm` from the signup client.
4. Re-enable the "Check your email" UI state in the signup page.
5. Verify end to end: signup → email received on prod domain → confirm →
   session established on `/dashboard`.
