# Acquisition methodology

## 1. Phases

| Phase | Output | Gate before the next phase |
|---|---|---|
| Source discovery | `sources/source_registry.csv` | access method and licence recorded |
| Acquisition | raw JSONL in `data/raw/<provider>/<run>/` | payload stored untouched, run metrics written |
| Normalisation | processed JSONL | deterministic, re-runnable from raw |
| Deduplication | duplicate verdicts | exact keys first; fuzzy matches never auto-merge |
| Classification | candidate rows | `entity_kind` + reason + confidence |
| Enrichment | filled candidate fields | every field carries a source URL |
| Qualification | score + tier | only evidence-backed dimensions score |
| Promotion | `investors` rows | reviewed, never automatic |

## 2. Evidence levels

Every material field is stamped with one of:

- **verified** — directly stated by the entity or an authoritative registry;
- **corroborated** — two independent sources agree;
- **estimated** — derived from evidence, with the derivation written down;
- **unverified** — discovered, not confirmed;
- **unknown** — no reliable information found.

A missing cheque size is stored as `null` with `basis: unknown`. It is never
stored as `0`, and an inferred range is never presented as a stated one.

## 3. Identity and deduplication

Order of keys, strongest first:

1. Registry identifier (CIK, company number, LEI).
2. Website domain.
3. LinkedIn organization URL.
4. Normalised name + country.
5. Normalised name alone (flag only).

Name normalisation lowercases, replaces `&` with `and`, strips punctuation and
legal suffixes (`llc`, `lp`, `inc`, `ltd`, `plc`, `gmbh`, …). It deliberately
keeps `fund`, `capital`, `ventures` — those words distinguish entities, they are
not noise.

Two people are never merged on name alone: affiliations and profile URLs must
agree. A fund vehicle is never merged into a firm by name similarity; series
vehicles are grouped explicitly under a master entity when that relationship is
evidenced.

## 4. Classification

`entity_kind` is assigned with a written reason and a confidence:

| Signal | Kind | Confidence |
|---|---|---|
| Form D Item 3C | fund vehicle | 0.95 |
| Form D + fund/firm name token | fund vehicle | 0.50 |
| Registry SIC code for fund management | firm | 0.85 |
| Published individual deal activity | individual/angel | 0.70–0.90 |
| Accelerator programme page | accelerator | 0.80 |
| Name only | unknown | 0.15 |

A fund vehicle is not automatically an investor in the product sense: it may be
a single-deal SPV, a holding company, or a later-stage vehicle. Promotion needs
stage and cheque evidence.

## 5. Qualification

Nine dimensions, weights and evidence rules are in
`qualification_framework.md`. Two invariants:

1. **Research completeness cannot raise suitability.** No amount of contact data
   compensates for never having invested at early stage.
2. **Missing evidence scores zero, not negative, and is listed.** A record with
   unknown stage and cheque size can still be Tier B if portfolio evidence shows
   pre-seed cheques; the missing fields lower confidence, not truth.

## 6. Quality assurance

Automated checks before any promotion:

- required fields present (`full_name`, `entity_kind`, source identifiers);
- URL reachability for website/LinkedIn where claimed;
- impossible ranges rejected (min > max cheque, year in the future);
- currency present whenever an amount is present;
- contact values only when published on a page we can cite;
- duplicate status resolved or explicitly accepted;
- source `fetched_at` within the freshness window for "active" claims.

## 7. Scale and resumability

- Requests: 140 ms gap, retry with exponential backoff, hard cap per run.
- Windows: EFTS is split weekly to stay inside the 10,000-result pagination cap.
- Checkpoints: `data/checkpoints/<run>.json` records completed windows.
- Writes: chunked, idempotent via `unique (source_provider, source_id)`.
- Metrics per run: filings scanned, classifications, duplicates, inserts,
  geography distribution, runtime, report path.

## 8. Compliance

- Public, licensed or explicitly permitted sources only; the registry records
  licence status, and `commercial_only` / `unknown` sources are not collected
  until reviewed.
- No authentication bypass, paywall circumvention, CAPTCHA solving or rate-limit
  evasion.
- Public professional data only. No sensitive personal data, no private contact
  details, no guessed email addresses.
- SEC fair access: identifying User-Agent and ≤10 requests/second.
