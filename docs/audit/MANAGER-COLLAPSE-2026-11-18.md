# Manager-level collapse — measurement, 2026-11-18

**Question:** the import added 5,461 SEC Form D **fund vehicles**
(`X Fund III - Series 9`), not 5,461 investors. How many distinct managers do
they represent, and can we collapse them without merging unrelated funds?

**Status:** measured, **not applied**. No rows were changed and no corpus
number should be re-quoted as “investors” until the manager key is agreed.

---

## What was measured

Read-only scripts, run against the live corpus:

- `scripts/analyze-fund-managers.cjs` — clusters by normalized name
- `scripts/analyze-manager-graph.cjs` — clusters by shared related persons

| Method | Distinct groups | Vehicles ÷ groups | Notes |
|---|---:|---:|---|
| Imported vehicles | 5,461 | 1.00 | What we loaded |
| **Name clustering (conservative)** | **4,327** | 1.26 | 1,071 managers with >1 vehicle; 1,134 vehicles absorbed |
| **Shared-people graph (filtered)** | **3,398** | 1.61 | 1,281 groups with >1 vehicle; 2,063 absorbed |

So the vehicle count overstates distinct managers by **26–61%**. The defensible
statement today is: **≈3,400–4,300 distinct managers**, not 5,461 investors.

## Why neither number is final

Both signals have known failure modes, and they fail in opposite directions:

**Name clustering over-merges umbrella vehicles.** `CGF2021 LLC` alone appears
in 864 filings; `Roll Up Vehicles, LP` in 371; `Platform Funds` in 152; `MV
Funds` in 82. These are SPV platforms used by many unrelated managers, so name
clustering wrongly reports them as one manager. Excluding those six platform
umbrellas lifts the estimate to ≈3,745 — still a guess.

**People clustering over-merges administrators.** `n/a Fund GP, LLC` spans 1,325
vehicles and Sydecar 1,050; filtering entity names and any person at >25
vehicles drops 8 administrators and lands at 3,398. But platform operators who
are natural persons still merge genuinely separate managers (e.g. `VUVP Fund`
34 vehicles, `Decile Start Fund` 23). It under-merges elsewhere: a solo GP with
one vehicle and a variant name stays as two groups.

The largest **correct** cluster is instructive: Andreessen Horowitz, 23 vehicles
(AH Crypto Fund V, AH American Dynamism II-B, …) via Marc Andreessen and Ben
Horowitz. That is the shape we want; the platform clusters are the false
positives.

## What a real collapse needs

A manager key derived from an identity field, not a string:

1. **GP legal entity** — Form D does not expose a clean GP name, so this needs
   the adviser/CRD route (Form ADV) or the filing's related-person set plus
   manual review.
2. **Canonical manager table** — `investor_managers(id, name, key, key_source,
   confidence)` with vehicles pointing at it (`investors.manager_id`). Keep
   every vehicle row; discovery groups by manager.
3. **Manual review of the top 50 clusters** before any automatic merge — that
   covers most of the absorbed vehicles.
4. **Count change in one commit** with landing copy, `AGENTS.md`, `docs/23` and
   `docs/30`, per the repo rule, and only after the frontend agent lands the
   current copy pass.

## Applied 2026-11-19 — review-gated, no heuristic merges

The top 60 explicit "a series of X" clusters were exported and classified by
hand in `scripts/manager-review-decisions.json` (each entry carries a decision
and a reason). `scripts/build-manager-map.cjs` applies **only** keys marked
`approve`; it refuses to infer a manager from a name.

| Result | Value |
|---|---:|
| Clusters reviewed | 60 |
| Approved clusters | 20 (grouped into 18 managers; AGC's two funds and Hustle Fund's program + verticals share one manager each) |
| Applied distinct managers | **18** |
| Vehicles mapped | **179** (3.28% of 5,461) |
| Rejected clusters recorded | 40 (`review_status = 'rejected'`, 0 vehicles mapped) |
| Remaining clusters | unmapped (`manager_id` NULL) |

Approval required textual identity: the vehicles repeat the manager's own name
or code (DataPower's `DPV …`, Infinitas `SPV …`, AGC-prefixed, `EQP AI …`) and
no third-party brand appears. Rejections cover SPV platforms and
administrators (CGF2021, Roll Up Vehicles, Platform Funds, MV Funds, V360,
SLRTE, Clutch, Decile, AngelList, Republic) and — importantly — clusters whose
vehicles are coded-only or carry unrelated brands (`Exitfund`, `VUVP`,
`Umami`, `Fog`, `JMWTX`, `Sajid Rahman`, `JJ Fliegelman`). Those are **not**
proven single managers; they stay unmapped until the Form ADV/CRD join exists.

Reproduce:

```bash
node scripts/build-manager-map.cjs --export-review --top 60   # candidates
node scripts/build-manager-map.cjs                           # dry run
node scripts/build-manager-map.cjs --apply                    # approved only
```

Every vehicle row is kept; nothing is deleted or deactivated. Corpus counts
(24,379 active records / 5,461 vehicles) are unchanged, so landing copy needs
no edit.

## Recommendation

Do **not** deactivate vehicles yet. The measured range is enough to stop
quoting 5,461 as investors; it is not enough to hide 1,000–2,000 records behind
a heuristic key. Next step is the `manager_id` schema plus a reviewed mapping
for the largest clusters (which also fixes outreach deduplication without
deleting filing evidence).

## Reproduce

```bash
node scripts/analyze-fund-managers.cjs
node scripts/analyze-manager-graph.cjs
```

Outputs: `.tmp/fund-managers.json`, `.tmp/manager-graph.json` (untracked).
