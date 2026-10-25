# Security & Reliability Report — Capital OS

**Date:** October 24, 2026. Evidence classes: **[T]** exercised live during this audit, **[C]** covered by committed tests/CI, **[R]** reviewed statically in code, **[U]** unverified (access limited). Production was not modified; no destructive tests were run; no credentials or investor PII appear here.

## Overall posture

Strong for the stage — the authorization model is **continuously tested against production**, not just claimed. The nightly GitHub Actions suites (03:15 UTC) run a static admin-route scan, a live 401/403 matrix across every `/api/admin/*` route, IDOR probes, and a full auth-user journey against production; failures autopage via GitHub issue + Slack + Resend. Two real production bugs have already been caught this way (CSRF hole on auth endpoints; broken notes inserts) and fixed — that loop works.

## 1. Authentication & session [C][T]

- Supabase Auth (email/password; Google/Microsoft OAuth). Cookie session refresh in middleware; protected-path redirects verified live (`/dashboard` → `/login`, 2026-10-24 [T]).
- Host-aware CSRF: same-origin enforced on all state-changing methods **including** auth endpoints (deliberate: signup spam/credential stuffing target them); origin matched against serving `x-forwarded-host` so it holds for any deployment URL. Tested nightly with cross-origin-403/same-origin-pass/429-with-limiter-headers assertions [C].
- Password-reset responses are deliberately generic (no account enumeration) and burst-tested against shared email quota [C].
- Session cookies asserted `HttpOnly/Secure/SameSite` in production [C]; fabricated cookies rejected [C].
- 87 offline unit tests + 13 access-control & 39 security integration tests [C]. During this audit: 87/87 offline green; integration suites self-skip locally (by design) and run nightly [C].

## 2. Tenancy & Row Level Security [C]

- All tenant tables gated by `auth.uid()` policies; policy-mirroring grant matrix on 48 public relations (no blanket grants; TRUNCATE/REFERENCES/TRIGGER revoked from client roles — Sept 2026 hardening).
- Known-then-fixed holes (migrations 010/011, [C] regressions in place): `data_change_log` SELECT was `USING(true)` (any user read any user's notes); SECURITY-DEFINER helpers (`set_investor_embeddings`, `link_investor_iapd`) were anon-executable; `audit_log`/email-health INSERT accepted any JWT; `email_accounts.provider` CHECK broke `custom_smtp`.
- It is acknowledged that the shared `investors` dataset is readable by all authenticated users by design (deliberate product property), and cross-user *private* state is isolated — verified by a two-tenant cross-isolation harness at 44/44 (RLS + API + anon layers, ownership-forgery and notes-privacy attacks) [C].
- Consequence for the product surface: fit score, notes, pipeline entries, emails are per-user; "database intelligence" is shared.

## 3. API surface abuse & rate limiting [C][U]

- Every admin route `requireAdmin` (role metadata + email allowlist); bootstrap endpoint exempt but fail-closed [C].
- Upstash Redis fixed-window limiter with memory fallback; 429 carries `X-RateLimit-Backend: redis|memory`. Whether prod env vars are provisioned is **[U]** (probing would create real signup attempts; left as documented manual probe).
- In-flight uncommitted work adds an auth-SMTP watchdog + nightly grant-health probe: `email_accounts` health states (`healthy | reconnect_required | unverified`) populated nightly by real token refreshes [C, uncommitted].

## 4. Secrets [R][U]

- Service-role key, AI keys, OAuth secrets, `EMAIL_TOKEN_ENCRYPTION_KEY` are server-only env; historic leaks redacted in commit `41a064f`; `.env.local` gitignored (verified).
- **Unverified in this audit:** Vercel env parity (prod vs preview), absence of keys in client bundle beyond the by-design Supabase anon key. Recommend adding a CI secret-scan step before pilot.

## 5. Input validation & injection [R]

- Zod validation across API routes; Postgrest parameterized queries via the typed client; the db.ts SQL shim only translates a pinned subset (locked by contract tests) and logs-and-fails-closed otherwise — no string interpolation into SQL was found in reviewed paths.
- In-flight fix now parses `::$jsonb` cast params correctly — before this, jsonb columns got double-encoded strings (functional debt, not injection).

## 6. Files [U]

- Company docs/decks upload through Supabase Storage with server-side validation; bucket-level policies **not verifiable without dashboard access** [U] — one manual review item (G-infrastructure B-list).

## 7. Email compliance [C}

- CAN-SPAM: footer + physical address + unsubscribe links enforced at template layer; suppression round-trip tested; unsubscribe no-op bug fixed and covered by tests; physical-address placeholder value still needs replacing with the real business address before commercial sending (documented flag).

## 8. Privacy & data protection [U][R]

Collected PII today is minimal: auth profile, company profile, outbound email bodies/metadata (post-first-send), tracking events. Nigeria-specific obligations (NDPB, Nigeria, enacted; enforcement in practice limited) and any EU/UK founder exposure (GDPR) are **not yet formalized** [U]-compliant: no explicit consent ledger, no data-export/self-serve deletion flow, retention window undefined in code. The privacy page exists. Recommendations before paid scale:

1. Data self-serve export (their data) + deletion request path (even a ticket backlog is fine at pilot scale, but document it).
2. Recording `legal/consent` for tracking in marketing contexts remains minimal because email tracking is limited to recipients you send to from *your own* mailbox — keep it that way (no third-party pixel pixels).
3. Retention: `email_tracking_events` purge >24 months via cron.

## 9. Reliability flows [T][C]

- Production serving verified (landing/auth OK; 401 gates; cron 401 without secret) [T].
- 44-nightly-suite history present in `background_jobs` [T-observed].
- Outage survival: restore runbook exists and was executed once with data verified (12,203 rows post-restore, Sept 27) [C]; the incident shared single-root cause is Supabase env drift + auto-pause (infrastructure doc covers prevention).

## 10. Prioritized threat & mitigation register

| Rank | Threat | Likelihood/Impact | Current mitigation | Remaining gap |
|---|---|---|---|---|
| 1 | Supabase project pause/loss (free tier) | Med / High (recurred Sept 2026) | Runbook restart; investors regenerable | Auto-pause heartbeat; user-data off-site backup; Pro plan when revenue |
| 2 | BadRequestCredential stuffing / signup burst abuse | Med / Med | Rate limiting + nightly authflow tests | Verify Upstash env live [U] |
| 3 | Cross-tenant leak via future schema changes | Low / High | Two-tenant harness + grant-matrix discipline run nightly | Keep migration checklist mandatory; new tables need a harness rule |
| 4 | Outbound email deliverability collapse (sender domain burned) | Med / High for first campaign | Warmup engine + suppression + nightly credential probe | Discipline loop (Go-live plan) is unproven until first campaign |
| 5 | AI-key burn / quota exhaustion | Med / Med (mock-mode exists) | Key rotation + credit ledger + per-op costs config | No alerting on ledger anomalies yet |
| 6 | Secret leak via new contributor or script | Low / High | .env.local gitignore, redacted history | CI secret scan; no-download guard on CI org settings |
| 7 | Data privacy non-compliance posture | Low now / High later | Privacy page, minimal data | Export/deletion flows; NDPB/GDPR posture note (drafting needed before pilot customers with EU seats).

**Claims discipline:** nothing in this doc should be read as "compliant" (NDPB/GDPR statements) — compliance posture is a work item, not a property. All [U] items are one-dashboard-step items requiring their respective owner (Vercel, Supabase, Upstash) to verify.
