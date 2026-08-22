# Capital OS — Feature Status

## Master Feature Matrix

### 🟢 Complete

| Feature | Phase | Files | Notes |
|---------|-------|-------|-------|
| Authentication (email/password) | 1 | `(auth)/*`, `middleware.ts` | Supabase Auth |
| Landing page | 1 | `page.tsx`, `Landing/*` | Real Estate Agent design |
| Dashboard with real data | 1-6 | `dashboard/page.tsx`, `actions/dashboard.ts` | Stats, recent investors, pipeline |
| Investor database (search + filters) | 4 | `investors/page.tsx`, `api/investors`, `actions/search.ts` | Full-text search, pagination |
| Investor detail page | 4 | `investors/[id]/page.tsx` | Real data, AI research button |
| Investor pipeline (Kanban) | 4 | `pipeline/page.tsx` | Real data, 7 stages |
| CSV bulk import | 2 | `csv-import.ts`, `admin/data-sources/import` | 20+ column variants |
| Apollo bulk import | 2 | `api/admin/import/apollo` | API-based |
| SEC EDGAR scraper | 2 | `scrapers/edgar.ts`, `admin/data-sources/scrape` | Form D filings |
| Data normalization | 2 | `normalization.ts` | Stages, types, sectors, countries |
| Entity resolution | 2 | `matching.ts` | Email, LinkedIn, name+firm |
| Duplicate detection | 2 | `duplicate_candidates`, `admin/review/duplicates` | Confidence scoring |
| Data change history | 3 | `data_change_log`, `DataHistory.tsx` | Full audit trail |
| Firm name normalization | 3 | `firm_aliases`, `normalize_firm_name()` | Legal suffix removal |
| Fit scoring (deterministic) | 3 | `qualification.ts` | 4-factor scoring |
| Batch qualification | 3 | `api/admin/qualify` | Process 1000+ investors |
| AI Copilot | 6 | `copilot/page.tsx`, `api/copilot`, `actions/copilot.ts` | Real investor context |
| AI investor research | 6 | `investor-research.ts`, `api/investors/[id]/research` | NVIDIA NIM |
| AI email drafting | 6 | `api/outreach/draft` | Personalized per investor |
| Email OAuth (Google) | 5 | `api/auth/google/*`, `email/crypto.ts`, `email/sender.ts` | Gmail API |
| Email OAuth (Microsoft) | 5 | `api/auth/microsoft/*` | Microsoft Graph |
| Email sending | 5-6 | `api/outreach/send` | Via connected OAuth |
| Outreach page | 6 | `outreach/page.tsx` | Draft → Approve → Send |
| Campaign management | 6 | `campaigns/page.tsx`, `actions/campaigns.ts` | Real data from DB |
| Onboarding (7 steps) | 1 | `onboarding/page.tsx`, `actions/company.ts` | Progressive, saveable |
| Company profiles | 1 | `company_profiles` table, `actions/company.ts` | Readiness scoring |
| Billing plans | 7 | `billing_plans` table | Free/Workspace/Pro |
| Credit system | 7 | `credit_ledger`, `billing/credits.ts` | Consumption + ledger |
| Entitlement checks | 7 | `billing/entitlements.ts` | Plan-based limits |
| Sidebar navigation | 1 | `Sidebar.tsx` | Auth-aware sections |
| Settings (email connection) | 5 | `settings/page.tsx` | Connect/disconnect OAuth |

### 🟡 In Progress

| Feature | Phase | Notes |
|---------|-------|-------|
| Dashboard analytics | — | Shell exists, needs real metrics |
| Startup profile page | — | Shell exists, needs company data connection |
| Documents page | — | Shell exists, needs file upload + Supabase Storage |
| Meetings page | — | Shell exists, no implementation |
| AI Activity page | — | Shell exists, needs credit ledger integration |

### 🔵 Planned

| Feature | Phase | Notes |
|---------|-------|-------|
| Pitch deck generation | Future | Composable design engine + NVIDIA AI |
| Pitch deck PPTX export | Future | PptxGenJS server-side generation |
| Pitch deck PDF export | Future | pdf-lib generation |
| Website intelligence extraction | 1 | Meta tags, positioning, brand colors |
| Advanced analytics | Future | Reply rates, meeting rates, conversion |
| Email reply detection | 5+ | Webhook/polling for inbound emails |
| Email thread tracking | 5+ | Conversation grouping |
| Campaign email sequences | 6 | 3-step: cold, follow-up, break-up |
| Deep investor enrichment | 4+ | AI-powered profile enrichment |
| Investor employment history | 3 | Timeline of roles |
| Saved investors (bookmarks) | 4 | Table exists, UI needed |
| Stripe integration | 7 | Payment processing |
| Credit pack purchases | 7 | One-time credit purchases |
| Admin data health dashboard | — | Aggregate metrics |
| Background job queue | — | For heavy processing |
| Sentry error tracking | — | Production monitoring |
| Vitest test suite | — | Unit + integration tests |

### 🟣 Architecture Only

| Feature | Phase | Notes |
|---------|-------|-------|
| Stripe billing | 7 | Provider interface built, no Stripe adapter |
| Webhook handling | 7 | Architecture designed |
| Background workers | — | For large-scale processing |
| pgvector embeddings | — | For semantic investor search |

### ⚪ Not Started

| Feature | Notes |
|---------|-------|
| Mobile app | Future consideration |
| Multi-language support | Future consideration |
| Team collaboration | Future consideration |
| API for external integrations | Future consideration |
| White-label / multi-tenant | Future consideration |

---

*Last updated: August 22, 2026*
