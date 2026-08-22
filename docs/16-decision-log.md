# Capital OS — Architecture & Product Decision Log

## D001 — Use Supabase as Core Database

**Date:** August 21, 2026
**Context:** Need a database solution for the Capital OS platform.
**Decision:** Use Supabase (PostgreSQL) as the primary database.
**Alternatives:** Raw PostgreSQL, Firebase, PlanetScale, Turso.
**Reason:** Existing infrastructure, relational requirements, built-in RLS, authentication integration, real-time capabilities, and scalability. Supabase provides auth, storage, and database in one platform.
**Consequences:** All data lives in Supabase. RLS is the security model. Migrations are SQL-based.

---

## D002 — Use NVIDIA NIM for AI Inference

**Date:** August 21, 2026
**Context:** Need AI capabilities for investor research, email drafting, and copilot.
**Decision:** Use NVIDIA NIM API with Llama 3.3 Nemotron Super 49B.
**Alternatives:** OpenAI API, Anthropic API, self-hosted models.
**Reason:** Cost efficiency (5 NVIDIA API keys provided), model quality suitable for our tasks, key rotation support, no per-token billing complexity.
**Consequences:** All AI operations go through NVIDIA NIM. 5-key rotation for rate limit handling. Model selection is server-side only.

---

## D003 — Use Composable Design Primitives for Pitch Deck (Hybrid)

**Date:** August 22, 2026
**Context:** Need to decide between fixed templates and composable primitives for pitch deck generation.
**Decision:** Hybrid approach — curated template library (MVP) + composable design system (differentiation).
**Alternatives:** Fixed templates only, pure composable primitives only.
**Reason:** Template library is shippable in 2-3 weeks. Composable system takes 6-8 weeks but becomes the differentiator. Templates work as safety net if AI composition produces weak results.
**Consequences:** Phase 1 uses templates. Phase 2 builds the primitive system. Templates remain as fallback.

---

## D004 — Model A: Fundraising Capacity Pricing

**Date:** August 22, 2026
**Context:** Need a pricing model that reflects value, not arbitrary feature limits.
**Decision:** Fundraising Capacity model — base workspace fee + credit-based usage.
**Alternatives:** Progressive Unlock (milestone-based), Outcomes-Based (pay per result), Standard SaaS tiers.
**Reason:** Credits create predictable unit economics. Workspace fee creates recurring revenue. No artificial feature gating. Expansion is natural (running out of credits = engaged user). Free tier is genuinely useful.
**Consequences:** Three plans: Free ($0, 50 credits), Workspace ($29/mo, 500 credits), Workspace Pro ($79/mo, 2000 credits). Credit costs per operation defined. Stripe integration deferred.

---

## D005 — Email Confirmation Disabled During Development

**Date:** August 21, 2026
**Context:** Testing the complete signup and onboarding experience requires users to proceed directly.
**Decision:** Keep email confirmation disabled during development.
**Alternatives:** Enable email confirmation, add verification screens.
**Reason:** Speed of development and testing. Email confirmation will be enabled later.
**Consequences:** New users can proceed directly into the application without email verification. Architecture remains flexible for future enablement.

---

## D006 — Use Real Estate Agent Landing Page Design

**Date:** August 21, 2026
**Context:** Need a high-quality landing page design.
**Decision:** Adapt the Real Estate Agent HTML design as the visual foundation for the landing page.
**Alternatives:** Build from scratch, use another template, use a design tool.
**Reason:** Premium design quality, professional layouts, strong typography, editorial spacing. Our hero section is preserved; the rest adapts the design language.
**Consequences:** Landing page uses Real Estate Agent design language with Capital OS content. Hero section is custom. Images replaced with business photography.

---

## D007 — Use Supabase RLS for All Security

**Date:** August 21, 2026
**Context:** Need to enforce data isolation between users.
**Decision:** Use Row Level Security (RLS) on every table in Supabase.
**Alternatives:** Application-level checks only, middleware-level checks.
**Reason:** RLS is enforced at the database level, making it impossible to bypass via client code. Supabase's native integration makes this straightforward.
**Consequences:** Every table has RLS enabled. Policies defined per table. Service role used for admin operations.

---

## D008 — Server-Side AI Only

**Date:** August 21, 2026
**Context:** AI client uses API keys that must not be exposed to the browser.
**Decision:** All AI operations happen server-side only. Client components call API routes.
**Alternatives:** Direct client-side AI calls (rejected — exposes API keys).
**Reason:** Security — API keys must never reach the client bundle. Server-side execution also allows key rotation, rate limiting, and credit enforcement.
**Consequences:** Client components (Outreach, Investor Detail) call API routes (`/api/outreach/draft`, `/api/investors/[id]/research`) instead of importing AI modules directly.

---

## D009 — 7-Step Progressive Onboarding

**Date:** August 22, 2026
**Context:** Need to collect company information without overwhelming users.
**Decision:** 7-step progressive onboarding with auto-save and skip options.
**Alternatives:** Single-page form, 3-step simplified, no onboarding.
**Reason:** Progressive disclosure prevents overwhelm. Auto-save prevents data loss. Skip option respects user autonomy. Each step collects focused information.
**Consequences:** Onboarding flow at `/onboarding`. Company profile created on first step. Dashboard shows readiness score. Onboarding link in sidebar.

---

## D010 — Deterministic Fit Scoring (Phase 3)

**Date:** August 22, 2026
**Context:** Need investor-company fit scoring that is explainable and reliable.
**Decision:** Use deterministic 4-factor scoring (stage, sector, geography, check size) for initial fit scores.
**Alternatives:** Pure AI scoring, simple rule-based, no scoring.
**Reason:** Deterministic scoring is explainable, fast, and reliable. AI scoring will be added as enhancement in later phases. Founders need to understand WHY an investor fits.
**Consequences:** Fit scores are 0-100, calculated from 4 weighted factors. Score breakdown visible on investor detail page. AI-enhanced scoring planned for future.

---

*Last updated: August 22, 2026*
