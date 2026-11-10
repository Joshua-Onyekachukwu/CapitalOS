# Batch 003 — EDGAR enrichment of staged candidates

**Run:** 2026-11-10 · `enrich-edgar.cjs`, `enrich-web.cjs`, `score-local.cjs`
**Scope:** fill fund type, team, cheque proxy, fund size and sector evidence for
the 21,990 staged Form D candidates. **Local storage only** — no database writes.

## Result: 4,386 of 21,990 candidates enriched (20%) before SEC throttled the host

Every enriched record was parsed from the filing's own `primary_doc.xml`.

| Field | Records | % of enriched |
|---|---:|---:|
| Fund type (`investmentFundType`) | 3,865 | 88.1% |
| Minimum investment accepted | 4,386 | 100% |
| Related persons (team) | 4,386 | 100% |
| Total offering amount | 1,773 | 40.4% |
| Date of first sale | 3,518 | 80.2% |

### Fund type distribution (authoritative, as filed)

| Type | Count | Share |
|---|---:|---:|
| Venture Capital Fund | **1,086** | 24.8% |
| Private Equity Fund | 947 | 21.6% |
| Hedge Fund | 981 | 22.4% |
| Other Investment Fund | 851 | 19.4% |
| Unknown | 521 | 11.9% |

Scaled to all 21,990 candidates that is roughly **5,450 venture funds** and
**4,920 hedge funds** — the latter are correctly disqualified from an early-stage
investor database, which the raw Form D stream could not tell us.

### What the team data looks like

Related persons are the fund's officers, directors, promoters and general
partners, e.g. *Melissa Garlough — Executive Officer*, *Amir Karimpour —
Executive Officer*. Administrative agents also appear (*Finally Fund Admin LLC*),
so a person/org split and a role filter are required before using these as
decision-makers.

### Cheque size caveat

`minimumInvestmentAccepted` is the **minimum LP commitment into the fund**, not
the cheque a startup receives. It is stored as a commitment band and scores at
most 3/15 on cheque compatibility. No record is treated as having a startup
cheque range from this field.

## Website enrichment

| Metric | Value |
|---|---:|
| Candidates attempted | 216 |
| Domains tried | ~1,200 |
| Sites fetched | 21 |
| **Verified investor sites** | **19** |
| Stage evidence from site | 11 pre-seed, 16 seed |
| Cheque text found | 3 |
| Sector language found | 19 |
| Public emails found | 4 |

Website discovery via derived domains is slow and low-yield (≈9% of attempted
records, ≈4% of domain guesses). Search engines (DuckDuckGo, Mojeek) block this
host with 403; Bing returns HTML but its terms forbid automated querying, so it
was not used.

## Local qualification of the enriched subset

Scoring uses only evidence actually present; missing dimensions score zero.

| Tier | Count |
|---|---:|
| A (85–100) | **0** |
| B (70–84) | **2** |
| C (50–69) | **17** |
| D (<50) | 4,367 |
| Disqualified (hedge/real-estate, no venture evidence) | 981 |

Median record is Tier D because fund type is a mandate, not a track record, and
no cheque, portfolio or founder-policy evidence exists for most funds. The two
Tier B records combine a verified website, explicit seed language, a cheque
range, a recent first sale and a named team.

## Blockers hit

1. **SEC 429.** Per-filing fetching at ~12 req/s tripped the fair-access limit;
   subsequent requests, including the quarterly bulk archive, returned 429.
   The engine now pauses on `Retry-After`; the bulk path exists and will replace
   per-filing requests when the block lifts.
2. **390 filings had no readable `primary_doc.xml`** (8.2% of responses) —
   renamed documents or non-standard submissions.
3. **Search engines unusable** for website discovery (see above). This is the
   main reason qualified counts stay low: without a website we rarely get stage,
   cheque or contact evidence.

## What this proves

The enrichment engine works and produces authoritative, non-fabricated fields at
scale: fund type, team, minimum commitment, offering amounts and first-sale
dates. It also shows the real bottleneck to 50k qualified investors — **website
and cheque evidence**, not identity discovery. Adding more Form D quarters will
add more identities, but only website/ADV data converts them into qualified
investors.

## Next actions

1. Finish the remaining 17,604 candidates from SEC quarterly bulk archives
   (one request per quarter, no rate-limit exposure).
2. Pull Form ADV bulk data for registered advisers, which includes firm website
   and, for many VC managers, a direct route to stage and cheque evidence.
3. Re-run local scoring and publish tier counts per region and fund type.
4. Build the person/org split from related persons so one firm yields its
   decision-makers.
