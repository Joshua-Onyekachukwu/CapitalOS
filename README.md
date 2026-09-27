# Capital OS

**AI-Powered Fundraising Operating System for Startup Founders**

Capital OS helps founders discover relevant investors, understand investor fit
(with explanations, not just scores), prepare personalized outreach, and manage
the entire fundraising pipeline from one place.

> **Project status (Sept 26, 2026):** Phase 1 stabilization complete — 0 type
> errors, 44 passing unit tests, production build green. Backend re-provisioning
> in progress after the original Supabase projects were removed; see
> `docs/DATABASE-SETUP-RUNBOOK.md` and `docs/19-phase1-audit.md`.

---

## What it does

1. **Discover** — search an 83K+ investor database (SEC EDGAR 13F/Form D/N-CEN,
   Apollo, CSV imports) by stage, sector, geography, and check size.
2. **Qualify** — deterministic 7-factor fit scoring with a written explanation
   per factor; AI research summaries per investor.
3. **Prepare** — AI-drafted, investor-specific outreach emails (founder approves
   everything; nothing auto-sends). Branded templates, attachments, tracking.
4. **Send** — Gmail / Microsoft Graph / SMTP with OAuth, CAN-SPAM compliance,
   open/click tracking, reply detection, health scoring and warmup.
5. **Manage** — 11-stage fundraising pipeline, campaigns, sequences, analytics,
   admin suite, credit-based billing architecture (Stripe adapter stubbed).

## Tech stack (as built)

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Auth | Supabase Auth (email/password, Google, Microsoft OAuth) |
| Database | **Supabase (PostgreSQL)** with RLS on all tenant tables |
| Data access | Typed Postgrest clients + legacy `query()` shim (`src/lib/db.ts`) |
| Real-time | Convex (job progress, metrics, notifications) |
| AI | NVIDIA NIM (Llama 3.3 Nemotron) with key rotation + mock mode |
| Email | Gmail API, Microsoft Graph, SMTP (nodemailer) |
| Files | Supabase Storage; PPTX/PDF via pptxgenjs + pdf-lib |
| Hosting | Vercel |
| Tests | Vitest (44 offline unit tests; integration suite self-skips) |

> Historical note: earlier versions of this README described a CockroachDB
> primary. That migration to Supabase is complete; `ARCHITECTURE.md` reflects
> the verified current design.

## Quick start

```bash
git clone https://github.com/Joshua-Onyekachukwu/CapitalOS.git
cd CapitalOS            # repo root ("capital os" locally)
npm install

cp .env.example .env.local
# fill in Supabase URL/keys etc. — see table below

npm run dev             # http://localhost:3456
```

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | yes | database + auth |
| `NVIDIA_API_KEY` (+ `_1`, `_2`, …) | for AI features | LLM calls; rotate multiple keys |
| `AI_MOCK_MODE` | no (`true` default) | offline/mock AI responses |
| `NEXT_PUBLIC_CONVEX_URL` | for real-time features | Convex deployment |
| `CONVEX_DEPLOYMENT` / `CONVEX_DEPLOY_KEY` | for `npx convex codegen` | type regeneration |
| `EMAIL_TOKEN_ENCRYPTION_KEY` | production | AES-256-GCM key for OAuth tokens |
| `GOOGLE_*` / `MICROSOFT_*` client id/secret | for OAuth email sending | token refresh |
| `NEXT_PUBLIC_APP_URL` | production | absolute links (tracking, unsubscribe) |

### Database setup

Follow **`docs/DATABASE-SETUP-RUNBOOK.md`** — it is the authoritative, ordered
procedure (schema migrations → RLS policies → data restore → verification).
Never run `supabase-production-fixes.sql` against a project you've just restored
data into; it contains destructive dedup statements.

## Development

```bash
npm run dev         # dev server (port 3456)
npm run build       # production build
npm run typecheck   # tsc --noEmit — must be 0 errors
npm test            # vitest (offline suites)
npm run lint        # eslint
npm run format      # prettier
```

Convex type regeneration (from repo root):

```bash
CONVEX_DEPLOYMENT=<ref> CONVEX_DEPLOY_KEY=<key> npx convex codegen
```

## Project structure

```
src/
├── app/
│   ├── (auth)/            # login, signup, password reset
│   ├── admin/             # admin console pages
│   ├── api/               # 70 REST routes (auth, investors, outreach, deck, …)
│   ├── dashboard/         # 18 main app pages (cockpit, investors, pipeline, …)
│   ├── onboarding/        # 7-step company setup wizard
│   └── page.tsx           # landing
├── components/            # Dashboard/, Landing/, Outreach/, ui/ primitives
├── lib/
│   ├── actions/           # server actions (auth → data)
│   ├── ai/                # NIM client: key rotation, models, retries
│   ├── billing/           # plans, credits, ledger
│   ├── db.ts              # SQL→Postgrest shim (legacy API preserved)
│   ├── services/          # investor/, email/, deck/, intelligence/, pipeline/
│   └── supabase/          # client/server/middleware helpers
└── scripts/               # EDGAR/CSV/Apollo ingestion & verification tooling
convex/                    # real-time schema + functions
supabase/                  # migrations 001–008
supabase-*.sql             # RLS fix, pipeline stage, tracking, etc.
backups/                   # investor data backups (gitignored)
docs/                      # product/engineering docs + runbooks
```

## Key patterns

- **Server actions** (`src/lib/actions/*`): `requireUser()` → cookie-authenticated
  Supabase client → RLS enforces tenancy → typed return values.
- **API routes** (`src/app/api/**/route.ts`): `requireAuth`/`requireAdmin` guard
  every protected route; Zod validation on inputs.
- **Pipeline stages** are defined once in `src/lib/services/pipeline/stages.ts`
  (Next.js route files may only export handlers — don't re-export constants there).
- **No fake functionality**: UI must not claim actions the backend doesn't
  perform; status docs distinguish Planned / In progress / Executed / Verified.

## Documentation map

| Document | Contents |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | verified system design, data ownership, shim behavior |
| [`SYSTEM.md`](SYSTEM.md) | operator handbook: environments, incidents, ops, troubleshooting |
| [`docs/DATABASE-SETUP-RUNBOOK.md`](docs/DATABASE-SETUP-RUNBOOK.md) | ordered provisioning + RLS + restore + verification |
| [`docs/19-phase1-audit.md`](docs/19-phase1-audit.md) | Phase 1 audit: defects found/fixed, known issues, Phase 2 plan |
| [`docs/14-feature-status.md`](docs/14-feature-status.md) | feature matrix |
| `docs/00…18-*.md` | product/architecture deep dives (older; verify against code) |

## Security

- RLS on all tenant tables (`supabase-rls-fix.sql`; verified via runbook).
- OAuth tokens encrypted (AES-256-GCM) before storage.
- Server-only keys; anon key exposure is expected and policy-protected.
- Admin routes gated by role metadata + email allowlist.
- Rate limiting on AI/expensive endpoints; CAN-SPAM compliance on all sends.
- Credit enforcement server-side per operation.

## License

See [LICENSE](LICENSE).
