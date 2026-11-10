# Corpus state and capacity model — 2026-11-10

All figures measured against the live database this date. Nothing here is
promoted or projected except where the table says **estimate**.

## 1. What we actually hold

| Layer | Count |
|---|---:|
| `investors` rows | 18,995 |
| — active after 76 merges | **18,919** |
| `investor_candidates` | 21,990 |
| — new / unqualified | **21,949** |
| — duplicate of corpus | 41 |
| **Total raw entities across both tables** | **40,985** (some candidate overlap already removed by name) |
| Firm entities (`investor_firms`) | 0 |
| People (`investor_people`) | 0 |

## 2. Qualified — the honest number

Product qualification (`fit_score`, 0–100):

| Band | Count |
|---|---:|
| ≥ 85 (Tier A) | **0** |
| 70–84 (Tier B) | **0** |
| 50–69 (Tier C) | **348** |
| < 50 (Tier D) | 18,571 |
| Highest score in corpus | **63** |
| Average | 36.7 |

So: **348 potentially relevant, 0 qualified to Tier A/B, 0 verified.**

Verification: `is_verified = true` on **0** rows. 17 carry
`verification_status = 'verified'` but none has the boolean set; 5,008 need
verification; 7,211 are unknown; 6,673 AI-classified.

Candidates: all 21,949 score 16/100 (Tier D, unverified). 19,328 carry 0.95
classification confidence, 2,662 only 0.50 (name evidence alone).

## 3. Complete details — where the corpus breaks

| Field | Records | % of 18,919 |
|---|---:|---:|
| Name | 18,919 | 100% |
| City | 17,876 | 94.5% |
| Country | 17,997 | 95.1% |
| Job title | 12,127 | 64.1% |
| Investment stages | 12,143 | 64.2% |
| Website | 5,494 | 29.0% |
| Email | 4,921 | 26.0% |
| — email verified | **0** | 0% |
| LinkedIn | 796 | 4.2% |
| Investment sectors | 368 | 1.9% |
| Thesis | 26 | 0.1% |
| Cheque size | 15 | 0.08% |
| Portfolio companies | **0** | 0% |
| Last investment date | **0** | 0% |
| Firm link (`current_firm_id`) | **0** | 0% |
| Bio | 12,127 | 64.1% |

Profiles meeting the "complete core" test (email + website + stage + sector +
cheque): **0**. Email + stage + sector: **61**. Email + stage: 4,663.

Geography: US 14,968 · UK 801 · Cayman 245 · Hong Kong 231 · Singapore 181 ·
France 120 · Luxembourg 112 · Switzerland 111 · Israel 106 · Canada 105 ·
China 87 · unknown 922.

Investor type is also unreliable: 11,283 are labelled `fund_of_funds` and 6,720
`angel_investor`, which does not match the source mix (13F institutions and IAPD
advisers). Type correction is required before any category count is published.

## 4. Capacity model — how many more are reachable

Estimates below assume permitted public sources, our own enrichment, and no
fabrication. "Qualified" here means evidence of early-stage activity plus at
least stage or cheque/portfolio evidence.

### Per-source reachable capacity (distinct organizations, 18–24 months)

| Source family | Access | Reachable | Venture-relevant | Qualified | Cost |
|---|---|---:|---:|---:|---|
| SEC Form D, 5-year history | free, permitted | 120k–180k filings → 45k–70k managers | 15k–25k | 8k–14k | compute |
| SEC Form ADV / IAPD | free | ~15k advisers | 4k–6k | 2k–3k | compute |
| SEC 13F | free | ~5k institutions | 1k–2k | 500–1k | compute |
| UK Companies House + FCA | free key | 15k–25k fund entities | 4k–6k | 2k–3k | free key |
| EU national registers + associations | mixed | 15k–25k | 8k–12k | 4k–6k | low |
| India SEBI AIF + IVCA | public lists | 1.5k–2.5k | 1.5k–2.5k | 800–1.5k | compute |
| Singapore/HK/Japan/Korea | public registers | 4k–6k | 3k–4k | 1.5k–2.5k | compute |
| MENA (DIFC, ADGM, MAGNiTT) | mixed | 2.5k–4k | 2k–3k | 800–1.5k | low–paid |
| Africa (AVCA, ABAN, hubs) | public | 2k–3k | 1.8k–2.8k | 700–1.2k | compute |
| LatAm (LAVCA, registers) | public | 2.5k–4k | 2k–3k | 800–1.5k | compute |
| Canada (CVCA, CSA) | public | 2k–3k | 1.5k–2.5k | 700–1.2k | compute |
| Australia/NZ (AIC) | public | 1.5k–2.5k | 1.2k–2k | 500–900 | compute |
| Accelerators with direct investment | public | 700–1,200 | same | 500–900 | compute |
| Corporate venture arms | public | 1.5k–2k | same | 800–1.2k | compute |
| Family offices (identifiable) | public | 3k–8k | 2k–5k | 800–2k | compute |
| University + government funds | public | 800–1,500 | same | 500–1,000 | compute |
| Angel networks + individual angels | public/terms | 40k–80k people | 30k–60k | 10k–20k | compute |
| Licensed datasets (Dealroom/Crunchbase) | paid | +60k–120k | +40k–80k | +15k–30k | $15k–45k/yr |

### Resulting ranges

| Target | Public sources only | + one licensed dataset |
|---|---:|---:|
| Raw unique entities + people | 120k–220k | 250k–400k |
| With a usable public contact | 45k–80k | 90k–150k |
| Qualified early-stage investors (evidence-backed) | **30k–50k** | **55k–85k** |
| Tier A/B (stage + cheque + geography + recency) | 8k–15k | 20k–35k |

**50k qualified is achievable in 12–18 months without licensing, but only if
enrichment (website, team, stage, cheque) runs continuously.** It is not
achievable by adding more filings alone: 21,990 candidates produced 0 qualified
records because Form D carries no stage or cheque data. The bottleneck is
enrichment throughput, not discovery.

**1M records** is reachable only by counting people (partners, angels, scouts)
with thin evidence, plus licensed data. It is not reachable as 1M qualified
investors; the global population of active early-stage investors with public
evidence is plausibly 100k–250k.

## 5. What changes the curve fastest

1. **Enrichment engine** over candidate websites/EDGAR XML: stage, sector,
   cheque, team. Without it every new source adds Tier D rows.
2. **Firm/people model** (`investor_firms`, `investor_people`): one firm yields
   2–5 decision-makers, which is how the record count legitimately scales to
   hundreds of thousands.
3. **UK Companies House** free key: the largest English-language registry after
   the US.
4. **Type correction** on the existing 18,919: 11,283 `fund_of_funds` labels are
   almost certainly wrong and poison qualification.
5. **One licensed dataset** is the cheapest route to cheque sizes and thesis
   text at scale; public data will not supply them in bulk.
