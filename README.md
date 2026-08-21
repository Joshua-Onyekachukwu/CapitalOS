# Capital-OS

**AI-Powered Investor Intelligence, Outreach & Fundraising Operating System**

Fundraise AI is an AI-powered fundraising operating system that helps founders discover relevant investors, understand their investment thesis, qualify investor fit, prepare personalized outreach, manage conversations, schedule follow-ups, and move qualified investors through a fundraising pipeline.

> "Find the right investors, understand why they are relevant, reach out intelligently, and manage the entire fundraising process from one place."

---

## What It Does

- **AI Startup Intelligence** — Upload a pitch deck, and AI builds your startup investment profile
- **Investor Discovery** — AI finds and scores investors by stage, sector, geography, and thesis fit
- **Semantic Matching** — Multi-layer matching: SQL filters → embeddings → reranking → reasoning
- **Investor Research** — Automated deep research on each investor with evidence and sources
- **Personalized Outreach** — AI drafts personalized emails based on investor intelligence
- **Fundraising Pipeline** — Kanban board to manage investors from discovery to close
- **Reply Intelligence** — AI classifies inbound replies and recommends next actions
- **Meeting Management** — AI-generated meeting briefs and post-meeting action items
- **Fundraising Copilot** — Natural language interface to operate the entire system
- **Analytics** — Real-time fundraising metrics, conversion rates, and AI performance

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React, TypeScript, Tailwind CSS |
| UI Foundation | Trezo Admin/Dashboard/Landing Page Template |
| Hosting | Vercel |
| Database | Supabase (PostgreSQL, pgvector) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Realtime | Supabase Realtime |
| Background Jobs | Supabase Edge Functions, pg_cron |
| AI / LLM | NVIDIA NIM APIs (LLM, Embeddings, Reranking) |
| Email | Resend (V1), Gmail/Outlook (V2) |
| Monitoring | Sentry, Better Stack |
| Analytics | PostHog |
| Source Control | GitHub |

---

## Architecture

```
                    ┌───────────────────────┐
                    │       TREZO UI        │
                    │ Landing / Dashboard   │
                    │ CRM / Kanban / Chat   │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │       NEXT.JS         │
                    │       VERCEL          │
                    │                       │
                    │ Server Actions        │
                    │ API Routes            │
                    │ Copilot               │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
       ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐
       │  SUPABASE   │  │  AI LAYER   │  │   EMAIL     │
       │             │  │             │  │ PROVIDER    │
       │ PostgreSQL  │  │ NVIDIA      │  │             │
       │ pgvector    │  │ LLM         │  │ Resend      │
       │ Storage     │  │ Embedding   │  │             │
       │ Realtime    │  │ Reranking   │  │             │
       │ Edge Fn     │  │             │  │             │
       └─────────────┘  └─────────────┘  └─────────────┘
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm
- Supabase CLI
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/Joshua-Onyekachukwu/CapitalOS.git
cd CapitalOS

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Start Supabase locally
supabase start

# Apply database migrations
supabase db reset

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
CapitalOS/
├── app/                        # Next.js App Router
│   ├── (marketing)/            # Public landing page
│   ├── (auth)/                 # Authentication pages
│   ├── (dashboard)/            # Protected dashboard
│   │   ├── page.tsx            # Dashboard home
│   │   ├── startup/            # Startup management
│   │   ├── investors/          # Investor database
│   │   ├── campaigns/          # Fundraising campaigns
│   │   ├── outreach/           # Email center
│   │   ├── meetings/           # Meeting management
│   │   ├── analytics/          # Fundraising analytics
│   │   ├── activity/           # AI activity center
│   │   └── settings/           # User settings
│   └── api/                    # API routes
├── components/                 # React components
│   ├── ui/                     # Shared UI primitives
│   ├── dashboard/              # Dashboard components
│   ├── startup/                # Startup components
│   ├── investors/              # Investor components
│   ├── campaigns/              # Campaign components
│   ├── kanban/                 # Kanban board
│   ├── copilot/                # AI Copilot
│   └── emails/                 # Email components
├── lib/                        # Shared libraries
│   ├── supabase/               # Supabase clients
│   ├── nvidia/                 # NVIDIA AI integration
│   ├── agents/                 # AI agent system
│   ├── email/                  # Email provider abstraction
│   ├── matching/               # Investor matching
│   ├── documents/              # Document processing
│   ├── compliance/             # Compliance engine
│   └── validators/             # Zod schemas
├── supabase/                   # Supabase configuration
│   ├── migrations/             # Database migrations
│   └── functions/              # Edge functions
├── types/                      # TypeScript types
├── schemas/                    # Zod validation schemas
├── docs/                       # Documentation
├── scripts/                    # Build & utility scripts
└── tests/                      # Test files
```

---

## Core Product Modules

| Module | Description | Phase |
|--------|-------------|-------|
| Startup Intelligence | AI intake, document processing, profile building | 2 |
| Investor Database | Investor firms, contacts, sources, deduplication | 3 |
| Investor Matching | Multi-layer matching with embeddings and reranking | 4 |
| Fundraising Campaigns | Campaign management, Kanban pipeline | 5 |
| Outreach Engine | Email drafting, personalization, approval, sending | 6 |
| Reply Intelligence | Reply detection, classification, pipeline updates | 7 |
| Fundraising Copilot | Natural language interface for the system | 8 |
| Analytics | Fundraising metrics, conversion, AI performance | 9 |

---

## Key Principles

1. **Intelligence First** — Not just data collection, but understanding and reasoning
2. **Quality Over Mass Spam** — Relevant investors, personalized outreach
3. **Human-in-the-Loop** — Founder approves all external actions
4. **Evidence Before Reasoning** — Every claim has a source; AI never fabricates
5. **Database as System of Record** — AI generates, database stores truth

---

## Security

- Row Level Security (RLS) on all tables
- Server-side secrets only (never exposed to browser)
- Signed storage URLs
- Idempotent event processing
- Opt-out hard stops
- Rate limiting
- Audit logging

See [docs/SECURITY.md](docs/SECURITY.md) for details.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

---

## License

See [LICENSE](LICENSE).

---

## Documentation

| Document | Description |
|----------|-------------|
| [Master Specification](MASTER_DEVELOPMENT_SPEC_V1.1.md) | Authoritative product & engineering spec |
| [Development Plan](DEVELOPMENT_PLAN.md) | Phase-by-phase build plan |
| [Architecture](docs/ARCHITECTURE.md) | System architecture details |
| [Database Schema](docs/DATABASE_SCHEMA.md) | Complete database schema |
| [AI Architecture](docs/AI_ARCHITECTURE.md) | NVIDIA AI integration |
| [Agent System](docs/AGENT_SYSTEM.md) | AI agent orchestration |
| [Email Integration](docs/EMAIL_INTEGRATION.md) | Email provider architecture |
| [Deployment](docs/DEPLOYMENT.md) | Deployment guide |
| [Environment Setup](docs/ENVIRONMENT_SETUP.md) | Local development setup |
| [Security](docs/SECURITY.md) | Security practices |
| [Testing](docs/TESTING.md) | Testing strategy |
| [Accessibility](docs/ACCESSIBILITY.md) | WCAG 2.1 AA compliance |
| [Disaster Recovery](docs/DISASTER_RECOVERY.md) | Backup & recovery plan |
| [API Reference](docs/API_REFERENCE.md) | API documentation |
| [Trezo Integration](docs/TREZO_INTEGRATION.md) | Template integration guide |
| [Changelog](CHANGELOG.md) | Version history |
