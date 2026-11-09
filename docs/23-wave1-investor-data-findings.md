# Wave 1 — Investor Data Findings

**Date:** 2026-11-02
**Scope:** Wave 1 of the approved plan — populate firms, backfill cheque sizes and theses, re-run qualification.
**Status:** Measurement complete. Two of the three planned objectives turned out to be **impossible as specified**, for reasons documented below.

---

## 1. The direct answer to your question

> "who legitimately lands over 90 and what data is missing for the rest"

**Nobody lands over 90. Not one record reaches 70.** Computed with the canonical
engine (`computeFitScore` in `src/lib/services/investor/qualification.ts`), against a
neutral `saas / seed / United States` reference profile:

| Band | Records |
|---|---|
| ≥ 90 | **0** |
| 80–89 | **0** |
| 70–79 | **0** |
| 60–69 | 5 |
| 40–59 | 11,707 |
| < 40 | 7,283 |
| **Highest score** | **63** |
| `outreach_readiness = 'ready'` | **0** |

The single best-scoring record scores 63, with this breakdown:

```
Sector 85 · Stage 100 · Type 5 · Geography 100
Check 40 · Contactability 20 · Completeness 50 · Activity 30
```

Note `Investor Type Fit = 5` and `Check Size Fit = 40` on the *best* record in the
database. Those two alone remove 15 points that no amount of data cleaning recovers.

### What is missing, in order of how much it costs

| Factor | Weight | Records where data is absent | Effect |
|---|---|---|---|
| Check Size Fit | 10% | **18,995 / 18,995 (100%)** | Scored 40 (unknown) on every record |
| Sector Match | 25% | 18,626 (98%) | Scored 15 (unconfirmable) |
| Stage Match | 20% | 6,776 (36%) | Where present, it is a bulk default — see §3 |
| Geography Match | 10% | 922 (5%) | Mostly available |
| Investor Type Fit | 10% | 0 (but mostly *wrong*) | Scored 5 for 60% of the corpus |
| Recent Activity | 5% | 18,995 (100%) | Scored 30, no investment dates exist |

### The ceiling is arithmetic, not effort

With every learnable factor at a perfect 100 and only the corpus-fixed factors
holding their real values (`Type = 5`, `Activity = 30`), the maximum attainable score is:

```
0.25·100 + 0.20·100 + 0.10·5 + 0.10·100 + 0.10·100
+ 0.15·100 + 0.05·100 + 0.05·30 = 87
```

**87 is the hard ceiling for this corpus.** 90 is unreachable by construction. This is
not a tuning problem and re-weighting will not fix it — only new data or a different
population will.

---

## 2. The reason: cheque sizes and theses do not exist in the source

The plan assumed these could be backfilled from existing sources. They cannot. I
checked the ingestion payload directly rather than trusting the column list:

`raw_records` — 16,840 rows, all IAPD-derived:

| Field | Records with a value |
|---|---|
| `legal_name` | 16,840 (100%) |
| `website` | 12,600 (75%) |
| `max_check_usd` | **0** |
| `min_check_usd` | **0** |
| `thesis` | **0** |
| `portfolio` | **0** |
| `sectors` | 280 (1.7%) |
| `stages` | 41 (0.2%) |
| `email` | **0** |
| `crunchbase_url` | **0** |

The JSON keys exist on every record; the values were never populated. This is **absent
data, not a mapping failure** — the earlier audit's "0% populated" finding is confirmed
at the source. There is nothing to backfill from.

---

## 3. Fabricated data I found and corrected

This matters more than the missing data, because fabricated values were actively
scoring records as if they were real.

**`is_verified = true` on 12,202 records while `email_verified = false` on all 18,995.**
The import set the flag; nothing was verified. This fed the Contactability factor and
the "verified" badge. → Cleared, with the reason recorded in `provenance`.

**`investment_stages = '{seed,series_a}'` on 12,067 records.** Every single one is
EDGAR-derived — a constant written across the whole import, not a stated preference.
It was contributing a `Stage Match = 100`, inflating every affected record. →
Marked `derived` in `provenance` with the default value recorded, so it can no longer
be presented as an investor's stated stage focus.

**`investor_type = 'angel_investor'` on 6,731 IAPD registrants** whose `full_name` is a
firm legal name (e.g. `CRIT VENTURES INC.`, `FIFTH WALL ASSET MANAGEMENT, LLC`). →
Marked `ai_classified` with the basis recorded.

Migration: [`supabase/migrations/022_investor_provenance.sql`](../supabase/migrations/022_investor_provenance.sql).

An earlier version of that migration reported success while changing nothing — its
`WHERE verification_status IS NULL` guards could never match, because the column was
already `NOT NULL DEFAULT 'unknown'`. The runner had recorded it as applied. I removed
the ledger entry, rewrote the file against the real vocabulary
(`verified`/`derived`/`ai_classified`/`unknown`), and re-applied. The final state:

| verification_status | Records |
|---|---|
| `unknown` | 12,310 |
| `ai_classified` | 6,685 |
| `verified` | **0** |

---

## 4. The larger finding: this is the wrong population

I did not expect to find this, and it changes the recommended next step.

The 18,995 records are **not startup investors**. By source:

| Source | Records | What it actually is |
|---|---|---|
| `edgar_restore_2026_09` | 11,943 | **SEC 13F-HR filers** — institutions reporting holdings in *public* equities |
| `iapd` | 6,792 | **SEC investment adviser registrants** — wealth managers and broker-dealers |
| `sec_edgar` | 260 | Form D advisers |

The EDGAR bios state it plainly: *"SEC 13F-HR filer. CIK: 0001598350. Last filing: 13F-HR."*

Their `job_title` is the constant string `"Institutional Investor"` on all 11,943, and
`full_name` is an institution (`Silicon Valley Community Foundation`, `Verisail Partners, LLC`).

By type:

| Type | Records | Share |
|---|---|---|
| `fund_of_funds` | 11,357 | 60% |
| `angel_investor` | 6,731 | 35% (IAPD firms, mislabelled) |
| `strategic_investor` | 551 | 3% |
| `venture_capital` | **140** | **0.7%** |
| `university_fund` | 72 | — |
| `family_office` | 67 | — |
| `private_equity` | 45 | — |
| `government_fund` | 31 | — |
| `corporate_venture` | **1** | — |

So roughly **140 VC firms** exist in a database of 18,995, and 60% of the corpus is
funds that buy public equities and do not make primary startup investments at all.
A founder searching this database is mostly being shown funds-of-funds.

Also structural: **every row is a firm, but the schema models a person.** All 18,995
records populate `full_name`, `first_name`, `last_name`, `job_title`, and
`linkedin_url` as if they were individuals. They are not. (The 5,305 IAPD `website_url`
values include `https://linkedin.com` — a site-wide link, not a firm page.)

---

## 5. What I deliberately did not do

**I did not create `investor_firms` rows and link `current_firm_id`.** The plan called
for it, but the investigation shows the `investors` rows *are* the firms. Creating a
parallel `investor_firms` table populated from the same `full_name` would duplicate the
entity and produce a self-referential `current_firm_id` — structure that looks like the
blueprint without being correct. The real fix is an entity split (§6), which is a design
decision, not a backfill.

**I did not infer cheque sizes or theses with an LLM.** The plan listed this as an
option. Applied to 18,995 records where the type is already wrong 35% of the time, it
would manufacture confident-looking numbers with no basis — precisely the failure the
brief forbids. If you want this, it needs to be a deliberate, budgeted, clearly-labelled
inference layer, and it should run *after* the population is corrected.

---

## 6. Recommendation

Ranked by impact on the goal ("help a founder find investors who actually fit"):

1. **Fix the population before anything else.** 60% funds-of-funds and 35% wealth
   advisers cannot be made relevant by scoring. Either query for VC signals
   (`investor_type = 'venture_capital'`, sector and stage presence) and treat the rest
   as out-of-scope, or re-ingest from venture-relevant sources. A 1,000-record database
   of real VCs is worth more than 19,000 mislabelled institutions.

2. **Split the entity model.** `investor_firms` = organisations (legal name, domain,
   location, fund size, cheque range, thesis). `investors` = people at those firms with
   roles. This is what unlocks partner-level contactability and the "warm introduction"
   module later.

3. **Then acquire the four missing attributes** — cheque range, thesis, sector, stage —
   per firm rather than per person, from a licensed provider or curated manually. Your
   CSV enrichment round-trip is now the highest-leverage input you can give me.

4. **Make the UI honest in the meantime.** `verification_status`, `last_verified_at` and
   `provenance` now exist and are populated. Surfacing "check size unknown" and
   "stage is a derived default" is truthful and better than showing 40/100.

---

## 7. What was built and applied

### Database tooling (so this does not need hand-holding again)

| Command | Purpose |
|---|---|
| `npm run db:status` | applied / pending migrations, plus checksum drift detection |
| `npm run db:migrate` | apply unapplied migrations, one transaction each |
| `npm run db:query -- "<sql>"` | ad-hoc SQL against the live project |
| `npm run db:rescore` | recompute fit scores with the canonical engine |

`scripts/db.cjs` discovers the pooler region once and caches it in
`.migration-region` (git-ignored). It distinguishes "wrong region" (`tenant not found`)
from "wrong password" (`28P01`) so a stale credential reports itself instead of
surfacing as a generic connection failure.

### Migrations applied this session

| File | Effect |
|---|---|
| `014_investor_email_verified.sql` | **was never applied** — `email_verified` column did not exist |
| `014_send_audit_trail.sql` | **was never applied** — `send_audit_trail` table did not exist |
| `015_live_schema_reconciliation.sql` | 14 production-only tables captured as migrations |
| `020_wave0_meetings_and_document_storage.sql` | `meetings` table + document bucket |
| `021_pipeline_owner_fk_set_null.sql` | owner FK unassigns instead of blocking |
| `022_investor_provenance.sql` | evidence grading; removed fabricated verification |

The ledger was baselined, which exposed that **two migrations in the repository had
never been applied to production** — including `send_audit_trail`, which the outreach
send path depends on. Both are now applied.

### Scores persisted

All 18,995 records re-scored with `fit_score_breakdown` (per-factor score, weight,
explanation, confidence, dataQuality). Previously only 4 records had a breakdown;
now all 18,995 do, so every displayed score can explain itself.

---

## 8. Checks

- `npx tsc --noEmit` — 0 errors.
- `npm run db:status` — 20 files, 20 applied, 0 pending.
- Storage round-trip (upload → sign → fetch → delete) — passed.
- Anon write to the private bucket — correctly denied.
- Foreign keys on reconciled tables verified: NOT NULL parent references now `CASCADE`,
  nullable `owner_id` now `SET NULL`.
- Scored distribution recomputed from the database after the write, not from the
  script's own in-memory tally.
