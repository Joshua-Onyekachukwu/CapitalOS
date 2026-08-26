# Capital OS — Legal & Compliance Guide

> Pre-launch legal readiness checklist. This document covers every legal and compliance area you need to address before launching.

---

## 1. PRIVACY POLICY

### What It Must Include
- **What data you collect**: Names, emails, company info, usage data, IP addresses, browser data
- **How you collect it**: Direct input, OAuth (Google/Microsoft), scraped public data, API integrations
- **Why you collect it**: To provide the service, improve it, communicate with users
- **How you store it**: Supabase (PostgreSQL), Vercel hosting, encryption at rest
- **Who you share it with**: Service providers (Supabase, Vercel, NVIDIA AI, email providers)
- **User rights**: Access, correction, deletion, portability, opt-out
- **Data retention**: How long you keep data after account deletion
- **Contact information**: Your email for privacy inquiries
- **Cookie policy**: What cookies you use and why
- **Children's privacy**: Confirm the service is 18+ only
- **Changes to policy**: How you notify users of updates

### Legal Requirements by Jurisdiction
| Law | Applies To | Key Requirement |
|-----|-----------|-----------------|
| **GDPR** (EU/EEA) | Any user in EU | Consent, right to erasure, data portability, DPO appointment for large-scale processing |
| **CCPA/CPRA** (California) | California residents | Right to know, right to delete, right to opt-out of sale, no discrimination |
| **PIPEDA** (Canada) | Canadian users | Consent, limited collection, limited use, accuracy, safeguards |
| **LGPD** (Brazil) | Brazilian users | Similar to GDPR — consent, purpose limitation, data minimization |

### Action Items
- [ ] Update Privacy Policy at `/privacy` with all required disclosures
- [ ] Add cookie consent banner for EU visitors
- [ ] Implement user data export endpoint (`/api/user/export-data`)
- [ ] Implement user account deletion endpoint (`/api/user/delete-account`)
- [ ] Add data processing agreement with Supabase
- [ ] Add data processing agreement with Vercel
- [ ] Add data processing agreement with NVIDIA AI

---

## 2. TERMS OF SERVICE

### What It Must Include
- **Service description**: What Capital OS does
- **User eligibility**: 18+ years old
- **Account responsibilities**: Password security, unauthorized use
- **Acceptable use policy**: What users can and cannot do
- **Intellectual property**: Who owns what (you own the platform, users own their data)
- **Payment terms**: Billing, refunds, cancellation
- **Limitation of liability**: Cap on damages
- **Indemnification**: Users indemnify you for their misuse
- **Dispute resolution**: Arbitration clause, governing law, jurisdiction
- **Termination**: When and how accounts can be terminated
- **Modifications**: How you can change terms

### Action Items
- [ ] Update Terms of Service at `/terms` with complete legal language
- [ ] Add arbitration clause (protects against class action lawsuits)
- [ ] Add governing law clause (typically Delaware for US companies)
- [ ] Add limitation of liability (cap at amount paid in last 12 months)
- [ ] Add indemnification clause

---

## 3. EMAIL COMPLIANCE (CRITICAL)

### CAN-SPAM Act (United States)
Cold email is **legal** in the US under CAN-SPAM, but you MUST comply:

| Requirement | What It Means | Your Implementation |
|-------------|---------------|---------------------|
| **No false headers** | From/To/Reply-To must be accurate | ✅ Already using real sender email |
| **No deceptive subjects** | Subject must match content | ⚠️ Need to validate subject lines |
| **Identify as ad** | Must clearly identify as solicitation | ❌ NOT IMPLEMENTED — add "Advertisement" disclosure |
| **Physical address** | Must include valid physical address | ❌ NOT IMPLEMENTED — add company address to emails |
| **Opt-out mechanism** | Must honor unsubscribe requests within 10 days | ⚠️ Partial — suppression list exists but no unsubscribe link |
| **No bought lists** | Cannot email people who haven't consented (with exceptions) | ✅ Using public investor data |
| **Monitor third parties** | If using a service, you're still liable | ✅ Self-hosted sending |

### GDPR (European Union)
Cold email to EU individuals requires **legitimate interest** basis:

| Requirement | What It Means | Your Implementation |
|-------------|---------------|---------------------|
| **Lawful basis** | Need legitimate interest or consent | ⚠️ Need to document legitimate interest |
| **Right to object** | Must honor opt-out immediately | ⚠️ Suppression list exists but no easy opt-out |
| **Data minimization** | Only collect what's needed | ✅ Collecting relevant investor data |
| **Right to erasure** | Must delete data on request | ❌ NOT IMPLEMENTED |
| **Data portability** | Must export data on request | ❌ NOT IMPLEMENTED |
| **Privacy notice** | Must inform at point of collection | ⚠️ Privacy policy exists but not shown during data collection |
| **DPO requirement** | May need Data Protection Officer | ⚠️ Need to assess — depends on scale |

### CASL (Canada)
Canada has **stricter** rules than CAN-SPAM:

| Requirement | What It Means |
|-------------|---------------|
| **Express consent required** | Must have opt-in before sending (with limited exceptions) |
| **Implied consent** | Existing business relationship or published email |
| **Consent records** | Must prove consent was obtained |
| **Unsubscribe** | Must work for 60 days after send |
| **Penalties** | Up to $10M CAD per violation |

**⚠️ Risk**: If you have Canadian users sending cold emails, CASL may apply. Consider geo-filtering Canadian recipients or requiring express consent.

### Action Items
- [ ] Add physical business address to all outgoing emails
- [ ] Add "Advertisement" or "Commercial email" disclosure
- [ ] Add unsubscribe link to every email
- [ ] Build unsubscribe endpoint that processes within 24 hours (best practice)
- [ ] Log all consent/opt-out events with timestamps
- [ ] Create suppression list export for compliance audits
- [ ] Add geo-filtering to exclude jurisdictions where cold email is restricted
- [ ] Document legitimate interest basis for GDPR

---

## 4. DATA SCRAPING COMPLIANCE

### SEC EDGAR Data
- ✅ **Legal to use**: SEC EDGAR is public government data, freely available
- ⚠️ **Rate limits**: Max 10 requests per second, must include User-Agent
- ⚠️ **Terms of use**: Must include "From SEC.gov" attribution in metadata
- ⚠️ **No resale of raw data**: Can't resell raw EDGAR filings as-is, but can create derivative products

### Web Scraping (VC Firm Websites)
- ⚠️ **Check Terms of Service**: Most websites prohibit scraping in their ToS
- ⚠️ **CFAA risk**: Exceeding authorized access can violate Computer Fraud and Abuse Act
- ⚠️ **hiQ v. LinkedIn (2022)**: Scraping publicly available data is generally legal, but gray areas exist
- ✅ **Best practice**: Respect robots.txt, rate limit, don't bypass authentication

### Third-Party Data (FishTank, Crunchbase, etc.)
- ⚠️ **Terms of service**: Most data platforms prohibit scraping/resale
- ⚠️ **Database rights**: EU has sui generis database rights that may apply
- ✅ **Best practice**: Use only publicly available data, don't redistribute raw data

### Action Items
- [ ] Document all data sources and their legal basis
- [ ] Add "Data sourced from public records" disclosure to investor profiles
- [ ] Implement robots.txt compliance in scrapers
- [ ] Add rate limiting to all scraping scripts (10 req/sec max for SEC)
- [ ] Create data provenance log for every investor record
- [ ] Review Terms of Service of all scraped data sources

---

## 5. INTELLECTUAL PROPERTY

### What You Need
| Item | Status | Action |
|------|--------|--------|
| **Trademark** | ❌ Not registered | File for "Capital OS" trademark with USPTO |
| **Domain** | ✅ capitalos.io | Ensure auto-renewal is enabled |
| **Copyright** | ✅ Automatic | Consider registering copyright for key content |
| **Open source** | ⚠️ Check | Review all npm dependencies for license compatibility |
| **AI-generated content** | ⚠️ Gray area | AI-generated emails may not be copyrightable |

### Action Items
- [ ] File trademark application for "Capital OS" (USPTO — ~$250-350 per class)
- [ ] Audit all npm packages for license compatibility (GPL/AGPL in dependencies = risk)
- [ ] Add copyright notice to footer: "© 2026 Capital OS. All rights reserved."
- [ ] Review AI-generated content ownership (currently no clear legal precedent)

---

## 6. BUSINESS ENTITY

### Recommended Structure
For a SaaS startup, you should have:

| Entity | Why | Cost |
|--------|-----|------|
| **LLC or C-Corp** | Liability protection, professional credibility | $100-500 formation + annual fees |
| **EIN (Tax ID)** | Required for banking, hiring, taxes | Free from IRS |
| **Business bank account** | Separate personal and business finances | Varies |
| **Operating agreement** | Defines ownership and governance (LLC) | Attorney: $500-2,000 |

### Recommendation
- **C-Corp in Delaware** if you plan to raise venture capital
- **LLC in your home state** if bootstrapping

### Action Items
- [ ] Form business entity (LLC or C-Corp)
- [ ] Get EIN from IRS
- [ ] Open business bank account
- [ ] Set up accounting (QuickBooks, Wave, or similar)
- [ ] Get business insurance (general liability + E&O)

---

## 7. DATA PROTECTION & SECURITY

### Required Measures
| Area | Requirement | Status |
|------|-------------|--------|
| **Encryption at rest** | All stored data encrypted | ✅ Supabase AES-256 |
| **Encryption in transit** | All data over HTTPS | ✅ Vercel auto-SSL |
| **Access controls** | Role-based access, least privilege | ✅ RLS policies |
| **Authentication** | Secure password storage, OAuth | ✅ Supabase Auth |
| **Token encryption** | OAuth tokens encrypted at rest | ✅ AES-256-GCM |
| **Backup strategy** | Regular automated backups | ⚠️ Need to verify Supabase backup schedule |
| **Incident response** | Plan for data breaches | ❌ NOT DOCUMENTED |
| **Data processing agreements** | With all vendors | ❌ NOT SIGNED |

### Action Items
- [ ] Verify Supabase backup schedule and retention
- [ ] Create incident response plan (who to notify, within what timeframe)
- [ ] Sign Data Processing Agreements with Supabase, Vercel, NVIDIA
- [ ] Implement audit logging for all data access
- [ ] Add 2FA option for user accounts
- [ ] Conduct basic security audit (OWASP Top 10)

---

## 8. PAYMENT & BILLING COMPLIANCE

### If Using Stripe (Recommended)
| Requirement | Status |
|-------------|--------|
| PCI DSS compliance | ✅ Stripe handles this (no card data touches your server) |
| Refund policy | ⚠️ Need to define and publish |
| Subscription terms | ⚠️ Need clear cancellation flow |
| Tax collection | ⚠️ Need to collect sales tax where required |
| Receipt/invoice requirements | ⚠️ Must provide receipts for all charges |

### Action Items
- [ ] Integrate Stripe for payments
- [ ] Define refund policy (recommend 14-day full refund)
- [ ] Build subscription management UI (upgrade, downgrade, cancel)
- [ ] Set up tax collection (Stripe Tax handles this automatically)
- [ ] Generate invoices/receipts for all transactions

---

## 9. EMAIL OUTREACH SPECIFIC COMPLIANCE

### What You Must Do Before Users Send Cold Emails

| Item | Description | Priority |
|------|-------------|----------|
| **Unsubscribe link** | Every email must have a working unsubscribe | 🔴 Critical |
| **Physical address** | Every email must include your business address | 🔴 Critical |
| **Advertisement disclosure** | Mark commercial emails as advertisements | 🔴 Critical |
| **Suppression list** | Honor unsubscribes immediately | ✅ Built |
| **Bounce handling** | Remove hard-bounced addresses | ✅ Built |
| **Rate limiting** | Prevent spam-like sending patterns | ✅ Built |
| **Daily limits** | Cap emails per account per day | ✅ Built |
| **Warm-up system** | Gradual volume increase for new accounts | ✅ Built |
| **Email health monitoring** | Track deliverability metrics | ✅ Built |
| **Sending window enforcement** | Only send during business hours | ✅ Built |

### What You Must NOT Do
- ❌ Send emails without unsubscribe mechanism
- ❌ Use purchased email lists
- ❌ Send from fake/impersonated addresses
- ❌ Ignore unsubscribe requests
- ❌ Send to suppressed addresses
- ❌ Exceed provider sending limits
- ❌ Use deceptive subject lines
- ❌ Send without physical address

### Action Items
- [ ] Add unsubscribe link to email templates
- [ ] Add physical address to email templates
- [ ] Add "Advertisement" disclosure to email templates
- [ ] Build unsubscribe endpoint (`/api/unsubscribe`)
- [ ] Test unsubscribe flow end-to-end
- [ ] Add sending compliance check to send pipeline

---

## 10. RISK ASSESSMENT

### Highest Risk Areas
| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| **GDPR violation** (EU users) | 🔴 Critical | Medium | Add consent flow, data export/deletion, geo-filtering |
| **CAN-SPAM violation** | 🔴 Critical | High | Add unsubscribe, physical address, ad disclosure |
| **CASL violation** (Canada) | 🔴 Critical | Medium | Geo-filter Canadian users or require consent |
| **Scraping ToS violation** | 🟡 Medium | Medium | Respect robots.txt, use public data only |
| **Trademark infringement** | 🟡 Medium | Low | Search USPTO, file trademark |
| **Data breach** | 🔴 Critical | Low | Encryption, access controls, incident response plan |
| **AI content liability** | 🟡 Medium | Low | Disclaimer that AI content is user's responsibility |
| **Payment fraud** | 🟡 Medium | Low | Use Stripe, implement fraud detection |

---

## 11. LAUNCH CHECKLIST

### Must Have Before Launch
- [ ] Privacy Policy (complete, jurisdiction-specific)
- [ ] Terms of Service (complete, with arbitration clause)
- [ ] Business entity formed (LLC or C-Corp)
- [ ] EIN obtained
- [ ] Business bank account opened
- [ ] Unsubscribe mechanism in all emails
- [ ] Physical address in all emails
- [ ] Suppression list active and working
- [ ] Bounce handling active
- [ ] User data export endpoint
- [ ] User account deletion endpoint
- [ ] Cookie consent banner (for EU visitors)
- [ ] Email templates reviewed for CAN-SPAM compliance

### Should Have Before Launch
- [ ] Trademark filed
- [ ] Business insurance
- [ ] Incident response plan documented
- [ ] Data processing agreements signed
- [ ] Security audit completed
- [ ] Backup verification
- [ ] Rate limiting on all public endpoints
- [ ] Geographic restrictions for restricted jurisdictions

### Nice to Have
- [ ] SOC 2 Type I certification (enterprise customers)
- [ ] ISO 27001 certification
- [ ] Penetration testing
- [ ] Bug bounty program

---

## 12. ESTIMATED COSTS

| Item | Cost | Timeline |
|------|------|----------|
| LLC/C-Corp formation | $100-500 | 1-2 weeks |
| Trademark filing | $250-350/class | 6-12 months |
| Business insurance | $500-2,000/year | 1 week |
| Legal review of ToS/Privacy | $1,000-3,000 | 2-4 weeks |
| PCI compliance (via Stripe) | $0 (Stripe handles) | Immediate |
| Supabase DPA | $0 (included) | Immediate |
| Vercel DPA | $0 (included) | Immediate |
| **Total estimated** | **$1,850-5,850** | |

---

## 13. WHAT TO DO RIGHT NOW

### Priority 1 — Before Any Users Sign Up
1. **Add unsubscribe link** to all email templates
2. **Add physical address** to all email templates  
3. **Add "Advertisement" disclosure** to outbound emails
4. **Build unsubscribe endpoint** (`/api/unsubscribe`)
5. **Update Privacy Policy** with complete disclosures
6. **Update Terms of Service** with arbitration clause

### Priority 2 — Before Public Launch
1. Form business entity
2. Get EIN
3. Open bank account
4. Sign DPAs with vendors
5. Cookie consent banner
6. Data export/deletion endpoints
7. Trademark filing

### Priority 3 — After Launch
1. Security audit
2. Penetration testing
3. SOC 2 preparation (if targeting enterprise)
4. Ongoing compliance monitoring

---

*This document is for informational purposes and does not constitute legal advice. Consult a licensed attorney for specific legal guidance.*
