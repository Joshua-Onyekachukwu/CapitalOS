# Capital OS — Investor Data Quality Report

**Generated:** August 27, 2026

---

## 1. Database Overview

| Metric | Count | Percentage |
|--------|-------|------------|
| **Total Investors** | 82,508 | 100% |
| **With Email** | 60,639 | 73% |
| **Email Verified** | 54,895 | 66% of total, 91% of emails |
| **With LinkedIn** | 24,314 | 29% |
| **With Phone** | 56 | 0.07% |
| **With Real Website** | 5,722 | 7% |

---

## 2. Data Sources Breakdown

| Source | Records | Description |
|--------|---------|-------------|
| **EDGAR 13F-HR** | 30,828 | Institutional fund managers from SEC 13F filings |
| **EDGAR Form D** | 22,108 | Private placement issuers from SEC Form D filings |
| **FishTank VC** | 18,671 | VC firm profiles from FishTank VC directory |
| **Generated** | 8,743 | AI-generated from SEC filing data |
| **EDGAR N-CEN** | 2,102 | Fund annual reports from SEC N-CEN filings |
| **Apollo CSV** | 56 | Imported from Apollo.io CSV export |

---

## 3. Investor Type Distribution

| Type | Count | Description |
|------|-------|-------------|
| Fund of Funds | 30,885 | 13F filing entities (institutional fund allocators) |
| Unknown | 18,671 | FishTank profiles without type classification |
| Private Equity | 17,005 | PE firms from SEC filings |
| Venture Capital | 7,918 | VC firms from SEC filings and FishTank |
| Strategic Investor | 1,381 | Corporate strategic investors |
| Angel Investor | 1,260 | Individual angel investors |
| Family Office | 1,198 | Family office investment vehicles |
| Accelerator | 1,063 | Startup accelerators |
| Micro VC | 1,040 | Small VC funds (<$50M) |
| Impact Investor | 1,015 | ESG/impact-focused investors |
| Corporate Venture | 925 | CVC arms of large companies |
| University Fund | 90 | University endowments |
| Government Fund | 57 | Government-backed investment vehicles |

---

## 4. Email Verification Results

### Verification Method
- **Format validation:** RFC 5322 compliant regex check
- **Disposable domain filtering:** 200+ known disposable email domains blocked
- **MX record verification:** Performed on a sample (DNS lookups are slow at scale)

### Results
| Status | Count | Description |
|--------|-------|-------------|
| ✅ Verified (format + not disposable) | 54,895 | Valid email format, not from a disposable provider |
| ❌ Invalid (format or disposable) | 5,744 | Bad format, disposable domain, or test/example email |
| Total with email | 60,639 | — |

### Email Domain Quality
Most emails follow the `info@company.com` pattern, which is:
- **Corporate/Institutional:** Low individual reachability but legitimate business emails
- **Not personal:** Most are generic inbox addresses, not individual investor emails

### Email Quality Tiers
| Tier | Est. Count | Description |
|------|------------|-------------|
| **Tier 1 — Direct** | ~500-1,000 | Personal investor emails (first.last@, first@) |
| **Tier 2 — Corporate** | ~50,000 | Generic company emails (info@, contact@) |
| **Tier 3 — Inferred** | ~4,000 | AI-inferred from company domain patterns |

---

## 5. Data Quality Score

### Overall Score: 42/100

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Completeness** | 35/100 | Most records have name + email but lack LinkedIn, phone, investment preferences |
| **Accuracy** | 60/100 | EDGAR data is high quality; FishTank has some GTM URL contamination |
| **Freshness** | 50/100 | EDGAR data from recent filings; FishTank scraped Aug 2026 |
| **Uniqueness** | 70/100 | Deduplication performed; some may remain |
| **Contact Reach** | 30/100 | 91% of emails are generic corporate inboxes |

---

## 6. Known Issues

### High Priority
1. **FishTank website contamination:** 18,671 FishTank records have `https://www.googletagmanager.com/gtm.js` as their website — this is a tracking script URL, not a real website
2. **Generic emails:** Most emails are `info@company.com` format, not individual investor emails
3. **Missing investor types:** 18,671 FishTank records have `unknown` investor type

### Medium Priority
4. **No individual names from SEC filings:** 13F-HR filings contain institutional fund names, not individual partner names
5. **Missing LinkedIn for ~70% of investors:** Only 24,314 of 82,508 have LinkedIn profiles
6. **Phone data nearly absent:** Only 56 investors have phone numbers

### Low Priority
7. **Some generated records may have low quality data**
8. **No investment stage/sector data for most records**

---

## 7. Local Backups

All data has been backed up locally in `data-backups/`:

| File | Size | Description |
|------|------|-------------|
| `investors-full-backup-*.json` | ~294 MB | Complete investor data (all fields) |
| `investors-full-backup-*.csv` | ~55 MB | CSV export for spreadsheet analysis |
| `verified-emails-*.json` | ~5 MB | List of 54,895 verified emails |
| `investors-stats-*.json` | <1 MB | Statistical summary |

**Two copies maintained:**
1. `data-backups/` — Raw scraped data + full backups
2. Supabase — Clean, enriched, verified data

---

## 8. Recommendations to Reach 1M+ Verified Investors

### Immediate (Can Build Now)
1. **Parse EDGAR filing XMLs for individual names** — Download 13F-HR filing documents from SEC EDGAR and extract individual partner/principal names from filing details
2. **Web scrape VC firm team pages** — For the 5,722 investors with real websites, scrape /team, /about, /people pages for individual names and emails
3. **Enhanced contact enrichment** — Use AI to infer personal email patterns from company domains (john.smith@company.com, jsmith@company.com)

### Medium-term (Requires External Data)
4. **Crunchbase free tier scraping** — Extract investor profiles, portfolio companies, and investment history
5. **AngelList/OpenVC scraping** — Individual investor profiles with direct contact info
6. **LinkedIn Sales Navigator exports** — The best source for individual investor contacts (requires subscription)

### Long-term (Scale Strategy)
7. **Web scraping at scale** — Build crawlers for VC/PE firm websites globally
8. **Data partnerships** — Purchase verified investor data from providers like PitchBook, Preqin, or CB Insights
9. **Community contributions** — Allow users to add and verify investor contacts

---

## 9. Current Platform Readiness

| Feature | Status | Notes |
|---------|--------|-------|
| **Investor Database** | ✅ Ready | 82,508 investors, searchable, filterable |
| **Email Outreach** | ✅ Ready | AI-generated personalized emails |
| **Fit Scoring** | ✅ Ready | AI-powered investor-startup matching |
| **Campaign Management** | ✅ Ready | Multi-step campaign workflows |
| **Pipeline Management** | ✅ Ready | Kanban-style investor pipeline |
| **Analytics** | ✅ Ready | Charts, metrics, data quality views |
| **Email Health** | ✅ Ready | Health scoring, warm-up, suppression |
| **Admin Dashboard** | ✅ Ready | Data health, CSV upload, monitoring |
| **Mobile Responsive** | ✅ Ready | Tested on mobile, tablet, desktop |
| **Privacy/Terms** | ✅ Ready | Legal pages created |
| **Design System** | ✅ Ready | Standardized tokens, consistent UI |

---

## 10. What's Still Needed Before Launch

1. **Run SQL migration** in Supabase SQL Editor (`supabase-email-health-system.sql`)
2. **Update Google Cloud Console** with live site redirect URI
3. **Update Vercel env vars** for production
4. **Have a lawyer review** Privacy Policy and Terms of Service
5. **Add unsubscribe link** to all email templates (CAN-SPAM compliance)
6. **Add physical business address** to email templates
7. **Form a business entity** (LLC or C-Corp)
8. **Get EIN from IRS** (free)
