# Capital OS — Executive Overview

## What Capital OS Is

Capital OS is an **AI-powered fundraising operating system** for startup founders. It replaces the fragmented, spreadsheet-driven process of raising capital with an intelligent, connected platform that understands a founder's company, discovers relevant investors, qualifies opportunities, generates materials, and manages outreach — all in one place.

## Live Demo

**https://capital-os-nine.vercel.app/**

## The Problem

Startup fundraising is broken:

- **Fragmented tools** — founders use spreadsheets, CRM tools, email, Google Docs, pitch-deck templates, and manual research, none of which talk to each other.
- **Investor data is scattered** — finding the right investors requires hours of manual research across LinkedIn, Crunchbase, AngelList, and personal networks.
- **No intelligence layer** — founders cannot programmatically match their company against investor theses, check sizes, stages, or geographies.
- **Outreach is generic** — most investor outreach is mass-emailed, impersonal, and ineffective.
- **No fundraising system** — there is no unified system that connects company understanding → investor discovery → qualification → materials → outreach → relationship tracking.

Capital OS solves this by becoming the **single operating system for the entire fundraising lifecycle**.

## Target Users

**Primary:** Startup founders who are currently raising or planning to raise capital (pre-seed through Series B).

**Secondary:** Startup advisors, accelerators, and early-stage fund managers who help founders with fundraising.

## Core Value Proposition

> Tell us about your company. Capital OS understands your business, discovers the right investors, helps you prepare your materials, and assists you in reaching out — intelligently and personally.

## Platform Stats (August 28, 2026)

| Metric | Value |
|--------|-------|
| **Verified investors in database** | 46,093 |
| **With email addresses** | 46,093 (100%) |
| **Verified emails** | 41,346 (89.7%) |
| **Source files** | 272 |
| **Lines of code** | 50,463 |
| **Pages** | 53 |
| **API routes** | 69 |
| **Components** | 39 |
| **Service modules** | 31 |
| **Email template variants** | 7 |
| **SQL migrations** | 18 |
| **Platform score** | 85/100 production-ready |

## Product Philosophy

1. **Intelligence over data** — We don't just collect investor data. We make it intelligent, verified, and actionable.
2. **System over tools** — Every feature connects to every other feature. Company intelligence feeds investor matching. Investor intelligence feeds outreach. Outreach feeds relationship tracking.
3. **AI as assistant, not replacement** — AI drafts, suggests, and analyzes. The founder decides, approves, and sends.
4. **Value before payment** — Users experience real value before being asked to pay. The free tier is genuinely useful.
5. **Premium without pretension** — The product should feel professional, mature, and commercially credible — not like a generic SaaS template.

## Core Workflows

```
1. Onboarding → Company Intelligence
2. Company Intelligence → Investor Discovery
3. Investor Discovery → Qualification & Scoring
4. Qualification → Pitch Deck Preparation
5. Pitch Deck → Personalized Outreach
6. Outreach → Relationship Tracking
7. Relationship Tracking → Fundraising Success
```

## Architecture Overview

Capital OS uses a **modern serverless architecture**:

```
┌──────────────────────────────────────────────────────────────────┐
│                        Your Browser                              │
│                   (Next.js 14 App Router)                        │
├────────────────────────┬─────────────────────────────────────────┤
│  Supabase              │  NVIDIA NIM                             │
│  (Auth + PostgreSQL)   │  (Nemotron-3.5 AI)                      │
│                        │                                         │
│  • Auth (Email + OAuth)│  • Investor Research                    │
│  • 46K+ Investors      │  • Email Drafting                       │
│  • Campaigns           │  • Fit Scoring                          │
│  • Email Tracking      │  • Pitch Deck Generation                │
│  • Documents           │  • AI Copilot                           │
│  • RLS Security        │  • Key Rotation (5 keys)                │
└────────────────────────┴─────────────────────────────────────────┘
```

## Current Status

Capital OS is **beta-ready**. The full platform is built and functional:

### ✅ Fully Built

- Authentication & user management (email/password + Google OAuth + Microsoft OAuth)
- Landing page with professional design
- 7-step onboarding wizard
- Investor database (46,093 verified investors with emails)
- AI-powered investor discovery with multi-dimensional fit scoring
- AI investor research summaries
- AI email drafting (personalized, natural-sounding)
- 7 branded email templates with open/click tracking
- Campaign management with drip sequences and follow-ups
- Pipeline Kanban board (7 stages)
- AI Copilot (natural language assistant)
- Pitch deck generation (AI-powered, PPTX + PDF export)
- Email health dashboard (warm-up, deliverability, domain verification)
- Full admin dashboard (14 pages)
- Stripe founding member payments
- Waitlist system
- CAN-SPAM compliant emails
- Performance caching layer
- Security (RLS policies, admin auth, rate limiting)

### 🟡 In Progress

- Google OAuth production configuration
- Email generation speed optimization (~100s → targeting <30s)
- Investor database growth toward 200K+
- Design system standardization

### 🔵 Planned

- Mobile app
- Team collaboration
- API for external integrations
- Meeting scheduling
- Multi-language support

## Revenue Model

| Plan | Price | Credits/mo | Investor DB |
|------|-------|-----------|-------------|
| **Free** | $0 | 50 | 100 |
| **Workspace** | $49/mo | 500 | 5,000 |
| **Workspace Pro** | $199/mo | 2,000 | 50,000 |

## Documentation

| Document | Description |
|----------|-------------|
| [Product Vision](./01-product-vision.md) | Why Capital OS exists, product principles, user journeys |
| [System Architecture](./02-system-architecture.md) | How all components connect |
| [Database Architecture](./03-database-architecture.md) | Complete data model |
| [Investor Intelligence](./04-investor-intelligence.md) | The investor data pipeline |
| [Company Intelligence](./05-company-intelligence.md) | How we understand each company |
| [AI Architecture](./06-ai-architecture.md) | All AI-powered components |
| [Pricing & Billing](./07-pricing-billing.md) | Credits, plans, unit economics |
| [Onboarding](./08-onboarding.md) | The onboarding experience |
| [Pitch Deck Engine](./09-pitch-deck-engine.md) | Deck generation system |
| [Email & Outreach](./10-email-outreach.md) | Email integration and outreach |
| [Security](./11-security.md) | Authentication, RLS, tokens |
| [Infrastructure](./12-infrastructure.md) | Hosting, deployment, env |
| [Frontend & Backend](./13-frontend-backend.md) | Code architecture |
| [Feature Status](./14-feature-status.md) | What's built, what's planned |
| [Development Roadmap](./15-development-roadmap.md) | Phases 1-7+ |
| [Decision Log](./16-decision-log.md) | Architecture & product decisions |
| [Open Issues](./17-open-issues.md) | Known risks and tech debt |
| [Change Log](./18-changelog.md) | Chronological history |

---

*Last updated: August 28, 2026*
