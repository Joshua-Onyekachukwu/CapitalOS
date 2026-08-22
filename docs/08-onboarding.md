# Capital OS — Onboarding System

## Overview

The onboarding system collects information about a founder's company through a **7-step progressive flow**. This data becomes the foundation for investor matching, pitch deck generation, outreach personalization, and the entire platform experience.

## Flow

```
Signup → Step 1: Company Identity → Step 2: What You Build → Step 3: Fundraising
    → Step 4: Traction → Step 5: Team → Step 6: Documents → Step 7: Review & Launch
    → Dashboard (seeded with company data)
```

## Step Details

### Step 1 — Company Identity *(Required)*
- Company name
- Website URL
- Industry/sector (from `investor_sectors` taxonomy)
- Location/headquarters
- Company stage (Pre-Seed → Growth)
- Business model (SaaS, Marketplace, Hardware, Services, Consumer, Other)

### Step 2 — What You Build *(Required)*
- One-sentence description
- Detailed description (2-3 paragraphs, optional)
- Key differentiator
- Target customer

### Step 3 — Fundraising *(Required if raising)*
- Currently raising? Yes / No / Planning to
- Funding amount
- Round type
- Target investor geographies (multi-select)
- Have a pitch deck? → Offer generation if no

### Step 4 — Traction *(Optional but encouraged)*
- MRR / ARR
- Customer count
- Growth rate
- Key milestones (comma-separated)
- Employee count

### Step 5 — Team *(Optional)*
- Add team members with name, title, LinkedIn URL
- Mark founders vs team members
- Add multiple members

### Step 6 — Documents *(Optional)*
- Drag & drop upload zone
- Supports PDF, PPTX, DOCX
- Pitch decks, business plans, financial models

### Step 7 — Review & Launch
- Summary of all provided information
- Readiness score display
- "Launch Workspace" button → Dashboard

## Key Features

| Feature | Description |
|---------|-------------|
| **Auto-save** | Progress saved at every step via `updateCompanyProfile()` |
| **Resume** | User returns to last completed step |
| **Skip** | "Skip for now" link on every step (except Review) |
| **Redirect** | Completed users are redirected to dashboard |
| **Readiness Score** | Calculated from 13 factors (0-100) |

## Readiness Score Calculation

The readiness score is calculated from 13 weighted factors:

| Factor | Points |
|--------|--------|
| Company name | 10 |
| Industry | 10 |
| Company stage | 10 |
| One-liner description | 10 |
| Differentiator | 10 |
| Target customer | 10 |
| Currently raising | 5 |
| Funding amount | 5 |
| Round type | 5 |
| MRR | 5 |
| Customer count | 5 |
| Employee count | 5 |
| Has pitch deck | 10 |
| **Maximum** | **100** |

## Data Flow After Onboarding

```
Onboarding Data
     ↓
company_profiles table (structured fields)
     ↓
     ├──→ Dashboard seeding (welcome message, readiness score, next steps)
     ├──→ Investor matching (stage, sector, geography filters)
     ├──→ Fit scoring (company attributes vs investor preferences)
     ├──→ Outreach personalization (company description, traction)
     ├──→ Pitch deck content (company info, team, metrics)
     └──→ Copilot context (company data in AI chat)
```

## Dashboard Integration

After onboarding completion, the dashboard shows:
- **Company readiness score** with improvement suggestions
- **Personalized next steps** based on what's missing
- **Company name** in welcome message
- **Onboarding CTA** if not completed

## Implementation

| Component | File | Status |
|-----------|------|--------|
| Onboarding page | `src/app/onboarding/page.tsx` | ✅ Built |
| Company profile CRUD | `src/lib/actions/company.ts` | ✅ Built |
| Readiness calculation | `src/lib/actions/company.ts` | ✅ Built |
| Dashboard integration | `src/app/dashboard/page.tsx` | ✅ Built |
| Sidebar link | `src/components/Dashboard/Sidebar.tsx` | ✅ Built |

---

*Last updated: August 22, 2026*
