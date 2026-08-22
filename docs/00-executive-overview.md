# Capital OS — Executive Overview

## What Capital OS Is

Capital OS is an **AI-powered fundraising operating system** for startup founders. It replaces the fragmented, spreadsheet-driven process of raising capital with an intelligent, connected platform that understands a founder's company, discovers relevant investors, qualifies opportunities, generates materials, and manages outreach — all in one place.

## The Problem

Startup fundraising is broken:

- **Fragmented tools** — founders use spreadsheets, CRM tools, email, Google Docs, pitch-deck templates, and manual research, none of which talk to each other.
- **Investor data is scattered** — finding the right investors requires hours of manual research across LinkedIn, Crunchbase, AngelList, and personal networks.
- **No intelligence layer** — founders cannot programmatically match their company against investor theses, check sizes, stages, or geographies.
- **Outreach is generic** — most investor outreach is mass-emailed, impersonal, and ineffective.
- **No fundraising system** — there is no unified system that connects company understanding → investor discovery → qualification → materials → outreach → relationship tracking.

Capital OS solves this by becoming the **single operating system for the entire fundraising lifecycle**.

## Target Users

**Primary:** Startup founders who are currently raising or planning to raise capital.

**Secondary:** Startup advisors, accelerators, and early-stage fund managers who help founders with fundraising.

## Core Value Proposition

> Tell us about your company. Capital OS understands your business, discovers the right investors, helps you prepare your materials, and assists you in reaching out — intelligently and personally.

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

## Current Status

Capital OS is in **active development**. The foundation is built:

- ✅ Authentication & user management
- ✅ Landing page (Real Estate Agent design adaptation)
- ✅ Dashboard with real Supabase data
- ✅ Investor intelligence pipeline (ingestion, normalization, deduplication, qualification)
- ✅ CSV bulk import
- ✅ SEC EDGAR scraper
- ✅ AI Copilot (NVIDIA NIM)
- ✅ AI-powered investor research summaries
- ✅ AI email drafting
- ✅ Email OAuth integration (Google/Microsoft)
- ✅ Onboarding flow (7 steps)
- ✅ Billing architecture (Model A — Fundraising Capacity)
- ⏳ Pitch deck generation engine (planned)
- ⏳ Stripe integration (architecture only)
- ⏳ Advanced analytics (planned)

## Documentation

This documentation system is the **single source of truth** for the entire Capital OS project. It covers product, architecture, database, AI, pricing, security, development status, and decision history.

| Section | Description |
|---------|-------------|
| [Product Vision](./01-product-vision.md) | Why Capital OS exists, product principles, user journeys |
| [System Architecture](./02-system-architecture.md) | How all components connect |
| [Database Architecture](./03-database-architecture.md) | Complete data model |
| [Investor Intelligence](./04-investor-intelligence.md) | The investor data pipeline |
| [Company Intelligence](./05-company-intelligence.md) | How we understand each company |
| [AI Architecture](./06-ai-architecture.md) | All AI-powered components |
| [Pricing & Billing](./07-pricing-billing.md) | Model A, credits, plans |
| [Onboarding](./08-onboarding.md) | The onboarding experience |
| [Pitch Deck Engine](./09-pitch-deck-engine.md) | Future deck generation system |
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

*Last updated: August 22, 2026*
