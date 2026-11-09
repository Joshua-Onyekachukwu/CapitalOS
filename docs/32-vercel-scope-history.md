# Vercel scope history — old and new

Same code, same Supabase project, same public hostname. Only the Vercel scope changed.

## New (active)

| Field | Value |
|---|---|
| Vercel user | `semekjoshua-4977` |
| Scope id | `team_kSNLR1qc5qba8xkxU1XHI6GR` |
| Project id | `prj_tLFU5LyYK7JQ777ssLOMxlO5012S` |
| Project name | `capital-os` |
| Public host | `capital-os-nine.vercel.app` |
| Git | `github Joshua-Onyekachukwu/CapitalOS`, branch `main`, repoId `1341641763` |

## Old (keep for a possible rollback)

| Field | Value |
|---|---|
| Scope id | `team_ksBu4z76RQhxb2mFJHgsodAn` |
| Project id | `prj_vqsW99VZYzxXpjRmxHueg8j0VkLN` |
| Project name | `capital-os` |
| Public host (at last check) | 404 `DEPLOYMENT_NOT_FOUND` |

The user reports the old account remains accessible from next month. It is not
deleted; it is paused. Nothing has been removed from it.

## Rollback

`.vercel/project.json` holds the *linked* scope. To point the CLI back at the old
project, restore the ids above:

```json
{ "projectId": "prj_vqsW99VZYzxXpjRmxHueg8j0VkLN", "orgId": "team_ksBu4z76RQhxb2mFJHgsodAn", "projectName": "capital-os" }
```

Deploying to a scope requires a token for that scope; the current token only has
access to the new one.

## Outcome (2026-11-05)

Site is live on the new scope at `https://capital-os-nine.vercel.app`.

**Why the first deploy failed:** `next.config.ts` imported
`@sentry/nextjs/config` and `src/instrumentation*.ts` imported `@sentry/nextjs`,
`posthog-js` and `posthog-node`, but those packages were only in the local,
uncommitted `package.json`. `origin/main` never declared them, so `npm ci`
installed a tree without them and the build died at config load:

```
Error: Cannot find module '@sentry/nextjs/config'
Error: [BUILD_UTILS_SPAWN_1] Command "npm run build" exited with 1
```

Fixed in `5c11c44` by committing `package.json` + `package-lock.json` only
(lockfile validated with `npm ci --dry-run` → exit 0 before pushing).

**Environment:** the new project had **0** environment variables. 32 were pushed
from `.env.local` to production+preview, with machine-only values (`TEST_*`,
`VERCEL_TOKEN`, `VERCEL_OIDC_TOKEN`) deliberately excluded.

**Repo secrets:** `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_TOKEN` updated
through `gh secret set`, so `.github/workflows/deploy.yml` now targets the new
project instead of the old one.

**Deployment:** `dpl_HCrd8cW8BbHe46PwFdBkckxZoCm1` from `5c11c44`, READY in 124s.

### Verified against the live host

| Check | Result |
|---|---|
| `GET /` | 200, `<title>Capital OS — AI Capital Allocation</title>` |
| `GET /login` | 200 |
| `GET /dashboard` signed out | 307 |
| `GET /dashboard` signed in | **200**, `text/html` |
| `GET /api/investors/saved` signed out | 401 |
| `GET /api/investors/saved` signed in | **200**, `application/json` |
| `GET /api/dashboard/cockpit` signed out / in | 401 / **200** |
| Supabase project reached | `tvekoojdilkjptjzpvqo` |

The signed-in 200s prove the deployed build reaches the real Supabase project
with a valid session and that RLS-scoped API routes work — not just that the
HTML renders.

### Not deployed

The Fundraising Readiness module (`docs/29`) is still local-only and was **not**
in `5c11c44`; `/api/readiness` returns 404 in production, which is expected.

## Note on the hostname

`capital-os-nine.vercel.app` is assigned to the **new** project. Because the
hostname did not change, Supabase Auth, the Google OAuth client and
`NEXT_PUBLIC_APP_URL` all stay valid — no external configuration had to change.
