# 13F, ADV & OpenCorporates — Implementation Plan

---

## CURRENT STATE

### What We Already Have

| Asset | Status | Details |
|-------|--------|---------|
| **13F-HR scraper** | ✅ Built | `scraper-13f-holdings.js` — parses XML for holdings |
| **ADV scraper** | ✅ Built | `scraper-adv.js` — parses ADV filings |
| **OpenCorporates scraper** | ✅ Built | `scraper-opencorporates.js` — HTML scraping for directors |
| **EDGAR bulk scraper** | ✅ Built | `edgar-bulk-fast.js` — 13F, Form D, N-CEN |
| **13F data in Supabase** | 11,394 records | Filer-level only, no holdings |
| **Form D data in Supabase** | 44,430 records | Fundraisers |
| **N-CEN data in Supabase** | 1,995 records | Fund annual reports |
| **ADV data in Supabase** | 0 records | Scraper found nothing |
| **OpenCorporates data** | 0 records | Not yet run |
| **13F holdings backup** | 5.2MB JSON | Raw XML parsed, not in DB |

### Data Completeness (72,524 investors)

| Field | Filled | Assessment |
|-------|--------|------------|
| email | 20.3% | ⚠️ Critical gap |
| linkedin_url | 12.5% | ⚠️ Critical gap |
| company_name | 6.8% | ❌ Almost empty |
| fund_size | 0% | ❌ Completely empty |
| aum | 0% | ❌ Completely empty |
| phone | 0.1% | ❌ Nearly empty |
| investment_stages | 100% | ✅ |
| investment_sectors | 100% | ✅ |
| portfolio_companies | 100% | ✅ |
| min/max_check_size | 90% | ✅ |

---

## SOURCE EVALUATION

### 13F Holdings

**What it provides:**
- Every stock position of institutions with >$100M AUM
- Portfolio composition, concentration, sector exposure
- Historical position changes (new/increased/reduced/exited)
- Filing dates and amendment history

**What it tells us about investors:**
- ✅ Whether institution is actively managing capital
- ✅ Portfolio size and concentration
- ✅ Sector exposure from public holdings
- ✅ Investment activity trends over time
- ❌ Does NOT tell us about startup investing
- ❌ Does NOT provide contact information
- ❌ Does NOT identify decision makers

**Fundraising relevance:** LOW for direct outreach. HIGH for institutional intelligence. A 13F filer managing $500B in public equities is irrelevant to a startup raising $500K. But knowing they exist and what they do helps with entity resolution.

**Best used for:**
- Attaching investment activity intelligence to existing investors
- Verifying that an institution is real and active
- Understanding portfolio composition for matching
- Cross-referencing with ADV and OpenCorporates

### Form ADV

**What it provides:**
- Registered Investment Adviser identity
- CRD number, SEC file number
- AUM (when disclosed)
- Investment strategies
- Client types
- Geographic focus
- Disciplinary history
- Related entities and control persons

**What it tells us about investors:**
- ✅ Whether organization is a registered adviser
- ✅ Regulatory status and legitimacy
- ✅ AUM and asset class focus
- ✅ Investment strategy description
- ✅ Related private funds (when disclosed)
- ❌ Does NOT directly identify VC/PE firms
- ❌ Does NOT provide startup investment data

**Fundraising relevance:** MEDIUM. ADV identifies legitimate financial institutions. Some will be VCs/PEs, most won't. The value is in:
1. Verifying that an investor organization is real
2. Getting AUM data for capacity scoring
3. Finding related private fund entities
4. Identifying control persons (potential decision makers)

**Best used for:**
- Enriching existing investor organizations with regulatory data
- AUM verification
- Finding related fund entities
- Entity resolution (legal name vs trading name)

### OpenCorporates

**What it provides:**
- Company legal identity across jurisdictions
- Incorporation dates, status, type
- Previous company names
- Directors and officers
- Corporate relationships

**What it tells us about investors:**
- ✅ Legal entity name and registration
- ✅ Whether company is active/registered
- ✅ Officers and directors (potential contacts)
- ✅ Previous names (helps with dedup)
- ❌ Does NOT identify investors specifically
- ❌ Does NOT provide investment data

**Fundraising relevance:** LOW-MEDIUM. OpenCorporates is primarily an entity resolution tool. It helps us:
1. Confirm that "ABC Ventures" and "ABC Ventures LLC" are the same entity
2. Find directors/officers who might be investment decision makers
3. Verify company registration status
4. Resolve name variants across sources

**Best used for:**
- Entity resolution and deduplication
- Corporate identity verification
- Officer/director discovery for outreach
- Cross-referencing with other sources

---

## IMPLEMENTATION PLAN

### Step 1 — 13F Holdings Parser (Fix & Scale)

**Problem:** The existing `scraper-13f-holdings.js` finds filings but the XML parsing doesn't reliably extract holdings. We have 5.2MB of parsed data in backups but it's not in the database.

**What to build:**

1. **Fix the 13F XML parser** to reliably extract:
   - Issuer name, CUSIP, shares, market value
   - Filing date, reporting period
   - Investment discretion, voting authority

2. **Create a `holdings` table** to store individual positions:
   ```sql
   CREATE TABLE investor_holdings (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     investor_id UUID REFERENCES investors(id),
     issuer_name TEXT NOT NULL,
     cusip TEXT,
     ticker TEXT,
     security_type TEXT,
     shares BIGINT,
     share_type TEXT,       -- SH or PRN
     market_value NUMERIC,  -- in dollars
     filing_date DATE,
     reporting_period DATE,
     source TEXT DEFAULT 'sec_13f',
     source_url TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

3. **Run the parser on a controlled sample** (first 100 filers) to confirm it works

4. **Scale to all 11,394 13F filers** in Supabase

5. **Derive intelligence from holdings:**
   - Total portfolio value
   - Top 10 holdings
   - Sector exposure
   - Position changes over time (if multiple filings)

**Expected outcome:** 11,394 filers enriched with holdings data. Portfolio values and sector exposure calculated.

**Dependencies:** None (standalone)
**Time:** 2-3 days

---

### Step 2 — ADV Scraper Fix

**Problem:** The existing `scraper-adv.js` collected 0 records. The EDGAR search API may not return ADV filings properly, or the XML parsing fails.

**What to build:**

1. **Fix the ADV search** to find actual ADV filings:
   - Try the IAPD (Investment Adviser Public Disclosure) API directly
   - URL: `https://api.adviserinfo.sec.gov/IAPD/Content/Search/iapdsearch.aspx`
   - Or scrape: `https://adviserinfo.sec.gov/`

2. **Parse ADV Part 1** for:
   - Firm name, CRD number, SEC file number
   - AUM, client count, account count
   - Investment strategies
   - Geographic focus
   - Related private funds

3. **Create an `adv_data` table** (or enrich existing investor fields):
   ```sql
   CREATE TABLE adv_filings (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     investor_id UUID REFERENCES investors(id),
     crd_number TEXT,
     sec_file_number TEXT,
     firm_name TEXT,
     aum NUMERIC,
     total_clients INTEGER,
     total_accounts INTEGER,
     investment_strategies TEXT[],
     client_types TEXT[],
     has_disciplinary_history BOOLEAN,
     filing_date DATE,
     source_url TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

4. **Match ADV filers to existing investors** using name + domain matching

5. **Enrich matched investors** with AUM, strategies, regulatory data

**Expected outcome:** 500-2,000 RIA firms identified, matched to existing investors where possible, AUM data captured.

**Dependencies:** Phase 1 (identity resolution) helps with matching
**Time:** 2-3 days

---

### Step 3 — OpenCorporates Enrichment

**Problem:** The scraper exists but hasn't been run. It's designed to enrich existing low-quality investors with company data.

**What to build:**

1. **Run the existing scraper** on the 4,905 investors with `company_name` set:
   - Search OpenCorporates for each company
   - Get company details (status, type, incorporation date)
   - Get officers/directors

2. **Create an `org_officers` table** to store officer data:
   ```sql
   CREATE TABLE org_officers (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     organization_name TEXT,
     officer_name TEXT NOT NULL,
     position TEXT,
     appointment_date DATE,
     resignation_date DATE,
     jurisdiction TEXT,
     source TEXT DEFAULT 'opencorporates',
     source_url TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

3. **Match officers to existing investors** where name overlap exists

4. **Enrich investors** with:
   - Company registration status
   - Incorporation date
   - Officer confirmation (if investor is a director of their stated company)

**Expected outcome:** 2,000-4,000 companies enriched with corporate data, 500-1,000 officer matches found.

**Dependencies:** Needs `company_name` field populated (currently only 6.8%)
**Time:** 1-2 days

---

### Step 4 — Cross-Source Entity Resolution

**Problem:** The same investor may appear in 13F, ADV, OpenCorporates, and our existing data with different names.

**What to build:**

1. **Organization matching engine:**
   - Normalize names (remove "LLC", "Inc.", "LP", etc.)
   - Match by domain
   - Match by CIK/CRD number
   - Match by fuzzy name similarity

2. **Person matching engine:**
   - Match by email (exact)
   - Match by LinkedIn URL (exact)
   - Match by name + company (fuzzy)
   - Match by officer records

3. **Canonical investor consolidation:**
   - One investor record per unique person/entity
   - Multiple source records linked via `field_sources`
   - Holdings, ADV data, and OpenCorporates data attached to canonical record

**Expected outcome:** Deduplicated dataset with cross-source intelligence.

**Dependencies:** Steps 1-3
**Time:** 2-3 days

---

### Step 5 — Re-run Qualification

**Problem:** After enrichment, qualification scores need updating.

**What to build:**

1. **Enhanced scoring** that uses new data:
   - AUM from ADV → funding_capacity_score boost
   - Holdings data → investment_activity_score boost
   - Officer confirmation → contactability_score boost
   - Corporate status → data_quality_score boost

2. **Run qualification** on all enriched investors

3. **Report new distribution** of qualified/highly-qualified/outreach-ready

**Dependencies:** Steps 1-4
**Time:** 1 day

---

## FIELD MAPPING

### 13F → Investor Schema

| 13F Field | Investor Field | Notes |
|-----------|---------------|-------|
| Reporting institution name | `full_name` (if new) | Match to existing first |
| CIK | `source_id` | Unique identifier |
| Filing date | `last_investment_date` | Most recent filing |
| Total holdings | `number_of_investments` | Count of positions |
| Total portfolio value | `total_capital_invested` | Sum of market values |
| Top holdings | `portfolio_companies` | Top 20 by value |
| Average position size | `typical_check_size` | Derived |
| Filing URL | `source_url` | For audit trail |

### ADV → Investor Schema

| ADV Field | Investor Field | Notes |
|-----------|---------------|-------|
| Firm name | `full_name` / `company_name` | Match to existing |
| CRD number | `source_id` | Unique identifier |
| AUM | `aum`, `fund_size` | Critical for capacity scoring |
| Investment strategies | `investment_sectors` | Map to normalized sectors |
| Client types | `investor_type` | Classify as VC/PE/RIA/etc |
| Headquarters | `country`, `city`, `headquarters` | Geographic data |
| Employee count | `number_of_employees` | Size indicator |
| Year founded | `founded_year` | Age indicator |

### OpenCorporates → Investor Schema

| OC Field | Investor Field | Notes |
|----------|---------------|-------|
| Company name | `company_name` | Verify/confirm |
| Legal name | `company_name` | May differ from trading name |
| Status | (validation) | Confirm company is active |
| Incorporation date | `founded_year` | Age of company |
| Previous names | (dedup) | Helps identify name variants |
| Officer name | `full_name` (if person) | Potential contact |
| Officer position | `job_title` | Role confirmation |

---

## EXPECTED OUTCOMES

### After Full Implementation

| Metric | Before | After (Expected) |
|--------|--------|-----------------|
| Investors with AUM data | 0% | 5-10% |
| Investors with fund_size | 0% | 5-10% |
| Investors with verified company | 6.8% | 15-20% |
| Investors with holdings data | 0% | 11,394 (15.7%) |
| Investors with officer data | 0% | 2,000-4,000 |
| Qualified investors (≥70) | 2,808 (3.9%) | 5,000-8,000 |
| Outreach-ready | 0 | 1,000-3,000 |

### Source Contribution

| Source | Intelligence Provided | Records Affected |
|--------|----------------------|-----------------|
| 13F Holdings | Portfolio activity, sector exposure, portfolio value | 11,394 filers |
| Form ADV | AUM, regulatory status, investment strategies | 500-2,000 RIAs |
| OpenCorporates | Corporate identity, officers, registration status | 2,000-4,000 companies |

---

## EXECUTION SEQUENCE

| Day | Task | Duration |
|-----|------|----------|
| 1-2 | Fix 13F XML parser, create holdings table, test on 100 filers | 2 days |
| 3 | Scale 13F parser to all 11,394 filers | 1 day |
| 4-5 | Fix ADV scraper, parse IAPD data, match to existing investors | 2 days |
| 6-7 | Run OpenCorporates enrichment on investors with company names | 2 days |
| 8-9 | Cross-source entity resolution and deduplication | 2 days |
| 10 | Re-run qualification, report results | 1 day |

**Total: ~10 days**

---

## WHAT WE SHOULD NOT DO

1. **Don't dump every 13F filer as an actionable investor.** Most are large asset managers irrelevant to startup fundraising. Use 13F for intelligence, not as a primary source.

2. **Don't treat every ADV adviser as a VC.** Most RIAs manage public equities or wealth portfolios. Only those with private fund/VC/PE signals are relevant.

3. **Don't treat every OpenCorporates director as an investor.** Directors are not necessarily investment decision makers.

4. **Don't infer startup investing from AUM.** A $1B AUM doesn't mean they invest in startups.

5. **Don't create duplicates across sources.** Always match to existing investors first.

6. **Don't fabricate data.** If AUM isn't disclosed, leave it NULL.

---

## KEY INSIGHT

These three sources serve different purposes:

| Source | Primary Purpose | Fundraising Value |
|--------|----------------|-------------------|
| **13F** | Investment activity intelligence | LOW — mostly public equity managers |
| **ADV** | Regulatory identity + AUM | MEDIUM — some will be VCs/PEs |
| **OpenCorporates** | Entity resolution + officer discovery | LOW-MEDIUM — mainly for dedup |

The **highest value** for fundraising outreach comes from:
1. **Apollo** — individual contacts with verified emails
2. **OpenVC / Fundraise.in** — investor profiles with investment preferences
3. **Official websites** — investment thesis, portfolio, contact info

13F, ADV, and OpenCorporates are **enrichment and verification layers**, not primary discovery sources. They make existing investor records more complete and trustworthy.
