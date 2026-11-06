# Fundraising Readiness — completed module

Date: 2026-11-04
Closes: `docs/20` §2 "Fundraising readiness — **PARTIAL**" ("readiness_score
column exists and is selected; no scoring service found") and the brief's §12.

## What was actually there

`company_profiles.readiness_score` held values of 75–90 across all 4 profiles,
which looked like a working score. It came from `calculateReadinessScore()` in
`src/lib/actions/company.ts`: a flat count of 13 non-empty fields with hardcoded
weights summing to 100.

Four defects, all of which change a founder's behaviour if they see the number:

1. **`if (profile.mrr)` treats `0` as missing.** A pre-revenue founder who
   reports MRR 0 — the truthful answer — loses 5 points. The scoring taught
   founders to enter a non-zero number to look ready.
2. **`currently_raising: false` is indistinguishable from unanswered.** It cost
   5 points silently rather than being reported as the blocker it is.
3. **No categories, no reasons, no actions.** A founder saw "82" and could not
   tell what the missing 18 points were.
4. **Only recalculated on profile save.** Uploading a deck or deleting one did
   not change the score.

It also never read documents or team at all, so "pitch deck" was scored from the
`has_pitch_deck` boolean — which stays `true` even when the deck row has no
stored file.

## What was built

**`src/lib/services/readiness/score.ts`** — a pure `assessReadiness(input)`
function, no I/O. Six weighted categories summing to exactly 100:

| Category | Max | What it establishes |
|---|---:|---|
| Company foundation | 15 | An investor can identify and look up the company |
| Positioning | 20 | Problem, customer and difference are stated specifically |
| Traction | 20 | Numbers exist for the round, not adjectives |
| Round definition | 20 | Amount, instrument and target cheque range are set |
| Materials | 15 | Deck and one supporting document exist **and are retrievable** |
| Team | 10 | A named founder plus a stated background |

Every criterion returns the **stored field** it reads (`company_profiles.arr |
mrr`, `company_documents(document_type = 'pitch_deck')`, …), which the page
prints under each category. The score cannot show a number whose source is
unknown.

The two correctness rules are enforced and tested:
- `mrr: 0` **is** an answer — revenue is scored on `arr !== null || mrr !== null`,
  and the detail reads "reported as zero (pre-revenue)".
- `currently_raising: false` produces a named blocker, not a silent deduction.

**`src/app/api/readiness/route.ts`** — `GET`, authenticated, no id parameter
(there is nothing to tamper with; RLS scopes the profile read). Returns the full
breakdown, or `{ hasProfile: false }` for a founder who has not onboarded, and
refreshes `readiness_score` when it differs from the computed value so the
dashboard column cannot disagree with the page. `private, no-store`.

**`src/app/dashboard/readiness/page.tsx`** — score, band, "18 of 22 items in
place", blockers, the six highest-impact actions with their point value and a
link to the page that fixes each, then per-category criteria with met/missing
state. Loading skeletons, a retry-on-error state, and an empty state that sends a
new founder to onboarding rather than showing a 0.

**`src/components/Dashboard/Sidebar.tsx`** — `Readiness` added under Startup.

**`src/lib/actions/company.ts`** — `calculateReadinessScore` deleted. Profile
saves now call the same engine, reading documents and team in the same action, so
editing your profile cannot silently drop the points earned by uploading a deck.
`CompanyProfile` also gained `targetChequeMin` / `targetChequeMax`, which existed
in the database but had never been exposed or writable — a hidden field meant the
"target cheque range" criterion was unfixable from the UI.

## Verification

- `npx tsc --noEmit` → 0 errors.
- `npx vitest run src/__tests__/readiness.test.ts` → **10 passed** (empty profile
  = 0; complete profile = 100; zero revenue counts; unset revenue does not;
  not-raising is a blocker; stranded deck is flagged and blocked; supporting
  document scores separately; actions sorted by points; category maxima sum to
  100; disclaimer present).
- Live end-to-end against a dev server with a real signed-in founder:

```
anon status: 401 (expect 401)
auth status: 200
hasProfile: true company: Quadra Robotics
score: 74 band: developing met: 18/22
categories: 6 foundation=15/15 positioning=20/20 traction=20/20 round=9/20 materials=0/15 team=10/10
actions: 4 top: Pitch deck uploaded and stored +10
blockers: 2 | persisted: true
stored readiness_score: 74 | matches computed: true
```

`materials=0/15` is the honest result: all 6 `company_documents` rows are
`pitch_deck` with `file_url IS NULL` — created while the storage bucket did not
exist. The page's top recommendation is therefore the real blocker, not a
generic suggestion, and `has_pitch_deck` no longer masks it.

## Deliberately not claimed

- The score is **not** a prediction of a successful raise, and the API returns
  that sentence as data so no caller can present it as one.
- It does not judge company quality, market size or team seniority. Those need
  evidence this system does not hold; inventing them is the failure mode the
  brief forbids.
- No AI involvement. The score is deterministic arithmetic over stored fields.
- The 6 stranded deck rows were **not** deleted: they belong to the founder's
  account, and the page explains how to fix them.
