# Capital OS — Development Roadmap

## Phase 1 — Data Foundation & Company Intelligence ✅

**Objective:** Build the foundational database architecture, company intelligence system, and onboarding flow.

### Completed

| Feature | Status |
|---------|--------|
| Migration 001 (profiles) | ✅ |
| Migration 002 (investor intelligence) | ✅ |
| Migration 003 (intelligence pipeline) | ✅ |
| Migration 004 (company intelligence + billing) | ✅ |
| Onboarding flow (7 steps) | ✅ |
| Company profile CRUD | ✅ |
| Readiness score calculation | ✅ |
| Dashboard seeding | ✅ |
| Billing plans + credit system | ✅ |

### Remaining

| Feature | Status |
|---------|--------|
| Website intelligence extraction | 🔵 Planned |
| Document analysis (uploaded files) | 🔵 Planned |
| Startup profile page (real data) | 🟡 Shell exists |

**Definition of Done:** New user signs up → completes onboarding → dashboard shows personalized company card with readiness score and next steps.

---

## Phase 2 — Cleaning, Resolution & Deduplication ✅

**Objective:** Build robust data normalization, entity resolution, and duplicate detection.

### Completed

| Feature | Status |
|---------|--------|
| CSV bulk import pipeline | ✅ |
| Flexible column detection (20+ variants) | ✅ |
| Stage/type/sector/country normalization | ✅ |
| Email + LinkedIn deduplication | ✅ |
| Batch insert (500 records) | ✅ |
| Apollo bulk import API | ✅ |
| SEC EDGAR scraper | ✅ |
| Duplicate review queue UI | ✅ |

### Remaining

| Feature | Status |
|---------|--------|
| Probabilistic name matching | 🔵 Planned |
| Firm alias resolution (enhanced) | 🔵 Planned |
| Large-scale import (100K+) | 🔵 Planned |

**Definition of Done:** Import 10K+ records with <2% false positive deduplication. Firm name normalization handles variants.

---

## Phase 3 — Verification & Change Tracking ✅

**Objective:** Build source provenance, confidence scoring, and historical data tracking.

### Completed

| Feature | Status |
|---------|--------|
| Data change log (immutable audit trail) | ✅ |
| Firm aliases table | ✅ |
| Deterministic fit scoring (4-factor) | ✅ |
| Batch qualification API | ✅ |
| Data history viewer | ✅ |
| `log_data_change()` helper function | ✅ |

### Remaining

| Feature | Status |
|---------|--------|
| Source confidence weighting | 🔵 Planned |
| Automatic change detection on re-import | 🔵 Planned |
| Verification workflow UI | 🔵 Planned |

**Definition of Done:** Every investor field change is logged with source, confidence, and timestamp. Fit scores are explainable.

---

## Phase 4 — Investor Intelligence & Qualification ✅

**Objective:** Build investor profiles, scoring, and the intelligence layer.

### Completed

| Feature | Status |
|---------|--------|
| Full-text search (ilike-based) | ✅ |
| Advanced filters (type, stage, sector, geography) | ✅ |
| Investor database page with pagination | ✅ |
| Investor detail page with real data | ✅ |
| Pipeline Kanban view (7 stages) | ✅ |
| Data quality scoring | ✅ |
| Outreach readiness tracking | ✅ |

### Remaining

| Feature | Status |
|---------|--------|
| PostgreSQL tsvector full-text search | 🔵 Planned |
| AI-enhanced fit analysis | 🔵 Planned |
| Investor enrichment from external sources | 🔵 Planned |
| Saved investors (bookmarks) | 🔵 Planned |

**Definition of Done:** Search returns relevant results in <200ms. Filters work in combination. Every investor has an explainable fit score.

---

## Phase 5 — Email Integration ✅

**Objective:** Build email account connection via OAuth and email sending.

### Completed

| Feature | Status |
|---------|--------|
| Google OAuth callback routes | ✅ |
| Microsoft OAuth callback routes | ✅ |
| Token encryption (AES-256-GCM) | ✅ |
| Email sender service (Gmail + Outlook) | ✅ |
| Settings page email connection UI | ✅ |
| Email messages table | ✅ |

### Remaining

| Feature | Status |
|---------|--------|
| Email reply detection | 🔵 Planned |
| Email thread tracking | 🔵 Planned |
| Email disconnect UI improvements | 🔵 Planned |

**Definition of Done:** User connects Gmail → sends test email → email appears in sent folder. History is tracked.

---

## Phase 6 — AI-Assisted Outreach ✅

**Objective:** Build AI-powered email drafting, research, and campaign management.

### Completed

| Feature | Status |
|---------|--------|
| AI Copilot (real investor context) | ✅ |
| AI investor research summaries | ✅ |
| AI email drafting (personalized) | ✅ |
| Outreach page (Draft → Approve → Send) | ✅ |
| Campaign management (real data) | ✅ |
| API routes for AI operations | ✅ |

### Remaining

| Feature | Status |
|---------|--------|
| Email sequence generation (3-step) | 🔵 Planned |
| Campaign email automation | 🔵 Planned |
| AI Activity page (credit usage) | 🔵 Planned |
| Copilot with real company context | 🔵 Planned |

**Definition of Done:** Founder selects investor → clicks "Draft Email" → AI generates personalized email → founder reviews → sends.

---

## Phase 7 — Billing Architecture ✅ (Architecture Only)

**Objective:** Build the internal billing architecture without Stripe dependency.

### Completed

| Feature | Status |
|---------|--------|
| Billing plans table (Free/Workspace/Pro) | ✅ |
| User subscriptions table | ✅ |
| Credit ledger (immutable log) | ✅ |
| Credit costs table (8 operations) | ✅ |
| Credit consumption service | ✅ |
| Entitlement checks | ✅ |
| Auto-create free subscription trigger | ✅ |

### Remaining

| Feature | Status |
|---------|--------|
| Stripe integration | 🟣 Architecture only |
| Credit pack purchases | 🟣 Architecture only |
| Upgrade/downgrade flows | 🔵 Planned |
| Billing dashboard | 🔵 Planned |
| Invoice generation | 🔵 Planned |

**Definition of Done:** Plans defined. Credits work. When Stripe is added, only the adapter needs implementation.

---

## Future Phases

### Phase 8 — Pitch Deck Engine
- Composable design primitives
- AI narrative generation
- Server-side PPTX/PDF generation
- Versioning and review workflow

### Phase 9 — Advanced Analytics
- Reply rates, meeting rates, conversion
- Pipeline velocity
- Campaign performance
- Credit usage analytics

### Phase 10 — Automation
- Auto-enrichment on import
- Scheduled deduplication
- Email reply tracking
- Background job queue

---

*Last updated: August 22, 2026*
