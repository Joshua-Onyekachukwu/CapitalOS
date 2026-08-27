# Investor Intelligence System — Gap Analysis & Implementation Plan

---

## PART 1: CURRENT STATE AUDIT

### Database

| Table | Rows | Status |
|-------|------|--------|
| `investors` | 72,524 | ✅ Exists — flat denormalized table, 108 columns |
| `email_accounts` | 0 | ✅ Exists — empty, schema has OAuth + custom SMTP fields |
| `raw_incoming_records` | — | ❌ Does not exist |
| `data_sources` | — | ❌ Does not exist |
| `field_sources` | — | ❌ Does not exist |
| `organizations` | — | ❌ Does not exist |
| `organization_memberships` | — | ❌ Does not exist |
| `data_history` | — | ❌ Does not exist |
| `data_conflicts` | — | ❌ Does not exist |
| `duplicate_reviews` | — | ❌ Does not exist |
| `outreach_emails` | — | ❌ Does not exist |
| `outreach_campaigns` | — | ❌ Does not exist |
| `email_templates` | — | ❌ Does not exist |
| `audit_log` | — | ❌ Does not exist |
| `qualification_rules` | — | ❌ Does not exist |

### Code Services (TypeScript)

| Service | File | Status | Notes |
|---------|------|--------|-------|
| Normalization | `src/lib/services/investor/normalization.ts` | ✅ Built | Stage/Type/Sector/Country normalization |
| Matching | `src/lib/services/investor/matching.ts` | ✅ Built | Levenshtein + weighted signals, uses CockroachDB |
| Ingestion | `src/lib/services/investor/ingestion.ts` | ✅ Built | CSV → raw → normalize → match → canonical, uses CockroachDB |
| Enrichment | `src/lib/services/investor/enrichment.ts` | ✅ Built | Quality scoring + provenance logging, uses CockroachDB |
| Qualification | `src/lib/services/investor/qualification.ts` | ✅ Built | 7-factor scoring, uses CockroachDB |
| CSV Import | `src/lib/services/investor/csv-import.ts` | ✅ Built | Flexible column detection |
| SMTP Sender | `src/lib/services/email/smtp-sender.ts` | ✅ Built | Per-user custom SMTP |
| Email Templates | `src/lib/services/email/templates.ts` | ✅ Built | Investor outreach, follow-up, welcome |

### Scripts

| Script | Purpose | Status |
|--------|---------|--------|
| `clean-data.js` | Dedup, normalize, validate, standardize | ✅ Working |
| `score-remaining.js` | 7-factor bulk scoring | ✅ Working |
| `export-csv-backup.js` | CSV + JSON backup | ✅ Working |
| `enrich-contacts.js` | NVIDIA AI contact enrichment | ✅ Working |
| `edgar-bulk-scraper.js` | EDGAR SEC filing scraper | ✅ Working |
| Various EDGAR scripts | 13F, Form D, N-CEN scrapers | ✅ Working |

### Data Quality (72,524 investors)

| Metric | Value | Assessment |
|--------|-------|------------|
| Total records | 72,524 | Good volume |
| Scored (7-factor) | 72,524 (100%) | ✅ Complete |
| With email | 13,837 (19.1%) | ⚠️ Low |
| Verified | 2,435 (3.4%) | ❌ Very low |
| With LinkedIn | 9,036 (12.5%) | ⚠️ Low |
| High fit (≥70) | 2,808 (3.9%) | ⚠️ Low — most are F-rated |
| Ready for outreach | 0 | ❌ Critical gap |
| With investor_type | 72,524 (100%) | ✅ Complete |
| With organization model | 0 | ❌ Missing entirely |

---

## PART 2: GAP ANALYSIS

### A. What Exists vs What's Needed

| Capability | Exists | Needed | Gap |
|------------|--------|--------|-----|
| **Raw data staging** | ❌ No | ✅ Yes — raw_incoming_records | CRITICAL |
| **Field-level versioning** | ❌ No | ✅ Yes — field_sources | CRITICAL |
| **Change tracking** | ❌ No | ✅ Yes — data_history | CRITICAL |
| **Organization model** | ❌ No | ✅ Yes — organizations + memberships | CRITICAL |
| **Duplicate review queue** | ❌ No | ✅ Yes — duplicate_reviews | CRITICAL |
| **Conflict resolution** | ❌ No | ✅ Yes — data_conflicts | HIGH |
| **Audit logging** | ❌ No | ✅ Yes — audit_log | HIGH |
| **Source provenance** | ❌ Partial | ✅ Yes — field-level | HIGH |
| **Email verification** | ❌ Boolean flag | ✅ Yes — DNS MX + status tracking | HIGH |
| **Data freshness** | ❌ No | ✅ Yes — staleness detection | HIGH |
| **Outreach tracking** | ❌ No | ✅ Yes — outreach_emails | HIGH |
| **Campaign system** | ❌ No | ✅ Yes — outreach_campaigns | MEDIUM |
| **Email templates** | ❌ No | ✅ Yes — email_templates | MEDIUM |
| **Qualification rules** | ❌ Hardcoded | ✅ Yes — configurable rules engine | MEDIUM |
| **Investor engagement** | ❌ No | ✅ Yes — timeline + history | MEDIUM |
| **Multi-channel** | ❌ Email only | ✅ Yes — LinkedIn, phone, intro | LOW |
| **OpenVC integration** | ❌ Blocked | ✅ Yes — need alternative approach | HIGH |
| **Apollo enrichment** | ❌ Not wired | ✅ Yes — selective enrichment | HIGH |
| **IMAP reply detection** | ❌ No | ✅ Yes — inbound email polling | MEDIUM |
| **OAuth email** | ❌ Not connected | ✅ Yes — Gmail/Outlook OAuth | MEDIUM |

### B. Critical Architecture Gaps

**1. No Raw/Staging Layer**
Current flow: CSV/Script → `investors` table directly
Required flow: Source → `raw_incoming_records` → normalize → match → `investors`

Without this, we cannot:
- Reprocess when qualification rules change
- Track what came from where
- Handle re-imports without duplicates
- Audit the ingestion pipeline

**2. No Field-Level Versioning**
Current: Overwrite existing values on update
Required: `field_sources` table with is_current flag, superseded_by links

Without this, we lose historical data every time we update an investor record.

**3. No Organization Model**
Current: `company_name` is a flat field on the investor
Required: `organizations` table with normalized names, aliases, domains, and `organization_memberships` linking people to orgs

Without this, we cannot:
- Understand that "ABC Ventures" and "ABC Ventures LLC" are the same org
- Find all partners at a firm
- Understand org → person → role relationships

**4. Ingestion Uses CockroachDB**
Current: `ingestion.ts`, `matching.ts`, `enrichment.ts`, `qualification.ts` all import from `@/lib/db` (CockroachDB)
Required: These should use Supabase (our primary DB)

This means the existing pipeline code is essentially non-functional for our current architecture.

---

## PART 3: IMPLEMENTATION PLAN

### Phase 1 — Database Foundation (Week 1-2)

**Objective:** Create the missing database tables and migrate existing code to Supabase.

**Database changes:**
```sql
-- New tables to create:
raw_incoming_records     -- staging area for all incoming data
data_sources             -- registry of all data sources
field_sources            -- versioned field-level provenance
organizations            -- canonical organization records
organization_memberships -- person-org-role links
data_history             -- change audit trail
data_conflicts           -- unresolved disagreements
duplicate_reviews        -- human review queue
audit_log                -- immutable action log
```

**Code changes:**
- Migrate `ingestion.ts` from CockroachDB to Supabase
- Migrate `matching.ts` from CockroachDB to Supabase
- Migrate `enrichment.ts` from CockroachDB to Supabase
- Migrate `qualification.ts` from CockroachDB to Supabase
- Create Supabase migration SQL file

**Dependencies:** Supabase (already connected)
**Done when:** All new tables exist, all services use Supabase, ingestion pipeline works end-to-end

---

### Phase 2 — Identity Resolution & Deduplication (Week 3-4)

**Objective:** Build proper entity resolution with organization matching and duplicate review.

**What we build:**
- Organization normalization engine (name variants, domain matching, alias management)
- Enhanced person matching (existing `matching.ts` upgraded to use Supabase + org context)
- Duplicate review queue UI
- Merge logic (combine records, preserve all data in `field_sources`)
- Backfill: run matching on all 72K existing records

**Key improvements over current matching:**
- Add organization-aware matching (same firm = stronger signal)
- Add domain-based org matching
- Add Jaro-Winkler similarity alongside Levenshtein
- Add confidence thresholds: auto-merge (≥90%), review (70-89%), separate (<70%)

**Database changes:** None (tables created in Phase 1)
**Frontend:** Review queue page in admin dashboard
**Done when:** New imports auto-detect duplicates, review queue handles uncertain matches

---

### Phase 3 — Data Versioning & Change Tracking (Week 5)

**Objective:** Every field change is tracked with source, timestamp, and confidence.

**What we build:**
- `field_sources` population on every import/update
- `data_history` logging on every change
- `data_conflict` detection when sources disagree
- Data freshness scoring (data older than 90 days → lower confidence)
- Conflict resolution UI

**Key behavior:**
- Import from OpenVC → creates `field_sources` with source='opencv', confidence=0.7
- Later, Apollo enrichment → creates new `field_sources` with source='apollo', confidence=0.9
- If values differ → `data_conflicts` row created
- User resolves conflict → audit logged

**Database changes:** None (tables from Phase 1)
**Frontend:** Investor profile shows data history tab, conflict badges
**Done when:** Every field change logged, conflicts surfaced to user

---

### Phase 4 — OpenVC Ingestion (Week 6-7)

**Objective:** Acquire and process OpenVC's investor dataset.

**Approach:**
Since OpenVC is behind Cloudflare, we need a strategy:

1. **If Cloudflare can be bypassed legally:** Use headless browser or API
2. **If not:** Export OpenVC data manually (CSV from their dashboard), or use their RSS/sitemap
3. **Alternative:** Use `fundraise.in`, `Tracxn`, or `Signal NFX` as primary source instead
4. **Nuclear option:** Contact OpenVC for data partnership or bulk export

**Pipeline:**
```
OpenVC raw data → raw_incoming_records → normalize → match against existing 72K
→ merge duplicates → promote new records → field_sources populated
→ qualification scoring → outreach readiness
```

**Expected outcomes:**
- Raw records acquired: ~10,000-50,000 (depending on source)
- After dedup against existing 72K: ~5,000-20,000 new unique investors
- With qualification scores and field provenance

**Dependencies:** Phase 1, 2, 3
**Done when:** OpenVC data processed through full pipeline, all records have provenance

---

### Phase 5 — Enrichment & Verification (Week 8-9)

**Objective:** Fill missing data and verify existing data.

**What we build:**
- Apollo enrichment (selective — only for qualified investors missing contacts)
- DNS MX email verification
- AI-enriched company websites and domains
- LinkedIn profile construction
- Data freshness re-verification scheduling

**Apollo strategy (as specified):**
- Don't enrich every record blindly
- Prioritize: recognized firms, missing contacts, strong fit signals
- Use `api/v1/mixed_companies/search` → find org → `api/v1/people/search` → find contacts
- Store in `field_sources` with source='apollo'

**Email verification:**
- DNS MX record check → 'verified' or 'risky'
- Cross-reference with Hunter.io or similar (if available)
- Never mark AI-inferred emails as 'verified'

**Dependencies:** Phase 1, 3
**Done when:** Top 5K qualified investors have verified emails and complete profiles

---

### Phase 6 — Enhanced Qualification (Week 10)

**Objective:** Make qualification configurable, explainable, and per-user.

**What we build:**
- Qualification rules engine (user-configurable via `qualification_rules` table)
- Enhanced scoring with more factors
- Per-user qualification (different users may have different criteria)
- Qualification dashboard

**Current scoring (7 factors):**
1. Sector Match (25%)
2. Stage Match (20%)
3. Geography Match (15%)
4. Check Size Fit (15%)
5. Data Completeness (10%)
6. Contactability (10%)
7. Recent Activity (5%)

**Enhanced scoring (9 factors):**
1. Sector Match (20%)
2. Stage Match (18%)
3. Geography Match (12%)
4. Check Size Fit (12%)
5. Thesis Fit (10%) — NEW: AI-analyzed alignment with investor's stated thesis
6. Portfolio Relevance (8%) — NEW: overlap with user's sector/stage
7. Activity (8%) — Enhanced: recent fund raises, portfolio additions
8. Contactability (7%) — Enhanced: verified email, LinkedIn, phone
9. Data Confidence (5%) — NEW: how recent and verified is the data

**Dependencies:** Phase 3, 5
**Done when:** Qualification is configurable, explainable, and produces meaningful differentiation

---

### Phase 7 — Email Integration (Week 11-12)

**Objective:** Connect email accounts and build outreach tracking.

**What we build:**
- Gmail OAuth connection flow (reconnect existing setup)
- Outlook OAuth connection flow
- `outreach_emails` table and tracking
- `email_templates` table
- Email open/click tracking (pixel + link wrapping)
- IMAP reply detection (background polling)

**Email connection:**
- User clicks "Connect Gmail" → Google OAuth → tokens stored encrypted
- User clicks "Connect Outlook" → Microsoft OAuth → tokens stored encrypted
- Custom SMTP still supported as fallback

**Tracking:**
- Unique tracking pixel per email
- Unique click tracking links
- Reply detection via IMAP polling (every 15 min)
- Bounce detection

**Dependencies:** Phase 1
**Done when:** User can connect email, send tracked outreach, detect replies

---

### Phase 8 — AI-Assisted Outreach (Week 13-14)

**Objective:** AI drafts personalized outreach using investor intelligence.

**What we build:**
- AI email drafting using NVIDIA + investor data context
- Investor-aware personalization (references their thesis, portfolio, stage)
- Tone/style options
- `outreach_campaigns` table
- Campaign management UI

**AI prompt architecture:**
```
Context: investor profile + startup profile + previous emails
Task: Generate personalized outreach email
Constraints: Reference specific investor interests, mention portfolio companies, under 200 words
Output: Subject + body + explanation of personalization choices
```

**User control:**
- AI drafts → User reviews → User edits → User sends
- No autonomous sending

**Dependencies:** Phase 5, 6, 7
**Done when:** AI generates personalized emails using full investor intelligence

---

### Phase 9 — Campaign & Analytics (Week 15-16)

**Objective:** Campaign management, analytics, and engagement tracking.

**What we build:**
- Campaign builder (select investors, set sequence, schedule)
- Follow-up automation (user-approved, not autonomous)
- Campaign analytics dashboard
- Investor engagement timeline
- Performance metrics (open rate, reply rate, meeting rate)

**Investor engagement timeline:**
```
Investor discovered → Qualified → Outreach drafted → User approved
→ Email sent → Delivered → Opened → Replied → Interested
→ Meeting → Fundraising outcome
```

**Dependencies:** Phase 7, 8
**Done when:** Full campaign lifecycle works from import to tracked outreach

---

## PART 4: DATA SOURCE STRATEGY

### Tier 1 — Primary: EDGAR (already scraped)

We already have 72,524 investors from EDGAR. These are entity-level (fund names), not individuals. The data is:
- ✅ Fund names, types, investment activity
- ❌ Individual contacts, emails, LinkedIn
- ❌ Investment preferences (stages, sectors)
- ✅ Portfolio data (from 13F-HR filings)

### Tier 2 — OpenVC / Fundraise.in / Tracxn

These provide investor profiles with:
- ✅ Investor type, stages, sectors, geography
- ✅ Check sizes, fund sizes
- ❌ Individual contacts (usually behind paywall)
- ✅ Investment thesis, portfolio

**Strategy:** Use these for investor entity data. Don't rely on them for contact data.

### Tier 3 — Apollo (enrichment)

Apollo is the contact data layer:
- ✅ Individual contacts at organizations
- ✅ Professional emails (verified)
- ✅ LinkedIn profiles
- ✅ Job titles, roles
- ❌ Investment preferences

**Strategy:** Use Apollo to find people at organizations we already know about. Don't use Apollo as primary investor source.

### Tier 4 — Manual / User-Provided

Users can add investors manually or via CSV. These go through the same pipeline.

---

## PART 5: SUCCESS METRICS

After full implementation, report:

| Metric | Target |
|--------|--------|
| Total raw records acquired | Track all sources |
| Unique investors after dedup | Track |
| Investors with complete profiles (≥80% fields) | Track |
| Investors with verified emails | Track |
| Investors with LinkedIn profiles | Track |
| Investors with identifiable decision makers | Track |
| Qualified investors (score ≥70) | Track |
| Highly qualified (score ≥85) | Track |
| Outreach-ready (qualified + verified contact) | Track |
| Excluded records | Track with reasons |
| Deduplication rate | Track |
| Enrichment success rate | Track |
| Apollo API credits consumed | Track |

**Primary success metric:**
> "We have X qualified, outreach-ready investors with verified contacts and explainable fit scores."

NOT: "We have 500K raw records."

---

## PART 6: PRIORITIZED EXECUTION ORDER

Given our resources (1 developer, free Supabase, NVIDIA AI, Apollo key), the recommended order is:

1. **Phase 1** — Database foundation (enables everything else)
2. **Phase 2** — Identity resolution (makes existing 72K usable)
3. **Phase 5** — Enrichment & verification (fills the critical contact gap)
4. **Phase 6** — Enhanced qualification (makes scoring meaningful)
5. **Phase 4** — OpenVC ingestion (expands the dataset)
6. **Phase 3** — Data versioning (important but less urgent than contact data)
7. **Phase 7** — Email integration (enables outreach)
8. **Phase 8** — AI outreach (the payoff)
9. **Phase 9** — Campaign analytics (optimization)

**Rationale:** The #1 gap is contact data. We have 72K investors but only 19% have emails and 0 are outreach-ready. Phase 5 (enrichment) should be prioritized after the database foundation is solid.
