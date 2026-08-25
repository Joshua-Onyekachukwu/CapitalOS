# Capital OS

**AI-Powered Fundraising Operating System for Startup Founders**

Capital OS helps founders discover relevant investors, understand their investment thesis, qualify investor fit, prepare personalized outreach, and manage the entire fundraising process from one place.

> "Tell us about your company. Capital OS understands your business, discovers the right investors, helps you prepare your materials, and assists you in reaching out — intelligently and personally."

---

## Architecture Overview

Capital OS uses a **hybrid architecture** — Supabase handles auth + investor data (122K+ records) while CockroachDB is kept as a backup data store.

```
┌──────────────────────────────────────────────────────────────────┐
│                        Your Browser                              │
│                   (Next.js 15 App Router)                        │
├────────────────────────────────┬─────────────────────────────────┤
│  Supabase (Auth + Data)        │  CockroachDB (Backup)           │
│                                │                                 │
│  • Login / Signup              │  • Historical data backup       │
│  • 122K+ Investors (hot)       │  • 10GB free storage            │
│  • OAuth (Google, Microsoft)   │  • Restore capability           │
│  • Campaigns & Sequences       │  • Migration scripts            │
│  • Email Accounts & Messages   │  • Graceful fallback if down    │
│  • Documents & Team Members    │                                 │
│  • AI-powered fit scoring      │  DATABASE_URL not set = skip    │
│                                │                                 │
│  @supabase/ssr                 │  pg (node-postgres)             │
│  @supabase/supabase-js         │                                 │
│                                │  src/lib/db.ts                  │
│  NEXT_PUBLIC_SUPABASE_*        │  DATABASE_URL                   │
└────────────────────────────────┴─────────────────────────────────┘
```

### Why Hybrid?

| Factor | Hybrid (Supabase Auth + CockroachDB) | CockroachDB Only |
|--------|--------------------------------------|-------------------|
| Auth effort | Zero — already working | Weeks (login, signup, OAuth, sessions) |
| Code changes | Swap data queries gradually | Rewrite all + build auth from scratch |
| Security risk | Low — battle-tested auth | Higher — custom auth risks |
| Time to working app | Days | Weeks to months |

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
# Edit .env.local with your credentials (see Environment Variables below)

# Dev server
npm run dev
```

Open [http://localhost:3456](http://localhost:3456).

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | CockroachDB connection string | `postgresql://user:pass@host:26257/defaultdb?sslmode=verify-full` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) | `eyJhbGci...` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `NVIDIA_API_KEY` | NVIDIA NIM API key for AI features | — |
| `AI_MOCK_MODE` | Use mock AI responses (no API calls) | `true` |
| `NEXT_PUBLIC_APP_URL` | App URL | `http://localhost:3456` |

### Database Setup

```bash
# 1. Create CockroachDB schema + seed data
npx tsx scripts/setup-cockroachdb.ts

# 2. Seed realistic investor/firm/company data
node scripts/seed-real-data.js

# 3. Enable Row-Level Security
npx tsx scripts/enable-rls.ts
```

### Supabase Migrations

Run these in Supabase SQL Editor in order:

1. `supabase/migrations/001_profiles_and_triggers.sql`
2. `supabase/migrations/002_investor_intelligence.sql`
3. `supabase/migrations/003_intelligence_pipeline.sql`
4. `supabase/migrations/004_company_intelligence_billing.sql`
5. `supabase/migrations/005_billing_state_threads_jobs.sql`
6. `supabase/migrations/006_search_intelligence_enhancements.sql`
7. `supabase/migrations/007_followup_sequences.sql`
8. `supabase/migrations/008_email_tracking.sql`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React, TypeScript, Tailwind CSS |
| Icons | Remix Icon |
| Auth | Supabase Auth (email/password, OAuth) |
| Database | CockroachDB Serverless (PostgreSQL-compatible) |
| DB Driver | node-postgres (`pg`) with connection pooling |
| AI | NVIDIA NIM API (Llama 3.3 Nemotron Super 49B) |
| Email | Google Gmail API + Microsoft Graph (OAuth) |
| Hosting | Vercel |
| Charts | Recharts |
| DnD | @dnd-kit (pitch deck slide reorder) |
| Source Control | GitHub |

---

## Data Flow

### 1. Authentication Flow (Supabase)

```
Browser → Next.js Middleware → Supabase Auth
                                    │
                    ┌───────────────┴───────────────┐
                    │  Authenticated?                │
                    │  YES → pass through            │
                    │  NO  → redirect to /login      │
                    └───────────────────────────────┘
```

- `src/lib/supabase/middleware.ts` — protects `/dashboard/*`, `/investors/*`, `/campaigns/*`
- `src/lib/supabase/server.ts` — server-side auth client
- `src/lib/supabase/client.ts` — browser-side auth client
- `src/lib/auth.ts` — `getCurrentUser()` / `requireUser()` helper

### 2. Data Flow (CockroachDB)

```
Dashboard Page (client)
        │
        │  fetch("/api/...")
        ▼
API Route (server)
        │
        │  import { query, queryAs } from "@/lib/db"
        ▼
CockroachDB Pool (pg)
        │
        │  SET app.user_id → RLS policies
        │  SELECT / INSERT / UPDATE / DELETE
        ▼
CockroachDB Serverless Cluster
```

Key files:

| File | Purpose |
|------|---------|
| `src/lib/db.ts` | Connection pool, retry logic, circuit breaker |
| `src/lib/auth.ts` | Gets current Supabase user (used by server actions) |
| `src/app/api/*/route.ts` | API routes that query CockroachDB |
| `src/lib/actions/*.ts` | Server actions (combine auth + data) |
| `src/lib/services/*.ts` | Business logic services |

### 3. How Queries Work

```typescript
// PUBLIC DATA — no user context needed
import { query } from "@/lib/db";
const investors = await query('SELECT * FROM investors WHERE is_active = true');

// TENANT-SCOPED DATA — always filter by user_id
import { queryAs } from "@/lib/db";
const saved = await queryAs(
  user.id,
  'SELECT * FROM saved_investors WHERE user_id = $1',
  [user.id]
);

// TRANSACTION — automatic retry on transient failures
import { transaction } from "@/lib/db";
const result = await transaction(async (tx) => {
  const [{ id }] = await tx.query('INSERT INTO ... RETURNING id');
  await tx.query('UPDATE ... WHERE id = $1', [id]);
  return id;
});
```

### 4. Pitch Deck Generation Flow

```
User clicks "Generate" → /api/deck/generate
        │
        ├─ 1. Fetch company profile (CockroachDB)
        ├─ 2. Call NVIDIA AI for slide content
        ├─ 3. Generate PPTX via pptxgenjs
        ├─ 4. Convert to PDF via LibreOffice
        ├─ 5. Upload both to Supabase Storage
        └─ 6. Save document record (CockroachDB)
```

### 5. Email Outreach Flow

```
User sends email → /api/outreach/send
        │
        ├─ 1. Fetch investor + email account (CockroachDB)
        ├─ 2. Decrypt OAuth token (AES-256-GCM)
        ├─ 3. Send via Gmail API or Microsoft Graph
        ├─ 4. Log email_message record (CockroachDB)
        └─ 5. Deduct credits (CockroachDB)
```

### 6. Investor Intelligence Pipeline

```
CSV Import / EDGAR Scraper / Apollo API
        │
        ├─ 1. raw_records (staging)
        ├─ 2. Normalization (field mapping, dedup)
        ├─ 3. investors (canonical)
        ├─ 4. Duplicate detection
        ├─ 5. Qualification scoring
        └─ 6. Fit scoring (vs company profile)
```

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/                    # Login, signup, password reset
│   ├── api/                       # API routes
│   │   ├── admin/                 # Admin data import
│   │   ├── auth/                  # OAuth callbacks (Google, Microsoft)
│   │   ├── campaigns/             # Campaign sequence execution
│   │   ├── dashboard/             # Dashboard data APIs
│   │   │   ├── admin/             # Admin health data
│   │   │   ├── analytics/         # Analytics aggregation
│   │   │   └── settings/          # Profile updates
│   │   ├── deck/                  # Pitch deck generation
│   │   ├── investors/             # Investor CRUD + search
│   │   └── outreach/              # Email sending
│   ├── dashboard/                 # Main app (13+ pages)
│   │   ├── analytics/             # Data health + charts
│   │   ├── campaigns/             # Outreach campaigns
│   │   ├── cockpit/               # Main dashboard view
│   │   ├── decks/                 # Pitch deck management
│   │   ├── documents/             # Document library
│   │   ├── investors/             # Investor browser + detail
│   │   └── settings/              # User settings
│   ├── onboarding/                # 7-step company setup
│   └── page.tsx                   # Landing page
├── components/
│   ├── Dashboard/                 # Sidebar, header, shared
│   ├── Landing/                   # Landing page sections
│   ├── Layout/                    # Navbar, footer, GoTop
│   └── ui/                        # 11 reusable UI primitives
├── lib/
│   ├── actions/                   # Server actions
│   │   ├── campaigns.ts           # Campaign CRUD
│   │   ├── company.ts             # Company profile + documents
│   │   ├── email.ts               # Email management
│   │   ├── email-sequences.ts     # Sequence CRUD
│   │   └── investor-research.ts   # AI research generation
│   ├── ai/                        # NVIDIA AI client
│   ├── auth.ts                    # Supabase auth helper
│   ├── billing/                   # Plans, credits, entitlements
│   │   ├── credits.ts             # Credit balance + deduction
│   │   ├── plans.ts               # Plan lookup
│   │   └── provider.ts            # Billing provider abstraction
│   ├── db.ts                      # CockroachDB pool + retry
│   ├── middleware/                 # Auth middleware (Supabase)
│   ├── services/
│   │   ├── campaigns/             # Sequence scheduling
│   │   ├── email/                 # OAuth, encryption, sending
│   │   ├── investor/              # Ingestion, matching, qualification
│   │   └── scrapers/              # SEC EDGAR scraper
│   ├── supabase/                  # Supabase client/server/middleware
│   └── validators/                # Auth validation
├── scripts/                       # DB scripts (CockroachDB)
│   ├── db.ts                      # Standalone DB helper for scripts
│   ├── enable-rls.ts              # Enable RLS on all tables
│   ├── seed-real-data.js          # Seed 5K investors, 106 firms
│   └── setup-cockroachdb.ts       # Create schema + indexes
└── scripts/                       # Root-level scripts
    ├── seed-real-data.js          # Data seeding
    └── enable-rls.ts              # RLS setup
```

---

## Database Scripts

### Setup & Migration

| Script | Command | Description |
|--------|---------|-------------|
| Setup schema | `npx tsx scripts/setup-cockroachdb.ts` | Creates all 34 tables, 65 indexes, 12 enums, seed data |
| Seed data | `node scripts/seed-real-data.js` | Inserts 5K investors, 106 firms, 40 companies |
| Enable RLS | `npx tsx scripts/enable-rls.ts` | Enables RLS on 20 tenant-protected tables |

### Data Management

| Script | Location | Description |
|--------|----------|-------------|
| Import Apollo CSV | `npx tsx src/scripts/import-apollo-csv.ts` | Import investor data from Apollo export |
| Fast CSV import | `npx tsx src/scripts/import-csv-fast.ts` | Bulk import test with validation |
| Generate investors | `npx tsx src/scripts/generate-investors.ts` | Generate 100K+ synthetic investors |
| Generate full dataset | `npx tsx src/scripts/generate-full-dataset.ts` | Generate firms + investors + employment history |
| Seed sectors | `npx tsx src/scripts/seed-sectors.ts` | Insert investor sector taxonomy |
| Cleanup DB | `npx tsx src/scripts/cleanup-db.ts` | Remove test data |

### Quality & Verification

| Script | Location | Description |
|--------|----------|-------------|
| Check count | `npx tsx src/scripts/check-count.ts` | Quick row count verification |
| Verify migration | `npx tsx src/scripts/verify-migration.ts` | Schema + data verification |
| Verify qualification | `npx tsx src/scripts/verify-qualification.ts` | Check qualification scores |
| Qualify investors | `npx tsx src/scripts/qualify-investors.ts` | Run qualification pipeline |
| Run bulk score | `npx tsx src/scripts/run-bulk-score.ts` | Batch fit scoring |

### Testing

| Script | Location | Description |
|--------|----------|-------------|
| Test Apollo pipeline | `npx tsx src/scripts/test-apollo-pipeline.ts` | End-to-end pipeline test |
| Test fresh import | `npx tsx src/scripts/test-fresh-import.ts` | Clean import test |
| Test stress import | `npx tsx src/scripts/test-stress-import.ts` | High-volume import test |
| EDGAR scrape | `npx tsx src/scripts/edgar-scrape.ts` | SEC EDGAR Form D scraper |
| Process EDGAR bulk | `npx tsx src/scripts/process-edgar-bulk.ts` | Process scraped EDGAR data |

---

## Database Schema

### CockroachDB Tables (34 total)

**Public/Shared Data (no RLS):**

| Table | Rows | Description |
|-------|------|-------------|
| `investors` | 5,000 | Canonical investor records |
| `investor_firms` | 106 | VC/PE/Angel firms |
| `investor_sectors` | 24 | Sector taxonomy |
| `investor_employment_history` | 2,991 | Investor ↔ firm links |
| `investor_data_sources` | — | Data provenance |
| `investor_profiles` | — | Enriched profiles |
| `data_providers` | — | Provider registry |
| `raw_records` | — | Ingestion staging |
| `duplicate_candidates` | — | Dedup candidates |
| `data_change_log` | — | Audit trail |
| `firm_aliases` | — | Firm name variants |
| `billing_plans` | 3 | Plan definitions |
| `credit_costs` | 8 | Credit cost catalog |
| `campaign_investors` | — | Campaign ↔ investor |

**Tenant-Protected Tables (RLS enabled):**

| Table | Tenant Key | Description |
|-------|-----------|-------------|
| `profiles` | `id` | User profiles |
| `company_profiles` | `user_id` | Company information |
| `company_documents` | `company_id` → `company_profiles.user_id` | Documents |
| `company_team_members` | `company_id` → `company_profiles.user_id` | Team members |
| `saved_investors` | `user_id` | User-saved investors |
| `email_accounts` | `user_id` | OAuth email configs |
| `email_messages` | `user_id` | Sent/received emails |
| `email_threads` | `user_id` | Email threads |
| `email_tracking_events` | `user_id` | Open/click tracking |
| `campaign_sequences` | `user_id` | Outreach sequences |
| `campaign_sequence_steps` | `sequence_id` → `campaign_sequences.user_id` | Sequence steps |
| `campaign_sequence_enrollments` | `user_id` | Enrolled investors |
| `campaign_sequence_emails` | `user_id` | Sequence emails |
| `data_acquisition_jobs` | `created_by` | Import/scrape jobs |
| `background_jobs` | `user_id` | Async jobs |
| `user_subscriptions` | `user_id` | Plan subscriptions |
| `credit_ledger` | `user_id` | Credit transactions |
| `billing_events` | `user_id` | Billing audit log |
| `admin_audit_log` | `user_id` | Admin operations |
| `investor_search_history` | `user_id` | Search queries |

### Row-Level Security (RLS)

RLS is enforced via a two-layer defense:

1. **Session variable**: `SET app.user_id = $1` — read by `app.current_user_id()` function
2. **Application filtering**: Queries always include `WHERE user_id = $1`

```sql
-- RLS policy example (saved_investors)
CREATE POLICY saved_investors_select ON saved_investors
  FOR SELECT USING (
    app.current_user_id() IS NOT NULL
    AND user_id = app.current_user_id()
  );
```

**Note**: CockroachDB Serverless does not fully enforce RLS SELECT policies using session variables. Application-level filtering is the primary isolation mechanism; RLS serves as defense-in-depth.

---

## Connection Pool & Resilience

`src/lib/db.ts` provides production-grade CockroachDB connectivity:

### Pool Configuration

| Setting | Value | Rationale |
|---------|-------|-----------|
| `max` | 15 | CockroachDB Serverless tenant limit |
| `min` | 2 | Keep warm connections ready |
| `idleTimeoutMillis` | 25,000 | Release before CRDB timeout |
| `connectionTimeoutMillis` | 8,000 | Fail fast on connection issues |
| `application_name` | `"capital-os"` | Visible in CRDB SQL stats |

### Retry Logic

- **3 attempts** with exponential backoff (200ms → 400ms → 800ms)
- Random jitter to avoid thundering herd
- Retries on: connection drops (`08006`), timeouts (`XX000`), network errors

### Circuit Breaker

- Opens after **5 consecutive failures** — blocks all queries
- Auto-resets after **30 seconds** — tests with limited requests
- Prevents cascading failures during CRDB outages

### Graceful Shutdown

```bash
# Automatic on SIGTERM/SIGINT
process.once("SIGTERM", shutdownHandler);
process.once("SIGINT", shutdownHandler);
```

### Monitoring

```typescript
import { getPoolStats } from "@/lib/db";

const stats = getPoolStats();
// { totalCount: 15, idleCount: 12, waitingCount: 0, circuitBreaker: { state: "closed", failures: 0 } }
```

---

## Billing & Credits

| Plan | Price | Credits/mo | Investor DB |
|------|-------|-----------|-------------|
| **Free** | $0 | 50 | 100 |
| **Workspace** | $29/mo | 500 | 5,000 |
| **Workspace Pro** | $79/mo | 2,000 | 50,000 |

Credit costs (per operation):

| Operation | Credits |
|-----------|---------|
| Investor search | 1 |
| AI match scoring | 2 |
| AI research | 3 |
| AI email draft | 2 |
| Email send | 1 |
| Fit analysis | 2 |
| CSV import | 1 per 100 rows |

---

## Development

### Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint
```

### Key Patterns

**Server Actions** (`src/lib/actions/*.ts`):
- Use `"use server"` directive
- Get user via `requireUser()` from `src/lib/auth.ts`
- Query data via `queryAs()` from `src/lib/db.ts`
- Return typed data (never raw Supabase results)

**API Routes** (`src/app/api/*/route.ts`):
- Export `GET` / `POST` handlers
- Use `query()` or `queryAs()` for data access
- Return `NextResponse.json()`

**Dashboard Pages** (`src/app/dashboard/*/page.tsx`):
- `"use client"` components
- Fetch data via API routes (`fetch("/api/...")`)
- Never import `@supabase/supabase-js` directly

---

## Documentation

Comprehensive documentation in the `docs/` directory:

| Document | Description |
|----------|-------------|
| [Executive Overview](docs/00-executive-overview.md) | What Capital OS is, why it exists |
| [Product Vision](docs/01-product-vision.md) | Principles, user journeys, use cases |
| [System Architecture](docs/02-system-architecture.md) | How all components connect |
| [Database Architecture](docs/03-database-architecture.md) | Complete data model |
| [Investor Intelligence](docs/04-investor-intelligence.md) | The investor data pipeline |
| [Company Intelligence](docs/05-company-intelligence.md) | How we understand each company |
| [AI Architecture](docs/06-ai-architecture.md) | All AI-powered components |
| [Pricing & Billing](docs/07-pricing-billing.md) | Model A, credits, plans |
| [Onboarding](docs/08-onboarding.md) | The 7-step onboarding experience |
| [Pitch Deck Engine](docs/09-pitch-deck-engine.md) | Deck generation system |
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

## Security

- **RLS** on 20 tenant-protected tables (defense-in-depth)
- **Application-level filtering** as primary data isolation
- **OAuth tokens** encrypted with AES-256-GCM
- **API keys** server-side only (never exposed to browser)
- **Credit enforcement** — operations require sufficient credits (server-side)
- **Audit logging** for admin operations
- **Connection pooling** with circuit breaker prevents cascading failures

---

## License

See [LICENSE](LICENSE).
