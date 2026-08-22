# Capital OS — Pricing & Billing

## Pricing Model: Fundraising Capacity (Model A)

### Why This Model

We rejected standard SaaS tiering (Free → Pro → Business → Enterprise) because:
- It does not reflect the value users get from the platform
- It creates artificial feature gating that frustrates users
- It does not align with the fundraising journey

Instead, we chose **Fundraising Capacity** — a model where:
- Credits create predictable unit economics
- The workspace fee creates recurring revenue
- No artificial feature gating — every user can access every feature within their credit budget
- Expansion is natural — running out of credits means the user is engaged
- The free tier is genuinely useful, not a crippled demo

### Plans

| | Free | Workspace | Workspace Pro |
|---|------|-----------|---------------|
| **Monthly Price** | $0 | $29/mo | $79/mo |
| **Monthly Credits** | 50 | 500 | 2,000 |
| **Investor DB Limit** | 100 | 5,000 | 50,000 |
| **Deep Research** | 3/mo | 30/mo | Unlimited |
| **Pitch Decks** | 1 | 3 | Unlimited |
| **Campaigns** | 1 active | 5 active | Unlimited |
| **Email Accounts** | 0 | 1 | 3 |
| **Team Seats** | 1 | 1 | 5 |

### Credit Costs Per Operation

| Operation | Credits | Internal Cost | Description |
|-----------|---------|---------------|-------------|
| `investor_research` | 5 | ~$0.003 | AI research summary |
| `email_draft` | 3 | ~$0.002 | Personalized email draft |
| `fit_analysis` | 4 | ~$0.004 | AI fit scoring with reasoning |
| `pitch_deck_generate` | 25 | ~$0.015 | Full pitch deck generation |
| `pitch_deck_revision` | 10 | ~$0.008 | Pitch deck revision |
| `deep_enrichment` | 8 | ~$0.008 | Deep investor data enrichment |
| `company_intelligence` | 6 | ~$0.005 | Website/document extraction |
| `email_sequence` | 5 | ~$0.003 | 3-step email sequence |

**1 credit ≈ $0.01 internal cost, sold at $0.10 (free tier) or $0.04-0.05 (pack)**

### Unit Economics

| Metric | Value |
|--------|-------|
| Free tier AI cost/month | ~$0.15 (negligible) |
| Workspace AI cost/month (500 credits) | ~$5.00 |
| Workspace Pro AI cost/month (2000 credits) | ~$20.00 |
| Workspace gross margin | ~83% ($29 - $5) |
| Workspace Pro gross margin | ~75% ($79 - $20) |

## Billing Architecture

### Implementation Status

| Component | Status |
|-----------|--------|
| Plan definitions | ✅ Implemented |
| Subscription management | ✅ Implemented |
| Credit allocation | ✅ Implemented |
| Credit consumption | ✅ Implemented |
| Credit ledger | ✅ Implemented |
| Entitlement checks | ✅ Implemented |
| Stripe integration | 🟣 Architecture only |

### Database Tables

| Table | Purpose |
|-------|---------|
| `billing_plans` | Plan definitions (seeded: Free, Workspace, Workspace Pro) |
| `user_subscriptions` | Per-user subscription with credits |
| `credit_ledger` | Immutable log of every credit transaction |
| `credit_costs` | Maps operation names to credit costs |

### Services (`src/lib/billing/`)

| Service | Purpose |
|---------|---------|
| `plans.ts` | Plan definitions, subscription lookup, credit cost queries |
| `credits.ts` | Credit consumption, balance checking, ledger history |
| `entitlements.ts` | Plan-based entitlement checks |

### Entitlement Checks

```typescript
canAddInvestor(userId) → { allowed, current, limit }
canRunDeepResearch(userId, currentUsage) → { allowed, current, limit }
canGeneratePitchDeck(userId, currentUsage) → { allowed, current, limit }
canCreateCampaign(userId, activeCampaigns) → { allowed, current, limit }
canConnectEmail(userId, currentConnected) → { allowed, current, limit }
canPerformOperation(userId, creditsRequired, balance) → { allowed, current, limit }
```

### Credit Flow

```
User performs operation
     ↓
Check: hasCredits(userId, operation)
     ↓
If yes → consumeCredits(userId, operation)
     ↓
Update: user_subscriptions.credits_remaining
Log: credit_ledger entry
     ↓
Return: { success, balance, cost }
```

### Auto-Create Subscription

When a `company_profiles` row is created (on onboarding start), a trigger auto-creates a free subscription with 50 credits.

### Future: Stripe Integration

When Stripe credentials are provided, only the provider adapter needs to be implemented:

```
Capital OS Billing
       ↓
Billing Provider Interface (src/lib/billing/provider.ts)
       ↓
Stripe Adapter (future)
```

No core application changes required.

---

*Last updated: August 22, 2026*
