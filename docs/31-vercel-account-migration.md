# Moving Capital OS to a new Vercel account

Date: 2026-11-04
Supabase stays exactly as it is. Only the Vercel account changes.

## Measured state before anything was touched

| Host | Response |
|---|---|
| `capital-os.vercel.app` | **200**, `<title>Capital OS — AI Capital Allocation</title>`, `/login` 200, `/dashboard` 307 |
| `capital-os-nine.vercel.app` | **404**, `X-Vercel-Error: DEPLOYMENT_NOT_FOUND` |

The host printed in `PITCH-DECK.html`, `CAPITAL-OS-INVESTOR-PITCH.md`,
`docs/00`, `docs/11` and `docs/AUTH-SMTP-SETUP.md` is **`-nine`**, and it is dead
right now. `env-vercel.json` and `ARCHITECTURE.md` name `capital-os.vercel.app`,
which is live. These are two different Vercel projects — the `-nine` suffix only
exists because `capital-os` was already taken when that project was created.

**Open question that blocks the plan:** which of the two hosts was submitted in
the applications you already sent. Everything below is safe either way, but the
transfer/recreate decision depends on the answer.

Locally linked project: `projectName: capital-os`,
`projectId: prj_vqsW99VZYzxXpjRmxHueg8j0VkLN`,
`orgId: team_ksBu4z76RQhxb2mFJHgsodAn` — that is the scope that now 404s.

## Do not delete the old project first

Vercel's documented behaviour on project deletion:

- deployments are deleted immediately,
- **environment variables are deleted**, and encrypted values cannot be read back
  from the dashboard beforehand,
- domains are released.

A released `*.vercel.app` subdomain is not reliably reclaimable — there are
Vercel community reports of the alias staying stuck ("already in use by a
different project") for days with no support path. Deleting first risks losing
the exact link permanently, which is the one thing that must not change.

Order is therefore: **copy secrets → stand up the new target → verify → only then
retire the old one.**

## Recommended path: transfer the project

Vercel's Transfer Project moves the project to another team/account with **zero
downtime**, and carries over:

- deployments and their configuration,
- **domains and aliases** (so `capital-os.vercel.app` keeps serving),
- **environment variables** (except any defined inline in `vercel.json`'s `env` /
  `build.env`, which this project does not use),
- the Git connection and project settings.

You can also choose the project name during transfer; keeping `capital-os`
re-uses the existing name and the existing alias.

Requirements: you must be an **owner of the old scope** and a **member of the new
account**. If the old account is suspended for billing, transfer may be refused —
that is the one blocker that cannot be worked around.

Fallback if transfer is refused: create a project on the new account, push this
repo, restore env vars from the local copy, deploy to a temporary host, then move
the domain. If the domain cannot be moved, the submitted link stays broken and
only a custom domain can restore a stable address.

## What the code pins to the URL

Changing the hostname is not just a redeploy. These are pinned and break silently:

| Location | Value today |
|---|---|
| Supabase → Auth → URL Configuration → Site URL | `https://capital-os-nine.vercel.app` |
| Supabase → redirect allow-list | `…/auth/callback`, `…/auth/confirm` |
| Google Cloud → OAuth client → redirect URIs | `…/api/auth/google/callback`, `…/auth/callback` |
| Vercel env `NEXT_PUBLIC_APP_URL` | used for links in email |
| Vercel env `GOOGLE_REDIRECT_URI` | must match the Google client exactly |
| `ALLOWED_ORIGINS` | CORS allow-list |

If the transfer preserves the host, **none of these change** — that is the main
argument for transferring.

## Repository things that must be updated on a new account

`.github/workflows/deploy.yml` runs on every push to `main` and calls
`scripts/sync-vercel-env.mjs` with repo secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

If those are not updated, every future push keeps trying to deploy to the old
project, and CI goes red while production silently stops updating. This is the
single easiest step to forget.

`vercel.json` defines two crons, both on `/api/cron/daily`. Hobby allows two cron
jobs; confirm the duplicate path is intended and that both schedules are daily.

## Environment variables to carry across

Names present in `.env.local` (values never printed here):

```
NEXT_PUBLIC_SUPABASE_URL            NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY           SUPABASE_DB_PASSWORD
DATABASE_URL                        CRON_SECRET
NVIDIA_API_KEY  (+ _1.._5)          NVIDIA_BASE_URL
OPENROUTER_API_KEY                  AI_MOCK_MODE
GOOGLE_CLIENT_ID                    GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI                 NEXT_PUBLIC_APP_URL
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / EMAIL_FROM
EMAIL_TOKEN_ENCRYPTION_KEY          APOLLO_API_KEY / APOLLO_BASE_URL
CONVEX_DEPLOYMENT / CONVEX_DEPLOY_KEY / NEXT_PUBLIC_CONVEX_URL
COCKROACH_ADMIN_EMAILS
```

Test-only values (`TEST_*`) and machine tokens (`VERCEL_TOKEN`,
`VERCEL_OIDC_TOKEN`) must **not** be copied to the new project.

## Secret hygiene found while looking

`env-vercel.json` and `env-convex.json` are **tracked in git** and list
`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` and `CONVEX_DEPLOY_KEY`. Some entries
are placeholders (`YOUR_ANON_KEY`, `YOUR_SERVICE_ROLE_KEY`). Any entry that is a
real value must be treated as leaked to everyone with repo access (and to anyone
if the repo is public) and rotated in Supabase. Verify before copying them
anywhere.

## Verification after cutover

1. `https://<host>/login` → 200.
2. `https://<host>/dashboard` → 307 to login when signed out.
3. Signed-in `GET /api/readiness` → 200; anonymous → 401.
4. `node scripts/cross-tenant-test.cjs --base-url https://<host>` → 50/50.
5. `node scripts/smoke-prod.cjs --base-url https://<host>`.
6. Google sign-in end to end (the OAuth redirect is the usual casualty).
7. A cron run: `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/daily`.
8. Confirm the new deployment shows in the new account's dashboard, and that a
   test push to `main` deploys there and not to the old one.
