# Capital OS — System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USER (Browser)                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     FRONTEND (Next.js)                       │
│  Landing Page · Dashboard · Onboarding · Auth · Admin        │
└──────────────────────────┬──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Server       │  │ API Routes   │  │ Client-Side  │
│ Actions      │  │              │  │ Components   │
│ (RSC + SSR)  │  │ /api/*       │  │ (use client) │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                  │
       └─────────────────┼──────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│                                                              │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ Auth        │ │ Billing      │ │ Company Intelligence │ │
│  │ (Supabase)  │ │ (Plans/Credit│ │ (Profiles/Onboarding)│ │
│  └─────────────┘ └──────────────┘ └──────────────────────┘ │
│                                                              │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ Investor    │ │ Email        │ │ Outreach             │ │
│  │ Intelligence│ │ OAuth/Send   │ │ Campaigns/Drafts     │ │
│  └─────────────┘ └──────────────┘ └──────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Intelligence │  │ NVIDIA NIM   │  │ External     │
│ Layer        │  │ AI Client    │  │ Services     │
│ (Normalize,  │  │ (5 keys,     │  │ (Apollo,     │
│  Match,      │  │  rotation)   │  │  EDGAR,      │
│  Score)      │  │              │  │  Gmail,      │
│              │  │              │  │  Outlook)    │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                  │
       └─────────────────┼──────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    DATA LAYER                                │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Supabase PostgreSQL                     │    │
│  │                                                      │    │
│  │  profiles · company_profiles · investors             │    │
│  │  investor_firms · investor_profiles                  │    │
│  │  raw_records · duplicate_candidates                  │    │
│  │  data_change_log · firm_aliases                      │    │
│  │  email_accounts · email_messages                     │    │
│  │  campaign_investors · saved_investors                │    │
│  │  billing_plans · user_subscriptions                  │    │
│  │  credit_ledger · credit_costs                        │    │
│  │  company_team_members · company_documents            │    │
│  │  data_providers · data_acquisition_jobs              │    │
│  │  investor_sectors · investor_search_history          │    │
│  │  admin_audit_log                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Supabase Auth   │  │ Supabase        │                   │
│  │ (Email/Password │  │ Storage         │                   │
│  │  + OAuth)       │  │ (Files/Decks)   │                   │
│  └─────────────────┘  └─────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 (App Router) | React framework, SSR, RSC |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Icons** | Remix Icon | Icon library |
| **Database** | Supabase (PostgreSQL) | Data storage, auth, RLS |
| **Auth** | Supabase Auth | Email/password, session management |
| **AI** | NVIDIA NIM API | LLM inference (5-key rotation) |
| **AI Models** | Llama 3.3 Nemotron Super 49B | All AI tasks |
| **Email** | Google Gmail API + Microsoft Graph | OAuth email sending |
| **Hosting** | Vercel | Frontend deployment |
| **Repo** | GitHub | Source control |
| **Language** | TypeScript | Full-stack type safety |

## Data Flow: Investor Intelligence

```
CSV/API/Scraper
     ↓
Raw Records (staging)
     ↓
Normalization (names, stages, sectors, countries)
     ↓
Entity Resolution (email, LinkedIn, name+firm matching)
     ↓
Deduplication (exact + probabilistic)
     ↓
Canonical Investor Records
     ↓
Qualification (fit scoring, readiness assessment)
     ↓
Investor Intelligence (searchable, scored, qualified)
     ↓
Outreach (personalized email drafting)
```

## Data Flow: Company Intelligence

```
Onboarding (7 steps)
     ↓
Company Profile (structured data)
     +
Website Analysis (meta tags, positioning)
     +
Document Analysis (uploaded materials)
     ↓
Company Intelligence Profile
     ↓
     ├──→ Investor Matching (stage, sector, geography fit)
     ├──→ Pitch Deck Generation (content, design direction)
     ├──→ Outreach Personalization (company-specific messaging)
     └──→ Fundraising Strategy (recommendations)
```

## Request Flow

### Server Component (Dashboard, Investors page)
```
Browser → Next.js SSR → Server Action → Supabase → Response → Rendered HTML
```

### Client Component (Copilot, Outreach)
```
Browser → Client Component → API Route → Server Action → AI/Supabase → JSON → Client Update
```

### Background Processing (Import, Qualification)
```
Admin UI → API Route → Pipeline Service → Supabase (batch insert) → Response
```

## Environment Configuration

| Variable | Purpose | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server only) | ✅ |
| `NVIDIA_API_KEY_1` through `NVIDIA_API_KEY_5` | NVIDIA NIM API keys | ✅ |
| `APOLLO_API_KEY` | Apollo data provider | Optional |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail OAuth | Optional |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Outlook OAuth | Optional |
| `EMAIL_TOKEN_ENCRYPTION_KEY` | AES-256 key for OAuth tokens | Optional |

---

*Last updated: August 22, 2026*
