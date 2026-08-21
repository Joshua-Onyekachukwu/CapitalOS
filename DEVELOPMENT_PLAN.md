# Development Plan — Capital-OS

## Master Build Plan

This is the authoritative development plan for Capital-OS, derived from the [Master Development Specification](MASTER_DEVELOPMENT_SPEC_V1.1.md).

---

## Build Order (Critical)

```
 1. Trezo audit
 2. Project foundation
 3. Supabase schema
 4. Authentication
 5. Startup creation
 6. Startup AI intake
 7. Document intelligence
 8. NVIDIA integration
 9. pgvector
10. Investor database
11. Investor discovery
12. Matching
13. Investor profile
14. Campaign
15. Kanban
16. Email integration
17. Outreach drafting
18. Human approval
19. Sending
20. Reply detection
21. Reply classification
22. Follow-ups
23. Meeting management
24. Copilot
25. Agent orchestration
26. Analytics
27. Security audit
28. Production hardening
```

---

## Phase 0 — Trezo Audit & Local Setup

### Duration: 1-2 days

### Goals
- Audit Trezo template components
- Set up local development environment
- Document reusable vs. new components

### Tasks

#### 0.1 Trezo Template Audit
- [ ] Receive Trezo template files
- [ ] Catalog all existing components
- [ ] Document reusable components (layout, sidebar, navbar, cards, tables, forms)
- [ ] Document components needing modification
- [ ] Document components to remove
- [ ] Identify new components needed
- [ ] Create `TREZO_INTEGRATION.md`

#### 0.2 Project Initialization
- [x] Initialize git repository
- [x] Save master specification
- [ ] Create Next.js project
- [ ] Configure TypeScript (strict mode)
- [ ] Set up Tailwind CSS with design tokens
- [ ] Configure ESLint + Prettier
- [ ] Set up Husky + lint-staged
- [ ] Configure path aliases (`@/`)
- [ ] Create `.env.example`

#### 0.3 Supabase Local Development
- [ ] Install Supabase CLI
- [ ] `supabase init`
- [ ] `supabase start`
- [ ] Verify local dashboard (localhost:54323)
- [ ] Create initial migration

### Deliverable
> Developer can run the project locally with Trezo template, Supabase, and development tooling.

---

## Phase 1 — Foundation

### Duration: 3-5 days

### Goals
- Authentication working
- Database schema for core tables
- Base dashboard visible
- Startup creation flow complete

### Tasks

#### 1.1 Database Schema
- [ ] profiles table
- [ ] startups table
- [ ] startup_documents table
- [ ] startup_document_chunks table (with pgvector)
- [ ] startup_preferences table
- [ ] RLS policies for all tables
- [ ] `updated_at` triggers
- [ ] Profile auto-creation trigger

#### 1.2 Authentication
- [ ] Supabase Auth setup
- [ ] Email/password signup
- [ ] Magic link login
- [ ] Auth middleware (protect dashboard routes)
- [ ] Auth callback route
- [ ] Logout flow
- [ ] Session management

#### 1.3 Supabase Clients
- [ ] Browser client (`lib/supabase/client.ts`)
- [ ] Server client (`lib/supabase/server.ts`)
- [ ] Admin client (`lib/supabase/admin.ts`)

#### 1.4 Base Layout (from Trezo)
- [ ] Dashboard layout with sidebar
- [ ] Navbar with user menu
- [ ] Navigation structure
- [ ] Responsive behavior
- [ ] Dark/light mode (if Trezo supports)

#### 1.5 Dashboard Home
- [ ] Welcome message
- [ ] Startup status card
- [ ] Quick actions
- [ ] Recent activity

#### 1.6 Startup Creation
- [ ] "Create Your Startup" page
- [ ] Form with name, description, website
- [ ] Server action for creation
- [ ] Redirect to startup profile
- [ ] Profile completeness indicator

### Deliverable
> Founder can register, log in, and create a startup.

---

## Phase 2 — Startup Intelligence

### Duration: 5-7 days

### Goals
- Documents uploaded and processed
- AI extracts structured data
- Startup profile built from AI + founder input
- Embeddings generated

### Tasks

#### 2.1 Document Upload
- [ ] Drag-and-drop upload zone
- [ ] File type validation
- [ ] Upload to Supabase Storage
- [ ] Create document record
- [ ] Upload progress indicator
- [ ] Document list page

#### 2.2 Document Processing
- [ ] Text extraction (PDF, DOCX, TXT)
- [ ] Store extracted text in document record
- [ ] Create document chunks
- [ ] Generate embeddings for chunks
- [ ] Store embeddings in pgvector

#### 2.3 NVIDIA Integration
- [ ] AI client abstraction (`lib/nvidia/client.ts`)
- [ ] Mock mode implementation
- [ ] Embedding generation
- [ ] Text generation
- [ ] Structured output with Zod validation

#### 2.4 AI Extraction
- [ ] Extract startup fields from documents
- [ ] Create preliminary startup profile
- [ ] Confidence scoring per field
- [ ] Source tracking

#### 2.5 AI Interview
- [ ] Identify missing information
- [ ] Generate targeted questions
- [ ] Copilot conversation flow
- [ ] Update profile from answers
- [ ] Profile completeness tracking

#### 2.6 Startup Profile Page
- [ ] Display all profile fields
- [ ] Completeness indicator
- [ ] Edit capabilities
- [ ] AI confidence indicators
- [ ] Source citations
- [ ] Finalize profile flow

### Deliverable
> System understands the startup from uploaded documents and founder input.

---

## Phase 3 — Investor Database

### Duration: 5-7 days

### Goals
- Investor schema complete
- Can search and filter investors
- Deduplication working
- Investor profiles rich

### Tasks

#### 3.1 Database Schema
- [ ] investor_firms table
- [ ] investors table
- [ ] investor_sources table
- [ ] investor_portfolios table
- [ ] investor_activity table
- [ ] investor_research table
- [ ] Indexes

#### 3.2 Investor CRUD
- [ ] Create/update/delete investors
- [ ] Create/update/delete firms
- [ ] Associate contacts with firms
- [ ] Tag and categorize

#### 3.3 Deduplication
- [ ] Detect by email, domain, LinkedIn URL
- [ ] Suggest merges
- [ ] Execute merges (preserve data)

#### 3.4 Search & Filtering
- [ ] Full-text search
- [ ] Filter by stage, sector, geography, check size
- [ ] Sort by relevance, name, score
- [ ] Pagination

#### 3.5 Investor Profile Page
- [ ] Overview section
- [ ] Investment thesis
- [ ] Portfolio companies
- [ ] Recent activity
- [ ] Sources
- [ ] Research notes

### Deliverable
> System can maintain a reliable, searchable investor database.

---

## Phase 4 — Matching

### Duration: 5-7 days

### Goals
- Multi-layer matching working
- Scores calculated and ranked
- AI reasoning on fit

### Tasks

#### 4.1 Hard Filters
- [ ] Stage compatibility
- [ ] Check size compatibility
- [ ] Geography compatibility
- [ ] Active status check
- [ ] Not already contacted
- [ ] Not opted out

#### 4.2 Semantic Matching
- [ ] Generate startup embedding
- [ ] Generate investor embeddings
- [ ] pgvector similarity search
- [ ] Top 500 candidates

#### 4.3 Reranking
- [ ] NVIDIA reranking API integration
- [ ] Rerank top 500 → top 100

#### 4.4 Scoring
- [ ] Compose fit score from components
- [ ] Assign priority (A+ through D)
- [ ] Generate reasons and concerns
- [ ] Recommend approach angle

#### 4.5 Reasoning
- [ ] 70B model evaluates fit
- [ ] Generate detailed analysis
- [ ] Evidence-based recommendations

### Deliverable
> System can rank investors intelligently with scores, reasons, and approach recommendations.

---

## Phase 5 — Campaigns

### Duration: 3-5 days

### Goals
- Campaign creation and management
- Kanban pipeline working
- Investor-to-campaign assignment

### Tasks

#### 5.1 Campaign Management
- [ ] Create/edit/delete campaigns
- [ ] Campaign settings
- [ ] Campaign status tracking
- [ ] Campaign stats

#### 5.2 Kanban Pipeline
- [ ] Pipeline stage columns
- [ ] Investor cards with key info
- [ ] Drag-and-drop between stages
- [ ] Keyboard alternative for drag
- [ ] Filter and search within pipeline

#### 5.3 Campaign-Investor Assignment
- [ ] Add investors to campaign
- [ ] Remove investors from campaign
- [ ] Bulk add from discovery
- [ ] Track per-investor stage

### Deliverable
> Founder can manage a fundraising campaign with a visual pipeline.

---

## Phase 6 — Outreach

### Duration: 5-7 days

### Goals
- Email drafts generated
- Founder review and approval
- Emails sent via Resend

### Tasks

#### 6.1 Email Provider
- [ ] Resend integration
- [ ] Provider abstraction interface
- [ ] Send email function
- [ ] Unsubscribe link generation

#### 6.2 Draft Generation
- [ ] Context assembly (startup + investor)
- [ ] AI email writing
- [ ] Personalization
- [ ] Guardrail checks
- [ ] Store as draft

#### 6.3 Approval Flow
- [ ] Draft review page
- [ ] Edit capabilities
- [ ] Regenerate option
- [ ] Approve/reject
- [ ] Batch approval

#### 6.4 Sending
- [ ] Compliance checks
- [ ] Rate limiting
- [ ] Opt-out verification
- [ ] Send via Resend
- [ ] Store sent record
- [ ] Audit log

#### 6.5 Threading
- [ ] Email thread creation
- [ ] Thread linking
- [ ] Thread history view

### Deliverable
> Founder can safely contact investors with personalized, approved emails.

---

## Phase 7 — Replies

### Duration: 3-5 days

### Goals
- Reply detection working
- AI classification functional
- Pipeline auto-updates

### Tasks

#### 7.1 Reply Detection
- [ ] Polling edge function
- [ ] pg_cron schedule
- [ ] Webhook endpoint (optional)
- [ ] Idempotency

#### 7.2 Classification
- [ ] AI reply classification
- [ ] Categories: interested, passed, question, opt-out, etc.
- [ ] Confidence scoring
- [ ] Recommended action

#### 7.3 Pipeline Updates
- [ ] Auto-move investor stage on reply
- [ ] Notification to founder
- [ ] Create recommended action

#### 7.4 Follow-ups
- [ ] Follow-up recommendations
- [ ] Timing logic
- [ ] Draft follow-up emails
- [ ] Founder approval

### Deliverable
> Incoming investor responses automatically update the CRM and trigger actions.

---

## Phase 8 — Copilot

### Duration: 5-7 days

### Goals
- Natural language interface working
- Context-aware responses
- Streaming responses

### Tasks

#### 8.1 Copilot Infrastructure
- [ ] Chat UI component
- [ ] Streaming response handling
- [ ] Context loading
- [ ] Message history

#### 8.2 Commands
- [ ] "Find investors" → trigger discovery
- [ ] "Why is this investor a fit?" → explain score
- [ ] "Research this investor" → trigger research
- [ ] "Draft an email" → generate draft
- [ ] "Who should I follow up with?" → analysis
- [ ] "Show my pipeline" → navigate/display

#### 8.3 Context
- [ ] Load startup profile
- [ ] Load campaign context
- [ ] Load investor data
- [ ] Load recent interactions

### Deliverable
> Founder can operate the fundraising system conversationally.

---

## Phase 9 — Analytics

### Duration: 3-5 days

### Goals
- Fundraising metrics dashboard
- Campaign performance tracking
- AI usage monitoring

### Tasks

#### 9.1 Fundraising Metrics
- [ ] Investors discovered/qualified/contacted
- [ ] Reply rate, meeting rate, conversion
- [ ] Pipeline velocity
- [ ] Funnel visualization

#### 9.2 Campaign Performance
- [ ] Per-campaign stats
- [ ] Time-based trends
- [ ] Comparative analysis

#### 9.3 AI Metrics
- [ ] API calls, tokens, latency
- [ ] Cost tracking
- [ ] Success/failure rates

#### 9.4 Weekly Report
- [ ] Auto-generated summary
- [ ] Key metrics
- [ ] Recommendations

### Deliverable
> Founder can track fundraising performance and AI efficiency.

---

## Phase 10 — Production Hardening

### Duration: 3-5 days

### Goals
- Security audit complete
- Performance optimized
- Monitoring active
- Ready for production

### Tasks

#### 10.1 Security Audit
- [ ] RLS audit (all tables)
- [ ] API key exposure check
- [ ] Input validation review
- [ ] Prompt security review
- [ ] Email compliance check

#### 10.2 Performance
- [ ] Database query optimization
- [ ] Index review
- [ ] Caching strategy
- [ ] Bundle size optimization
- [ ] Core Web Vitals

#### 10.3 Monitoring
- [ ] Sentry error tracking
- [ ] Better Stack uptime monitoring
- [ ] PostHog analytics
- [ ] Alert configuration

#### 10.4 Testing
- [ ] Unit test coverage
- [ ] Integration tests
- [ ] E2E critical paths
- [ ] Accessibility audit

#### 10.5 Documentation
- [ ] All docs up to date
- [ ] Deployment guide verified
- [ ] Disaster recovery tested
- [ ] Contributing guide complete

### Deliverable
> Production-ready application with monitoring, testing, and documentation.

---

## Definition of Done

V1 is complete when a founder can:

```
Create account
      ↓
Create startup
      ↓
Upload pitch deck
      ↓
AI understands startup
      ↓
Founder answers missing questions
      ↓
Startup profile finalized
      ↓
Create fundraising campaign
      ↓
Find investors
      ↓
Filter investors
      ↓
AI scores investors
      ↓
Research top investors
      ↓
Add investors to pipeline
      ↓
Generate personalized emails
      ↓
Review emails
      ↓
Approve emails
      ↓
Send emails
      ↓
Receive reply
      ↓
AI classifies reply
      ↓
Pipeline updates
      ↓
Founder gets notification
      ↓
Meeting scheduled
      ↓
AI prepares meeting brief
      ↓
Founder records meeting
      ↓
AI generates next actions
```

---

## Technology Versions

| Package | Version |
|---------|---------|
| Node.js | 22.x |
| pnpm | 11.x |
| Next.js | 15.x |
| React | 19.x |
| TypeScript | 5.x |
| Tailwind CSS | 4.x |
| Supabase JS | 2.x |
| Supabase CLI | Latest |
| Zod | 3.x |
| Vitest | Latest |
| Playwright | Latest |
