# Pricing & Billing — Capital OS

*Last updated: 2026-10-31 — rewritten to the 3-pillar Fundraising Lifecycle model.*

---

## Overview

Capital OS does not use a traditional monthly SaaS feature grid. We price around the actual shape of a raise:

1. **Upfront Fundraise Sprint** — the actively-raising phase, paid upfront.
2. **Post-Raise Retention** — the post-close investor-relationship phase, $29/month or $290/year.
3. **B2B Multi-Client** — accelerators, studios, fractional CFOs managing batches of startups, $499–$1,000/month billed annually.

The internal billing layer (plans, credits, entitlements, ledger, provider abstraction, Stripe Checkout + webhooks) is already built and wired. The public product story is being migrated to the three pillars above. Some code and copy still reference the older Free / Workspace / Workspace Pro framing; those are migration targets detailed below.

---

## Pillar 1 — Upfront Fundraise Sprint

A paid, time-boxed fundraising engagement that bundles everything the platform does for an actively raising founder.

### What the Sprint includes

- Full investor database access with AI thesis matching against the founder's company profile.
- Deterministic fit scoring across 8 factors, with a written explanation per factor: sector, stage, geography, check size, contactability, investor type fit, data completeness, recent activity.
- On-demand AI investor research summaries (NVIDIA NIM), with chain-of-thought extraction of thesis, portfolio, and recent activity.
- AI email drafting personalized per investor, in the founder's chosen tone, reviewed by the founder before anything sends.
- 7 branded email templates with open/click tracking and CAN-SPAM compliance.
- Campaign management with multi-step drip sequences, follow-up scheduling, business-hours-only sending, and stop-on-reply rules.
- 11-stage pipeline Kanban from Discovered through Closed.
- Email health dashboard: account health scoring, warm-up system, domain DNS verification, suppression list.
- Pitch deck generator (PPTX + PDF) tuned to the company's profile.
- AI Copilot that answers questions about the founder's investors and pipeline in natural language, with real context from the database.

### Sprint tiers

| Tier | Price | Window | Best for |
|------|-------|--------|----------|
| **3-Month Sprint** | $499, paid upfront | 3 months | A focused, standard raise window. |
| **6-Month Pro Sprint** | $999, paid upfront | 6 months | A longer or more complex raise: more investor research, more sequences, more time under management. |

### Why upfront

Fundraising is episodic. A round takes 3–6 months. If you charge $49/month, founders cancel the moment the round drags, whether they succeed or fail. A $499 upfront Sprint secures a sustainable customer lifetime value on day one, aligns the platform's incentives with the founder's outcome, and gives the founder a clear, contained engagement rather than an open-ended bill.

It also keeps the business legally clean: taking a commission or success fee on a private securities offering without a registered U.S. Broker-Dealer license violates Section 15(a) of the Securities Exchange Act of 1934. Selling software, access passes, and usage credits — with no percentage of money raised — keeps the business 100% compliant.

---

## Pillar 2 — Post-Raise Retention

When the round closes, the founder cannot stop emailing their new investors. Capital OS keeps that relationship warm with a lightweight, high-margin retention tier.

### What the founder gets for $29/month (or $290/year paid upfront)

- **Automated monthly update drafter.** Pulls key metrics (MRR, runway/cash balance, customer count) and uses the LLM to produce a clean, standardised update format: Wins, KPIs, Challenges, and Asks. The founder reviews and sends — nothing auto-sends.
- **Dedicated read-receipt and click tracking.** Shows which investors actually read the update, clicked deck links, or forwarded it to partners.
- **Continuous secure data room.** Storage for historical board decks, cap table exports, and past monthly updates for existing backers.
- **Warm-backer re-engagement.** When the founder is ready to raise the next round (18–24 months later), their current investors are already warm, organised, and ready for follow-on checks with one click.

### Why $29/month

- **Market comparison.** Dedicated investor update platforms (like Visible.vc or DocSend) charge $49 to $69+/month. A streamlined, AI-native tier at $29/month makes it a no-brainer expense for any company that just raised $500K to $3M.
- **Frictionless transition.** When the Sprint expires, the platform prompts: "Congrats on closing your round! Keep your new investors informed and warm for the next round for just $29/month."
- **Low churn, pure margin.** Once a founder connects their metrics and adds 5 to 15 investors, they almost never cancel. It costs virtually nothing in compute to run one update draft per month, turning this tier into high-margin recurring cash flow that turns a 90-day churn cycle into a 24- to 36-month subscription.

---

## Pillar 3 — B2B Multi-Client

Accelerators, startup studios, and fractional CFOs manage batches of 10–50 startups at once. They have ongoing recurring needs and corporate budgets.

### What the B2B customer gets

- Multi-company dashboard across every startup they manage.
- Shared pipeline and campaign visibility.
- Firm intelligence seats — the advisor's team can search and qualify investors across the whole portfolio.
- Per-startup billing visibility so the advisor can either absorb the cost or pass it through.
- Annual billing to match how B2B procurement actually works.

### Pricing

| Tier | Price | Best for |
|------|-------|----------|
| **Starter B2B** | $499/month, billed annually | Small accelerators, solo advisors managing ~10 startups. |
| **Growth B2B** | $749/month, billed annually | Mid-size accelerators, studios managing ~20–30 startups. |
| **Scale B2B** | $1,000/month, billed annually | Larger programs, multi-country accelerators, fractional CFO firms managing 30–50 startups. |

### Why this matters

B2B customers offset founder seasonality. Their need is recurring and their budget is corporate. A small base of accelerator and advisor customers provides stable ARR that smooths the natural lumpiness of founder Sprint purchases.

---

## Why adopt this model

### Eliminates the "Fast-Cancel" Trap

Fundraising is episodic (it takes 3–6 months). If you charge monthly ($49/mo), founders cancel immediately whether they succeed or fail. A $499 upfront sprint secures a sustainable Customer Lifetime Value (LTV) on day one.

### Cures SaaS Churn with Low-Touch Retention ($29/mo)

Once founders close their round, they cannot stop emailing their new investors. Providing a lightweight monthly update tool turns a 90-day churn cycle into a 24- to 36-month subscription.

### Unlocks True Enterprise ARR via B2B

Accelerators and startup advisors manage batches of 10–50 startups simultaneously. They have ongoing recurring needs and corporate budgets, providing stable annual recurring revenue (ARR) that offsets founder seasonality.

### Avoids Massive Legal/Regulatory Fines

Taking a commission or "success fee" (e.g., 1–2% of the money raised) on private securities offerings without a registered U.S. Broker-Dealer license violates Section 15(a) of the Securities Exchange Act of 1934. Selling purely software, access passes, and usage credits keeps you 100% compliant.

---

## Revenue streams

| Stream | Description |
|--------|-------------|
| **Upfront Sprints** | $499 and $999 paid upfront per actively raising founder. The core revenue event. |
| **Post-Raise Retention** | $29/month or $290/year per post-close founder. High-margin recurring revenue that extends customer life from ~90 days to 24–36 months. |
| **B2B multi-client** | $499–$1,000/month billed annually per accelerator, studio, or advisor. Stable ARR that smooths founder seasonality. |
| **Future: credit packs** | One-time credit purchases for heavy users on the internal credit system (architecture already in place). |

---

## Unit economics (modeled)

| Metric | Value |
|--------|-------|
| Free tier AI cost/month | ~$0.15 |
| Workspace AI cost/month (500 credits) | ~$5.00 |
| Workspace gross margin | ~90% ($49 − $5) |
| Workspace Pro gross margin | ~90% ($199 − $20) |
| Customer acquisition cost (target) | <$100 |
| LTV — Sprint + Retention (2-year view) | $499 Sprint + $29×24 ≈ $1,195 per successful founder, plus the B2B layer |

---

## What we do NOT do

- **No success fee.** We never take a percentage of money raised. That would require a registered U.S. Broker-Dealer license under Section 15(a) of the Securities Exchange Act of 1934. We sell software, access passes, and usage credits — which is clean.
- **No open-ended monthly SaaS that founders cancel.** The monthly option is the $29 retention tier for post-close founders, priced as a no-brainer and meant to stick for years. The actively-raising phase is a paid Sprint, not a cancellable monthly bill.

---

## Migration status — what still references the old model

| Asset | Current state | Migration action |
|-------|---------------|------------------|
| `src/lib/billing/plans.ts` — plan entities | Free / Workspace / Workspace Pro with `monthlyPrice`, `annualPrice`, `investorDbLimit`, etc. | Keep the entity model; add Sprint and IR plan entries; align field semantics (e.g., `windowMonths`, `isPostRaiseRetention`, `b2bSeatCount`). |
| `src/lib/billing/provider.ts` — billing provider | Local provider + Stripe placeholder | Already in good shape; add Sprint purchase flow (one-time Checkout session) and Retention/B2B subscription flows as adapter work. |
| ` src/lib/billing/credits.ts` — credit ledger | Working | Keep. Credits remain the internal usage accounting; the public product story is pillar-based, not credit-grid-based. |
| `src/lib/billing/entitlements.ts` — entitlement checks | Working per-feature checks | Keep; add Sprint-specific entitlements (e.g., campaign steps, IR update drafts) and B2B seat checks. |
| Landing `Pricing.tsx` | Two cards: Starter $49/mo, Professional $199/mo | Replace with three pillars (Sprint 3-mo / Sprint 6-mo; Retention $29/mo + $290/yr; B2B tiers). |
| Onboarding `page.tsx` — "are you raising?" | Collects `currentlyRaising` and funding amount | Keep the data collection; add Sprint-first purchase prompt and post-close IR upgrade prompt. |
| Pitch docs (`CAPITAL-OS-INVESTOR-PITCH.md`, `PITCH-DECK-CONTENT.md`) | Rewritten to 3 pillars | Done. |
| Database tables (`billing_plans`, `user_subscriptions`, `credit_costs`, `credit_ledger`) | Seeded for Free/Workspace/Pro | New migration to add Sprint, IR, and B2B plan rows; subscription status fields may need `sprint_ends_at` / `ir_isPostRaise` annotations. |
| Admin finance page | Shows revenue and founding member data | Add Sprint purchase and IR/B2B subscription views. |

---

## Lift order (recommended)

1. **Docs + pitch first.** `CAPITAL-OS-INVESTOR-PITCH.md`, `PITCH-DECK-CONTENT.md`, and `docs/07-pricing-billing.md` are already rewritten to the new model. Keep them as the source of truth; migrate code to match.
2. **Plan entities.** Add the three pillar plan rows to `billing_plans` via a migration, and add fields as needed (`windowMonths`, `isPostRaiseRetention`, `b2bSeatCount`, `annualBillingDefault`).
3. **Stripe purchase flows.** Wire a one-time Checkout session for the Sprint tiers and subscription sessions for Retention and B2B. This is adapter work against the existing provider abstraction.
4. **Landing + onboarding UX.** Replace the pricing cards and the post-onboarding prompt with the pillar story.
5. **Admin.** Add Sprint + IR + B2B views to admin finance.
6. **Post-raise IR handoff.** Build the in-app prompt that appears when a Sprint window ends or a round is marked closed, offering the $29/month Retention tier.
7. **B2B multi-company UI.** Firm dashboard, shared pipeline, seat management (future, not blocking first raise).

---

## Legal note

The model is intentionally not a success-fee model. We sell software, access passes, and usage credits. We do not take a percentage of money raised. This avoids the need for a registered U.S. Broker-Dealer license under Section 15(a) of the Securities Exchange Act of 1934. If the business ever considers taking a percentage of capital raised, that triggers a separate legal review and likely a registered intermediary structure.

---

*Last updated: 2026-10-31*
