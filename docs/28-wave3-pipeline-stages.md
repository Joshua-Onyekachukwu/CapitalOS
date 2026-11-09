# W3 (partial) — the 21-stage pipeline

Date: 2026-11-04
Scope: the stage vocabulary only. The rest of W3 (Lists, CRM basics, Reports v1,
Overview aggregates) is untouched.

`docs/26` §7 defines W3 as "Pipeline 21 stages + history". History was already
covered by `pipeline_events`; this change is the 21-stage part.

## Why the 11 stages had to go

The brief (§10) fixes the set at 21. The original 11 were not merely fewer —
they merged states that a pipeline needs to separate in order to report
anything:

| Old stage | Merged | Consequence |
|---|---|---|
| `meeting` | scheduled + completed | No way to tell "booked" from "happened", so meeting conversion was unmeasurable |
| `closed` | committed + closed-won | Money committed and money received were the same cell |
| `passed` | pass + lost deal | "Never contact again" and "lost after diligence" shared a terminal state |

There was also no stage for introductions, partner meetings, negotiation, or
verbal commitments — the middle of a real raise was invisible.

## What changed

**`supabase/migrations/024_pipeline_21_stages.sql`** — dropped the 11-value
CHECK constraint, remapped existing rows, re-added the constraint with 21
values, and added `idx_user_pipeline_entries_user_stage (user_id, stage)`.
Order is deliberate: the constraint has to come off before the UPDATEs, or every
remap is rejected.

| Legacy id | New id |
|---|---|
| `qualified` | `shortlisted` |
| `outreach` | `outreach_drafted` |
| `meeting` | `meeting_scheduled` |
| `closed` | `closed_won` |
| `passed` | `not_a_fit` |
| `discovered`, `researching`, `contacted`, `follow_up`, `due_diligence`, `term_sheet` | unchanged |

`pipeline_events.from_stage`/`to_stage` were remapped with the same CASE, because
an audit trail in a different vocabulary silently drops historical stage moves
from duration reporting.

**`src/lib/services/pipeline/stages.ts`** — 21 stages in raise order, plus
`TERMINAL_STAGES` / `isTerminalStage` so analytics can exclude finished
relationships without hardcoding ids. `STAGE_TO_READINESS` is typed as a total
`Record<PipelineStageId, string>`, so adding a 22nd stage without stating its
legacy meaning is a compile error, not a silent `undefined`.

**Two call sites** wrote the literal `"qualified"` and were updated:
`src/app/api/investors/saved/route.ts` (save → pipeline seeding) and
`src/app/dashboard/investors/discover/page.tsx` (add-from-discover).

**No UI change was needed.** `/dashboard/pipeline` renders whatever the API
returns from `PIPELINE_STAGES`, so it lists 21 stages already. It is an
expandable stage list rather than a fixed-column kanban, which is why the
widening does not break the layout — a 21-column kanban would have.

## Verification

- `npm run db:migrate` → `applying 024_pipeline_21_stages.sql … OK`;
  `db:status` → **22 files, 22 applied, 0 pending**.
- Constraint read back from `pg_constraint` lists all 21 ids.
- `user_pipeline_entries`: 2 rows, both `qualified` → **`shortlisted`**.
- `pipeline_events`: all 4 rows remapped (`qualified` → `shortlisted` in every
  from/to position).
- `npx tsc --noEmit` → 0 errors.
- `scripts/cross-tenant-test.cjs` against a local dev server → **50 passed, 0
  failed**. The harness now moves an investor to `partner_meeting` and asserts
  it lands there — a stage the 11-value constraint would have rejected with a
  `400`, so the run proves the widening is live through the API, not just in
  DDL. The existing `invalid stage id → 400` assertion still passes, so the
  guard is intact.

## Deliberately not done

- **No stage customisation per user.** The brief says "allow founders to
  customize stages where appropriate". A per-user stage set needs its own table
  and would make every report's grouping depend on the viewer; that is a design
  decision, not a default to assume.
- **No board grouping.** 21 rows render, but `closed_won`, `closed_lost` and
  `not_a_fit` are collapsed-by-default material, not peers of `researching`.
  Worth doing alongside the pipeline analytics that make terminal stages
  meaningful.
- **No data.** 2 entries in the whole system means every stage count except
  `shortlisted` is 0. The model is now correct; the product still looks empty.
