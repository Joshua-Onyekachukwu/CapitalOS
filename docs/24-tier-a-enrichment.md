# Tier-A enrichment: 27 firms researched

Date: 2026-11-03
Scope: the 27 tier-A records from `exports/investor-data-export/investor-worklist.csv`
(28 ranked tier A, less one duplicate-name copy).

## Artifacts

| File | What it is |
|---|---|
| `scripts/data/tier-a-research.cjs` | The sourced findings, one block per firm, each with the URL it came from |
| `scripts/apply-tier-a-research.cjs` | Applies them; dry-run by default, `--apply` to write, idempotent |
| `public.investors` | 27 rows updated, provenance merged per field |
| `exports/investor-data-export/` | Re-exported with the new values |

Re-running `node scripts/apply-tier-a-research.cjs` after the apply produces
`Would write 0 field change(s)` — the values round-trip through Postgres
unchanged, which is what makes the script safe to leave in the repo.

## Coverage achieved

| Field | Before | After | Share of corpus |
|---|---|---|---|
| Cheque size (min) | 0 | 14 | 0.07% of 18,995 |
| Cheque size (max) | 0 | 15 | 0.08% |
| Investment thesis | 0 | 26 | 0.14% |

Of the 27, `verification_status = 'verified'` for 20 (every recorded value
comes from the firm itself) and `'derived'` for 7 (the cheque range rests on a
third-party database).

## Cheque ranges found

15 firms publish a figure. `basis` records whether the firm said it or someone
else did.

| Firm | Range | Currency | Basis |
|---|---|---|---|
| Wellington Partners Life Science | €2M – €20M | EUR | firm |
| Alpine Space Ventures | €10M – €20M | EUR | firm ⚠ conflict |
| MAX Ventures | $1.0M – $1.5M | USD | firm |
| AI Fund (3 entities) | $500K – $1M | USD | firm (studio formation capital) |
| Pragmatech Venture Capital | up to $500K | USD | firm (ceiling only) |
| Maverick Ventures Israel | $2M – $5M | USD | firm |
| Infinity Ventures Crypto | ~$250K | USD | third party |
| Next Coast Ventures | $5M – $10M | USD | third party (founder quote) |
| Melitas Ventures | $500K – $3M | USD | third party |
| Robot Ventures | $100K – $5M | USD | third party |
| Starlight Ventures | $250K – $2.5M | USD | third party |
| Thursday Ventures | $500K – $1M | USD | third party |
| SaaS Ventures | $75K – $200K | USD | third party (average) |

## Twelve firms publish no cheque range

Third Rock, DAG, Arboretum, Chrysalis, Healthcare Venture Partners, Energy
Transition Ventures, 11 Tribes, Balerion, Blockchain Valley Ventures, Viewpoint,
Maverick Israel (thesis only) and WuXi Healthcare Ventures.

This is not a research failure — most venture firms deliberately do not publish
cheque sizes, because it weakens their negotiating position. Third-party sites
fill the gap with estimates that contradict each other (for Third Rock: $2M–$50M,
$10–50M, and $100K–$5M, all for the same firm). **None of those is recorded.**
Fund sizes were also refused as substitutes: DAG's $1.8B, Balerion's $200M+ Fund
II and Viewpoint's $150M Fund I say nothing about an individual cheque.

## Twelve of 27 firm types were wrong

The IAPD import typed most of these as `angel_investor`, which is a catch-all
for SEC adviser registrants. The firm's own description contradicts it in
twelve cases:

| Firm | Was | Now | Why |
|---|---|---|---|
| AI Fund Growth Ventures | angel_investor | venture_studio | Co-founds companies; does not take inbound pitches |
| AI Ventures Management | angel_investor | venture_studio | Same organisation |
| AI Ventures Management II | angel_investor | venture_studio | Same organisation |
| SaaS Ventures | angel_investor | micro_vc | $75K–$200K cheques |
| Healthcare Venture Partners | angel_investor | venture_capital | Mid-to-late stage healthcare venture |
| Infinity Ventures Crypto | angel_investor | venture_capital | $70M crypto fund |
| Wellington Partners | angel_investor | venture_capital | European life-sciences VC |
| Energy Transition Ventures | angel_investor | venture_capital | $75M Texas energy fund |
| Balerion Space Ventures | angel_investor | venture_capital | Space VC, Fund II |
| Blockchain Valley Ventures | angel_investor | venture_capital | Swiss web3 VC |
| WuXi Healthcare Ventures | angel_investor | venture_capital | Life-sciences investor (merged 2017) |
| Chrysalis Capital | venture_capital | private_equity | $1–10M EBITDA and $1M+ revenue screen; rarely invests at seed |

**44% of the best-scoring records had the wrong type.** That matters more than
the missing cheque sizes: investment type is what decides whether a founder
should be looking at a firm at all.

## Four research findings that change records, not just fields

**1. Maatra Ventures is not a venture capital firm.** `maatra.ai` is a
quantitative investment management firm running machine-learning,
market-neutral strategies in public markets — Princeton NJ plus a GIFT City
(Gujarat) fund management entity. It writes no startup cheques. The IAPD import
typed it `angel_investor`. There is no `investor_type` enum value for a
public-markets hedge fund, so the type is **deliberately left unchanged** rather
than forced into a wrong label. This needs a schema decision or removal from the
dataset, and it should be excluded from outreach.

**2. WuXi Healthcare Ventures had merged, and the "wrong" website was right.**
`6dimensionscapital.com` looked like a bad website mapping. It isn't: WuXi
Healthcare Ventures merged with Frontline BioVentures in May 2017 to form
6 Dimensions Capital, which is the surviving entity and whose site still hosts
the old WuXi press releases. Treat the record as a historical entity and target
6 Dimensions instead. This was worth checking before "fixing" it.

**3. `maverick.vc` is Maverick Ventures Israel, not the US firm.** The record is
the Tel Aviv entity (GP Ltd), which publishes "$2–5 million per investment".
Maverick Ventures in San Francisco is the venture arm of Maverick Capital — a
different firm. Do not copy the US firm's thesis onto this record or merge them.

**4. Three websites were broken and are now corrected.**

| Firm | Was | Now |
|---|---|---|
| Infinity Ventures Crypto | `https://twitter.comivcryptofund` (malformed, missing `/`) | `https://ivcrypto.io` |
| Robot Ventures | `https://twitter.com` (placeholder, site root) | `https://robvc.com` |
| 11 Tribes Ventures | `11tribes.com` (not the firm) | `11tribes.vc` |

Note that two of the three stored a Twitter/X URL as if it were a company
domain. Worth a bulk check across the corpus.

## Conflicts kept rather than resolved

1. **Alpine Space Ventures** — the firm's site says €10–20M initial cheques; July
   2024 Fund I coverage says €1–5M per investment across 10–15 companies. Both
   are recorded; the site figure is stored. Probably Fund I vs Fund II.
2. **Chrysalis Capital** — retyped to private_equity, but it still describes
   itself as investing in early-stage and expansion-stage businesses. The
   boundary is genuinely blurred.
3. **Maverick Ventures** — see finding 3.

## Two defects surfaced by doing the work

**`data_quality_score` ignores cheque size and thesis entirely.** Its inputs are
email, LinkedIn, job title, phone, bio, stages, sectors, country, city, website.
The two fields the product most needs are not scored, so these 27 records show no
completeness change even though they went from 0% to sourced cheque ranges and
theses. Not changed here — it would rescore all 18,995 rows and belongs in its
own pass — but it means the quality score currently cannot detect enrichment.

**The ranking scorer had a type gap.** Adding `venture_studio` and `micro_vc`
rules was necessary because retyping AI Fund and SaaS Ventures correctly made
their scores *drop*: an unrecognised enum value silently reads as a demotion.
Fixed, and every enum value that matters now has an explicit rule.

## What this says about the remaining 982

15 of 27 tier-A firms yielded a cheque range — 8 stated by the firm itself, 7
only from a third-party database. Twelve yielded none, and for those no amount
of further searching produces one. Extrapolated, the corpora's 1,009-row
worklist contains roughly 550 firms with a findable cheque range and 450 without.
The 17,986 rows outside the worklist would need individual research to enrich and
would mostly return nothing.

That is the argument for enriching down the worklist rather than across the
corpus: the yield per hour is far higher at the top, and the top is only 5% of the
rows.
