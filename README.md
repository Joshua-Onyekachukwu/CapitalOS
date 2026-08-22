# Capital OS

**AI-Powered Fundraising Operating System for Startup Founders**

Capital OS helps founders discover relevant investors, understand their investment thesis, qualify investor fit, prepare personalized outreach, and manage the entire fundraising process from one place.

> "Tell us about your company. Capital OS understands your business, discovers the right investors, helps you prepare your materials, and assists you in reaching out — intelligently and personally."

---

## What's Built

- **Onboarding** — 7-step progressive company setup with readiness scoring
- **Investor Intelligence** — Ingestion, normalization, deduplication, and qualification pipeline
- **Investor Database** — Search, filter, and browse 10K+ investors with fit scores
- **AI Copilot** — Natural language assistant with real investor data context
- **AI Research** — Generate investor research summaries with NVIDIA AI
- **Email Outreach** — AI-powered personalized email drafting + OAuth sending
- **Pipeline Management** — Kanban board tracking investors from discovery to meeting
- **Campaign Management** — Organize investors into outreach campaigns
- **CSV Import** — Bulk import with flexible column detection (20+ variants)
- **SEC EDGAR Scraper** — Fetch Form D filings from public records
- **Billing Architecture** — Model A (Fundraising Capacity) with credits and plans

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React, TypeScript, Tailwind CSS |
| Icons | Remix Icon |
| Database | Supabase (PostgreSQL 15+) |
| Auth | Supabase Auth (email/password) |
| AI | NVIDIA NIM API (Llama 3.3 Nemotron Super 49B) |
| Email | Google Gmail API + Microsoft Graph (OAuth) |
| Hosting | Vercel |
| Storage | Supabase Storage |
| Source Control | GitHub |

---

## Quick Start

```bash
# Clone
git clone https://github.com/Joshua-Onyekachukwu/CapitalOS.git
cd "Capital OS"

# Install
npm install

# Environment
cp .env.example .env.local
# Edit .env.local with Supabase + NVIDIA credentials

# Dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Database Migrations

Run these in Supabase SQL Editor in order:

1. `supabase/migrations/001_profiles_and_triggers.sql`
2. `supabase/migrations/002_investor_intelligence.sql`
3. `supabase/migrations/003_intelligence_pipeline.sql`
4. `supabase/migrations/004_company_intelligence_billing.sql`

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Login, signup, password reset
│   ├── admin/               # Admin dashboard (data sources, review)
│   ├── api/                 # API routes (AI, import, OAuth, search)
│   ├── dashboard/           # Main application (13 pages)
│   ├── onboarding/          # 7-step company setup
│   └── page.tsx             # Landing page
├── components/
│   ├── Dashboard/           # Sidebar, header, shared components
│   ├── Landing/             # Landing page sections
│   ├── Layout/              # Navbar, footer
│   └── ui/                  # Reusable UI primitives (11 components)
├── lib/
│   ├── actions/             # Server actions (12 modules)
│   ├── ai/                  # NVIDIA AI client (key rotation, models)
│   ├── billing/             # Plans, credits, entitlements
│   ├── providers/           # Apollo data provider
│   ├── services/
│   │   ├── email/           # OAuth, encryption, sending
│   │   ├── investor/        # Ingestion, normalization, matching, qualification
│   │   └── scrapers/        # SEC EDGAR scraper
│   ├── supabase/            # Server/client/middleware clients
│   └── validators/          # Auth validation
└── scripts/                 # Test and verification scripts
```

---

## Documentation

Comprehensive documentation lives in the `docs/` directory:

| Document | Description |
|----------|-------------|
| [Executive Overview](docs/00-executive-overview.md) | What Capital OS is, why it exists |
| [Product Vision](docs/01-product-vision.md) | Principles, user journeys, use cases |
| [System Architecture](docs/02-system-architecture.md) | How all components connect |
| [Database Architecture](docs/03-database-architecture.md) | Complete data model (25+ tables) |
| [Investor Intelligence](docs/04-investor-intelligence.md) | The investor data pipeline |
| [Company Intelligence](docs/05-company-intelligence.md) | How we understand each company |
| [AI Architecture](docs/06-ai-architecture.md) | All AI-powered components |
| [Pricing & Billing](docs/07-pricing-billing.md) | Model A, credits, plans |
| [Onboarding](docs/08-onboarding.md) | The 7-step onboarding experience |
| [Pitch Deck Engine](docs/09-pitch-deck-engine.md) | Future deck generation system |
| [Email & Outreach](docs/10-email-outreach.md) | Email integration and outreach |
| [Security](docs/11-security.md) | Authentication, RLS, tokens |
| [Infrastructure](docs/12-infrastructure.md) | Hosting, deployment, env |
| [Frontend & Backend](docs/13-frontend-backend.md) | Code architecture |
| [Feature Status](docs/14-feature-status.md) | What's built, what's planned |
| [Development Roadmap](docs/15-development-roadmap.md) | Phases 1-7+ |
| [Decision Log](docs/16-decision-log.md) | Architecture & product decisions |
| [Open Issues](docs/17-open-issues.md) | Known risks and tech debt |
| [Change Log](docs/18-changelog.md) | Chronological history |

---

## Pricing

| Plan | Price | Credits/mo | Investor DB |
|------|-------|-----------|-------------|
| **Free** | $0 | 50 | 100 |
| **Workspace** | $29/mo | 500 | 5,000 |
| **Workspace Pro** | $79/mo | 2,000 | 50,000 |

---

## Security

- Row Level Security (RLS) on every database table
- OAuth tokens encrypted with AES-256-GCM
- API keys server-side only (never exposed to browser)
- AI operations require credits (server-side enforcement)
- User data isolation via RLS policies
- Audit logging for admin operations

---

## License

See [LICENSE](LICENSE).
