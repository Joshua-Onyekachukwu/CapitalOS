# Architecture — Capital-OS

## Overview

Capital-OS is a full-stack web application built on the Next.js App Router pattern with Supabase as the backend infrastructure and NVIDIA APIs as the intelligence layer.

---

## High-Level Architecture

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
                    │ Copilot Streaming     │
                    │ React Server Comps    │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
       ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐
       │  SUPABASE   │  │  AI LAYER   │  │   EMAIL     │
       │             │  │             │  │ PROVIDER    │
       │ PostgreSQL  │  │ NVIDIA      │  │             │
       │ pgvector    │  │ NIM LLM     │  │ Resend (V1) │
       │ Storage     │  │ Embeddings  │  │ Gmail (V2)  │
       │ Realtime    │  │ Reranking   │  │ Outlook(V2) │
       │ Edge Fn     │  │             │  │             │
       └─────────────┘  └─────────────┘  └─────────────┘
              │                 │
              └────────┬────────┘
                       ▼
                AGENT STATE MACHINE
                       │
          ┌────────────┼─────────────┐
          ▼            ▼             ▼
        Scout       Research       Match
          │            │             │
          └────────────┼─────────────┘
                       ▼
                    Outreach
                       │
                       ▼
                     Reply
                       │
                       ▼
                    Meeting
                       │
                       ▼
                   Fundraising
```

---

## Layers

### 1. Presentation Layer (Trezo UI)

The UI is built on the Trezo template and renders in the browser.

**Responsibilities:**
- Render dashboard, CRM views, Kanban, email center
- Handle user interactions (clicks, drags, form input)
- Manage local UI state (filters, modals, selections)
- Display real-time updates via Supabase Realtime

**Technology:**
- React 19 (Server Components + Client Components)
- Tailwind CSS
- Trezo template components
- TanStack Query for client-side data fetching

### 2. Application Layer (Next.js on Vercel)

Server-side logic runs in Next.js server components, server actions, and API routes.

**Responsibilities:**
- Authentication and session management
- Server-side data fetching
- AI Copilot streaming
- API route handling
- Input validation
- Server-side rendering

**Server / Client Boundary Rule:**
- **Server:** Database, AI, secrets, email, auth-sensitive operations
- **Client:** UI, drag-and-drop, interactive filters, local state

### 3. Data Layer (Supabase)

Supabase provides the entire backend infrastructure.

**Responsibilities:**
- PostgreSQL database (system of record)
- pgvector (semantic search)
- Row Level Security (data isolation)
- File storage (documents, decks)
- Realtime subscriptions
- Edge Functions (background tasks)
- pg_cron (scheduled jobs)

### 4. Intelligence Layer (NVIDIA AI)

NVIDIA NIM APIs provide all AI capabilities.

**Responsibilities:**
- LLM reasoning and generation
- Text embeddings
- Reranking
- Classification
- Content extraction
- Email writing

### 5. Integration Layer

External service integrations.

**Responsibilities:**
- Email sending/receiving (Resend V1)
- Analytics (PostHog)
- Error tracking (Sentry)
- Uptime monitoring (Better Stack)

---

## Data Flow

### Investor Discovery Flow

```
Founder requests investor search
        │
        ▼
┌─────────────────┐
│  Scout Agent     │ ── Discovers investors from multiple sources
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  SQL Hard Filters│ ── Stage, geography, check size, active status
└────────┬────────┘
         │  ~10,000 → ~3,000
         ▼
┌─────────────────┐
│  Embeddings      │ ── NVIDIA embedding API, pgvector search
└────────┬────────┘
         │  ~3,000 → ~500
         ▼
┌─────────────────┐
│  Reranking       │ ── NVIDIA NeMo Retriever reranking
└────────┬────────┘
         │  ~500 → ~100
         ▼
┌─────────────────┐
│  Reasoning       │ ── Strong LLM evaluates fit, strategy, concerns
└────────┬────────┘
         │  ~100 → ~50
         ▼
┌─────────────────┐
│  Ranked Results  │ ── Displayed to founder with scores and reasoning
└─────────────────┘
```

### Email Outreach Flow

```
Founder selects investor for outreach
        │
        ▼
┌─────────────────┐
│  Context Assembly│ ── Startup profile + investor intelligence
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI Draft        │ ── Personalized email generation
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Guardrail Check │ ── Hallucination, tone, compliance
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Founder Review  │ ── Edit, approve, or reject
└────────┬────────┘
         │ (approved)
         ▼
┌─────────────────┐
│  Compliance Check│ ── Opt-out, rate limit, suppression
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Send Email      │ ── Via email provider (Resend)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Track & Log     │ ── Audit log, email record, open tracking
└─────────────────┘
```

### Reply Processing Flow

```
Email received (polling/webhook)
        │
        ▼
┌─────────────────┐
│  Event Validation│ ── Verify sender, deduplicate
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Idempotency    │ ── Check processed_events
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Store Raw Email│ ── Save to emails table
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI Classification│ ── Interested, passed, question, opt-out
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Pipeline Update│ ── Move investor in Kanban
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Notify Founder │ ── Realtime + notification
└─────────────────┘
```

---

## Agent State Machine

Agents are **database-driven**, not in-memory processes.

### Agent Task States

```
pending → running → completed
                  → failed → retrying → running
                  → waiting
                  → awaiting_approval → running
                  → cancelled
```

### Agent Task Table

Every task has:

```sql
agent_tasks (
  id UUID PRIMARY KEY,
  startup_id UUID,
  campaign_id UUID,
  agent_type TEXT,         -- 'scout', 'researcher', 'matcher', 'writer', etc.
  status TEXT,             -- 'pending', 'running', 'completed', 'failed', etc.
  priority INTEGER,
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  model_used TEXT,
  attempt_count INTEGER,
  max_attempts INTEGER,
  batch_id UUID,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
)
```

### Agent Workflow

```
Director Agent creates tasks
        │
        ├── Scout Agent → Discover investors
        │
        ├── Researcher Agent → Research each investor
        │
        ├── Matcher Agent → Score and rank
        │       ├── Embedding sub-task
        │       └── Reranking sub-task
        │
        ├── Writer Agent → Draft emails
        │
        ├── Reply Agent → Classify inbound emails
        │
        └── Meeting Agent → Prepare briefs, summarize notes
```

---

## Caching Strategy

### Vercel ISR (Static Pages)

```typescript
// Landing page — revalidate hourly
export const revalidate = 3600;
```

### React Server Components

```typescript
// Dashboard pages — revalidate every minute
export const revalidate = 60;
```

### Client-Side (TanStack Query)

```typescript
// Dynamic data — 5 minute stale time
staleTime: 5 * 60 * 1000;
```

### Database Optimization

- Indexes on frequently queried columns
- Pagination for large lists
- Specific column selection (no `SELECT *`)
- EXPLAIN ANALYZE for slow queries

---

## Cancellation & Error Handling

### Task Cancellation

```sql
UPDATE agent_tasks
SET status = 'cancelled'
WHERE batch_id = $batch_id
  AND status IN ('pending', 'running');
```

### Error Recovery

```sql
UPDATE agent_tasks
SET status = 'retrying', attempt_count = attempt_count + 1
WHERE batch_id = $batch_id
  AND status = 'failed'
  AND attempt_count < max_attempts;
```

### UI Error States

Every page/feature shows:
- **Loading state** — skeleton/spinner
- **Empty state** — helpful message + action
- **Error state** — what failed + retry option
- **Success state** — results + next actions

---

## Security Boundaries

| Boundary | Rule |
|----------|------|
| Browser ↔ Server | Secrets never leave server |
| User ↔ User | RLS isolates all data |
| AI ↔ Database | AI generates, database validates |
| Email ↔ System | Incoming email is untrusted data |
| External content ↔ AI | External content is data, not instructions |

---

## Environment Separation

| Environment | URL | Database | AI |
|-------------|-----|----------|-----|
| Local | localhost:3000 | Supabase local | Mock mode |
| Preview | Vercel preview URL | Supabase staging | Real NVIDIA |
| Production | app URL | Supabase production | Real NVIDIA |

---

## Deployment Pipeline

```
Push to feature branch
        │
        ▼
┌─────────────────┐
│  CI: Lint + Type + Test│
└────────┬────────┘
         │ (pass)
         ▼
┌─────────────────┐
│  Vercel Preview  │ ── Auto-deploy preview
└────────┬────────┘
         │ (merge to develop)
         ▼
┌─────────────────┐
│  Vercel Staging  │ ── Staging deployment
└────────┬────────┘
         │ (merge to main)
         ▼
┌─────────────────┐
│  Vercel Production│ ── Production deployment
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PostHog Monitor │ ── Watch for regressions
└─────────────────┘
```
