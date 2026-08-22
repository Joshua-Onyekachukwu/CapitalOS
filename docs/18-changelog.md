# Capital OS — Change Log

## August 22, 2026

### Phase 1 Onboarding + Phase 7 Billing Architecture
**Commit:** `9fcd79f`
**Changes:**
- Created Migration 004: company_profiles, company_team_members, company_documents, billing_plans, user_subscriptions, credit_ledger, credit_costs
- Built 7-step onboarding flow (`/onboarding`)
- Built company profile CRUD actions with readiness score calculation
- Built billing services: plans.ts, credits.ts, entitlements.ts
- Updated dashboard to show readiness score and personalized next steps
- Added Onboarding link to sidebar
**Migration Required:** Yes — `004_company_intelligence_billing.sql`

### NVIDIA AI Integration + Real Dashboard Data
**Commit:** `32fd29b`
**Changes:**
- Created API routes: `/api/outreach/draft`, `/api/outreach/send`, `/api/investors/[id]/research`
- Fixed Outreach page to call API routes instead of importing server-side AI directly
- Fixed column name mismatches across investor pages
- Fixed broken import paths
- All dashboard pages connected to real Supabase data

### CSV Bulk Import Verified
**Commit:** `ba0e5b5`
**Changes:**
- Verified CSV import pipeline works end-to-end
- Created test script for import validation

## August 21, 2026

### Bulk Apollo Import + Dashboard Connection
**Commit:** `d5d0cb2`
**Changes:**
- Built Apollo bulk import API route
- Connected Pipeline and Campaigns pages to real Supabase data

### Phase 6 — AI Email Sequence Generator
**Commit:** `0c875c9`
**Changes:**
- Built email sequence generation action
- Updated Outreach page with real AI drafting

### Phase 5 — Email OAuth Integration
**Commit:** `699a22f`
**Changes:**
- Built Google and Microsoft OAuth callback routes
- Built email token encryption (AES-256-GCM)
- Built email sender service
- Updated Settings page with email connection UI

### Phase 4 — Full-Text Search + Advanced Filters
**Commit:** `4a81a01`
**Changes:**
- Built investor search action with filters
- Built investor API route with pagination
- Updated investor database page with real search

### Phase 3 — Deterministic Fit Scoring
**Commit:** `13e18e9`
**Changes:**
- Built qualification service (4-factor scoring)
- Built batch qualification API route
- Built QualificationCard component

### SEC EDGAR Scraper
**Commit:** `e401afe`
**Changes:**
- Built EDGAR scraper service
- Built admin scrape page
- Built normalization pipeline API route

### Phase 2 — Duplicate Review + Data History
**Commit:** `f163f49`
**Changes:**
- Built duplicate review queue UI
- Built data history viewer component
- Built data history server action

### Migration 003 Idempotent
**Commit:** `be7e714`
**Changes:**
- Made migration 003 fully idempotent (safe to re-run)

### Phase 1 — Intelligence Pipeline Foundation
**Commit:** `745b8b5`
**Changes:**
- Created Migration 003: raw_records, duplicate_candidates, data_change_log, firm_aliases, email_accounts, email_messages, campaign_investors, saved_investors
- Built ingestion pipeline
- Built entity resolution engine
- Built normalization service

### Supabase Cookie Types Fix
**Commit:** `4067dcc`
**Changes:**
- Added explicit types to Supabase cookie handlers for Vercel build

### Core Product Functionality
**Commit:** `00aec78`
**Changes:**
- Implemented dashboard, AI copilot, import pipeline
- Connected to Supabase and NVIDIA NIM

### Dashboard Workflow Pages
**Commit:** `cb0a6f0`
**Changes:**
- Built out all dashboard workflow pages with full UI

### Landing Page Navigation
**Commit:** `a86b0ba`
**Changes:**
- Added section IDs and fixed navigation links for smooth scrolling

### Mobile Hero Fix
**Commit:** `5b79298`
**Changes:**
- Fixed mobile hero bottom alignment, FAQ padding, hide about image on mobile

### Sector Seed Script
**Commit:** `a3be095`
**Changes:**
- Added sector seed script for investor intelligence taxonomy

### Apollo Pipeline Fix
**Commit:** `c25e1c3`
**Changes:**
- Load .env.local for standalone scripts and use Apollo header-based auth

### Migration Verification Scripts
**Commit:** `891203a`
**Changes:**
- Created migration verification and Apollo pipeline test scripts

---

*Last updated: August 22, 2026*
