# Capital OS — Company Intelligence System

## Overview

The Company Intelligence System collects, structures, and maintains information about each founder's company. This data becomes the foundation for investor matching, pitch deck generation, outreach personalization, and the entire platform experience.

## Data Collection

### Primary Source: Onboarding

The 7-step onboarding flow collects:

| Category | Fields |
|----------|--------|
| **Identity** | Company name, website, industry, location, stage, business model |
| **Product** | One-liner, description, differentiator, target customer |
| **Fundraising** | Raising status, amount, round type, target geographies, pitch deck status |
| **Traction** | MRR, ARR, customer count, growth rate, milestones, employees |
| **Team** | Founders and team members with names, titles, LinkedIn |
| **Documents** | Uploaded pitch decks, business plans, financial models |

### Secondary Sources (Planned)

| Source | Data Extracted |
|--------|---------------|
| Company website | Meta tags, positioning, brand colors, product description |
| Uploaded documents | Content analysis, key metrics, team info |
| LinkedIn company page | Team size, industry, description |
| Crunchbase (future) | Funding history, investors, valuation |

## Data Storage

All company data lives in `company_profiles` table with linked tables:

```
company_profiles
├── company_team_members (founders + team)
└── company_documents (uploaded materials)
```

## Readiness Score

The readiness score (0-100) measures how complete a company profile is:

| Factor | Points | Weight |
|--------|--------|--------|
| Company name | 10 | Required |
| Industry | 10 | Required |
| Company stage | 10 | Required |
| One-liner | 10 | Required |
| Differentiator | 10 | Required |
| Target customer | 10 | Required |
| Currently raising | 5 | Important |
| Funding amount | 5 | Important |
| Round type | 5 | Important |
| MRR | 5 | Nice to have |
| Customer count | 5 | Nice to have |
| Employee count | 5 | Nice to have |
| Has pitch deck | 10 | Important |

**Score ranges:**
- 80-100: Profile is strong. Start discovering investors.
- 50-79: Good progress. Complete a few more fields.
- 0-49: Complete your profile to improve matching.

## How Company Intelligence Is Used

### → Investor Matching

Company stage, industry, and geography are used to filter and score investors:

```
Company: Seed-stage FinTech in US
     ↓
Filter: Investors who invest in Seed + FinTech + US
     ↓
Score: Weight by sector fit, stage fit, geography fit
     ↓
Result: Ranked list of relevant investors
```

### → Pitch Deck Generation (Planned)

Company data feeds directly into deck content:

```
Company name + one-liner → Cover slide
Problem + solution → Problem/Solution slides
Traction metrics → Traction slide
Team members → Team slide
Fundraising details → The Ask slide
```

### → Outreach Personalization

Company information personalizes every outreach email:

```
"Hi [Investor], I'm building [Company] — [one-liner].
We're [stage] with [traction metric].
Your investment in [portfolio company] shows alignment with [sector]."
```

### → Copilot Context

The AI Copilot uses company data to provide contextual advice:

```
User: "Which investors should I target?"
Copilot: "Based on your Seed-stage FinTech focus and $50K MRR,
          here are the top 5 investors in your pipeline..."
```

## Current State vs Future

| Capability | Status |
|------------|--------|
| Onboarding data collection | ✅ Implemented |
| Company profile storage | ✅ Implemented |
| Readiness score calculation | ✅ Implemented |
| Dashboard integration | ✅ Implemented |
| Website intelligence extraction | 🔵 Planned |
| Document content analysis | 🔵 Planned |
| Dynamic readiness updates | 🔵 Planned |
| Company research summaries | 🔵 Planned |

---

*Last updated: August 22, 2026*
