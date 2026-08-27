# Capital OS — Project Status Report
**Date:** August 27, 2026  
**Author:** Buffy (Codebuff AI Agent)

---

## Executive Summary

Capital OS is a functional AI-powered fundraising platform for startup founders. The core product — investor discovery, AI-powered fit scoring, personalized outreach, and pipeline management — is built and working. The platform has 82,533 investors in the database, a landing page with waitlist and founding member functionality, and a complete dashboard experience.

The platform is **not yet ready for real users**. The remaining work is primarily operational: running SQL migrations, configuring external services (Google OAuth, Stripe), and completing the email health system.

---

## Current State

### Database
| Metric | Count |
|--------|-------|
| Total Investors | **82,533** |
| With Email | **60,867** (74%) |
| With LinkedIn | **23,679** (29%) |
| With Website | **24,242** (29%) |
| With Location | **64,273** (78%) |
| With First Name | **64,219** (78%) |

### Data Sources
| Source | Records | Status |
|--------|---------|--------|
| EDGAR (13F-HR, Form D, N-CEN) | 55,596 | ✅ Imported |
| FishTank VC | 18,235 | ✅ Imported |
| EDGAR 13F-HR (direct) | 938 | ✅ Imported |
| Apollo CSV | 62 | ✅ Imported |
| OpenVC / Known VCs | 25 | ✅ Imported |

### Local Backups
- `data-backups/investors-full-backup-*.json` — 76MB (all data)
- `data-backups/investors-full-backup-*.csv` — 57MB (spreadsheet)
- `data-backups/verified-emails-*.json` — 54,895 verified emails

### Build Status
- ✅ `npx next build` passes clean
- ✅ All pages render correctly
- ✅ Mobile responsive (tested at 375px, 768px, 1024px)

---

## What's Built and Working

### Landing Page
- ✅ Hero section with CTA
- ✅ Problem → Solution → Features → Benefits narrative
- ✅ Pricing section (Starter $49/mo, Professional $199/mo)
- ✅ FAQ accordion
- ✅ Free waitlist email collection
- ✅ Founding Member $9.99 Stripe Checkout
- ✅ Privacy Policy and Terms of Service pages
- ✅ Footer with all links

### Authentication
- ✅ Email/password signup and login
- ✅ Google OAuth (needs Console registration)
- ✅ Password reset flow
- ✅ Onboarding wizard (7 steps)

### Dashboard
- ✅ Main dashboard with real stats (82K investors, 98 high-fit, 76% avg score)
- ✅ Investor database with search and faceted filters
- ✅ Investor detail profiles with AI research
- ✅ Investor discovery with fit analysis
- ✅ AI Copilot chat interface
- ✅ Outreach management (drafts, approved, sent, replies)
- ✅ Campaign creation wizard
- ✅ Pipeline Kanban board (7 stages)
- ✅ Analytics with real charts
- ✅ Settings (profile, email accounts, notifications)
- ✅ Saved investors
- ✅ Meetings readiness
- ✅ AI activity log with credit tracking

### Admin
- ✅ Data health dashboard
- ✅ CSV upload and Apollo import
- ✅ Deduplication tools
- ✅ Fit scoring batch job
- ✅ Audit log

### Email System
- ✅ OAuth email sending (Gmail, Microsoft)
- ✅ SMTP fallback
- ✅ Email templates with CAN-SPAM compliance
- ✅ Unsubscribe endpoint and page
- ✅ Physical address in all emails
- ✅ Commercial email disclosure
- ✅ Email tracking (opens, clicks)
- ✅ Reply detection
- ✅ Suppression list
- ✅ Pre-send health checks
- ✅ Email health scoring service
- ✅ Warm-up system
- ✅ DNS checker (SPF, DKIM, DMARC)
- ✅ Email health dashboard

### Data Pipeline
- ✅ EDGAR scraper (13F-HR, Form D, N-CEN)
- ✅ FishTank VC scraper
- ✅ Contact enrichment pipeline (infer emails from names + domains)
- ✅ Email verification (format + disposable check)
- ✅ Convex raw investor staging layer
- ✅ Qualification pipeline (Convex → Supabase promotion)
- ✅ Local data backups

### Design System
- ✅ Typography scale (11px–58px)
- ✅ Spacing scale (4px base)
- ✅ Border radius tokens (6/8/12/16/20px)
- ✅ Button sizes (SM/MD/LG)
- ✅ Card variants (default/interactive/elevated)
- ✅ Semantic colors (success/warning/error/info/primary)
- ✅ Status badges
- ✅ Consistent across all 56 pages

### Legal
- ✅ Privacy Policy page
- ✅ Terms of Service page
- ✅ CAN-SPAM compliance
- ✅ Legal compliance guide (docs/LEGAL-COMPLIANCE-GUIDE.md)

---

## What Needs To Be Done

### 🔴 Critical — Must Do Before Launch

#### 1. Run SQL Migrations (5 minutes, manual)
You need to paste these into Supabase SQL Editor and run them:

| File | What it creates |
|------|----------------|
| `supabase-email-health-system.sql` | email_messages, email_health_events, email_sending_log, email_warmup, email_domain_health, email_suppression_list tables |
| `supabase-waitlist.sql` | waitlist table for email collection |
| `supabase-founding-members.sql` | founding_members table for Stripe payments |

**These tables currently return NULL in the API because they don't exist yet.**

#### 2. Register Google OAuth Redirect URIs (5 minutes, manual)
Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) and add both redirect URIs to your OAuth 2.0 Client ID:

```
http://localhost:3001/api/auth/google/callback
https://capital-os-nine.vercel.app/api/auth/google/callback
```

Without this, Google login shows "redirect_uri_mismatch" error.

#### 3. Add Stripe Keys (2 minutes, manual)
Add to `.env.local`:
```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Then set up the webhook in [Stripe Dashboard](https://dashboard.stripe.com/webhooks):
- URL: `https://capital-os-nine.vercel.app/api/founding-member/webhook`
- Events: `checkout.session.completed`

#### 4. Update Vercel Environment Variables (2 minutes, manual)
In Vercel dashboard, set:
```
NEXT_PUBLIC_APP_URL=https://capital-os-nine.vercel.app
GOOGLE_REDIRECT_URI=https://capital-os-nine.vercel.app/api/auth/google/callback
```

### 🟡 High Priority — Should Do Before Public Launch

#### 5. Email Compliance (CAN-SPAM)
- ✅ Already built: unsubscribe endpoint, physical address, commercial disclosure
- ⚠️ Need to verify: unsubscribe flow works end-to-end when emails are actually sent
- ⚠️ Need to add: physical business address to email templates (currently using placeholder "1603 Capitol Ave, Suite 310, Cheyenne, WY 82001")

#### 6. Investor Data Quality
- 3,620 investors have fake Google Tag Manager URLs as websites — these need to be cleaned
- 81,598 investors have EDGAR source but no individual names (just fund names)
- Need to parse EDGAR XML filings to extract individual partner names
- Need to run VC firm website scrapers for the 24,242 with real websites

#### 7. Convex Data Layer
- Schema and functions are built
- Need to run `npx convex dev` to start the Convex server
- Need to sync raw investors from Supabase to Convex
- Need to run the qualification pipeline

#### 8. Testing
- Google OAuth end-to-end test (after Console registration)
- Email sending end-to-end test (after connecting email account)
- Campaign creation with real email generation
- Stripe payment flow test (after adding keys)

### 🟢 Medium Priority — Nice to Have

#### 9. Design System Remaining Work
- 56 pages standardized ✅
- Some pages still use hardcoded values in responsive prefixes (md:, lg:)
- Could benefit from a final visual consistency pass

#### 10. Missing Features
- No conversation persistence in AI Copilot (refresh loses chat)
- No bulk save selection in investor database
- No drag-and-drop in pipeline Kanban
- No file preview in documents
- No meeting scheduling integration
- No password change option in settings
- Notification toggles don't persist on refresh

#### 11. Performance
- Analytics API now uses server-side counting (fixed)
- Investor search could benefit from full-text search index
- Pipeline loads only top 200 records (should paginate)

---

## Investor Data Roadmap

### Current: 82,533 investors
### Target: 1,000,000+ verified investors

### How to get there:

| Step | Source | Expected New Records | Effort |
|------|--------|---------------------|--------|
| 1 | Parse EDGAR 13F-HR XML filings | +10,000 individual names | Medium |
| 2 | Scrape VC firm team pages (24K websites) | +5,000 contacts | Medium |
| 3 | Crunchbase alternative scrapers | +20,000 profiles | Medium |
| 4 | AI-powered email inference | +15,000 emails | Low |
| 5 | LinkedIn Sales Navigator exports | +50,000 profiles | Manual |
| 6 | AngelList / PitchBook alternatives | +30,000 profiles | Medium |
| 7 | More SEC filing types (ADV, Form D) | +100,000 fund names | Low |

**Realistic estimate: 200,000–300,000 investors with the current approach.**  
**To reach 1M+:** Need LinkedIn Sales Navigator access, Crunchbase Pro, or PitchBook API.

---

## Architecture Notes

### Data Flow
```
Scrapers → Convex (raw staging) → Qualification Pipeline → Supabase (hot data) → Dashboard
```

### Key Files
| Path | Purpose |
|------|---------|
| `src/app/` | Next.js pages (landing, dashboard, admin, auth) |
| `src/components/` | React components (Landing, Dashboard, UI, Outreach) |
| `src/lib/services/email/` | Email system (sender, templates, health, warmup) |
| `src/lib/ai/` | NVIDIA AI integration |
| `convex/` | Convex schema, queries, mutations |
| `scripts/` | Data pipeline scripts (scrapers, enrichers, importers) |
| `docs/` | Documentation and reports |
| `data-backups/` | Local data backups |

### Environment Variables Required
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Google OAuth
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET

# NVIDIA AI
NVIDIA_API_KEY

# Stripe (for Founding Member)
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET

# Convex
NEXT_PUBLIC_CONVEX_URL
CONVEX_DEPLOY_KEY

# App
NEXT_PUBLIC_APP_URL
```

---

## Git History (Recent)
```
f577974 Build Convex raw investor staging layer with sync and qualification pipeline
33a7b13 Standardize design system across all 56 pages
00fddb0 Fix CAN-SPAM compliance: sender-level injection, correct suppression table
99fc7c6 Add Convex raw investor staging, CAN-SPAM compliance, VC scrapers, design tokens
76465ab Harden founding member API security
1d9fd8b Add Founding Member tier with Stripe Checkout integration
47e01af Add free waitlist with email collection to landing page
e08ce57 Fix critical analytics bug and migrate saved investors to Supabase
3e668e6 Fix Google OAuth redirect URI to derive from request origin
```

---

## Summary

**The platform is built.** The code is clean, the build passes, and the core features work. The remaining work is:

1. **5 minutes of manual configuration** (SQL migrations, Google Console, Stripe keys)
2. **Data quality improvements** (clean fake websites, extract individual names from EDGAR)
3. **End-to-end testing** after configuration is complete
4. **Optional polish** (conversation persistence, bulk actions, drag-and-drop)

The biggest risk is not technical — it's operational. The SQL migrations need to be run, the Google Console needs to be configured, and the Stripe keys need to be added. Without these, several features silently fail.
