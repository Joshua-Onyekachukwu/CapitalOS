# P1 (Tier B) — Core Product Completion: status

Date: 2026-11-04
Source of truth: `docs/audit/PRODUCT_ROADMAP.md` Tier B (B1–B6) and
`docs/audit/IMPLEMENTATION_PLAN.md` Phase 2 (2.1–2.5). Acceptance targets come
from `docs/20-blueprint-audit-and-mvp-plan.md` §7.

Every number below was measured on the live database this session, not carried
over from an earlier doc.

## Board

| ID | Task | Status | Evidence |
|---|---|---|---|
| B1 | Contact acquisition pipeline in production | **Blocked** | `APOLLO_API_KEY` and `ZEROBOUNCE_API_KEY` are both absent from `.env`. The pipeline script and its dry-run mode exist; nothing to run until keys are set. |
| B2 | First real outreach cycle | **Blocked** | `email_messages` holds **0 rows**. Needs a connected mailbox and a 2-week warmup (warmup cannot be compressed). |
| B3 | Approval & billing enforcement audit trail | **Done this session** | Migration 014 applied (`campaign_id`, `sequence_id`, `approved_draft_id` present; `email_send` = 1 credit). Pre-send gate → 402, refund on failure, and `campaignId` now validated against the sender's own campaigns. |
| B4 | Reply-understanding wired to UI | **Unblocked, unproven** | Migration 012 applies cleanly. Cannot be proven without a real reply — depends on B2. |
| B5 | Stripe founding-member E2E | **Blocked** | `STRIPE_SECRET_KEY` not set. |
| B6 | Pipeline semantics fix (task 2.5) | **Done this session** | Stage counts and listings are now the founder's own `user_pipeline_entries`; the corpus's batch qualification is returned separately as `dataset`, labelled `database_batch_qualification`. |

## What B6 actually was

The `dataset_status` rename (task 2.5's earlier pass) relabelled the field but
left the arithmetic untouched. A founder with an empty pipeline still saw
**13,983 discovered + 5,012 qualified** in their stage counts, because the route
added the whole corpus's `outreach_readiness` distribution to every account's
counts. "Your pipeline" opened pre-loaded with 18,995 strangers.

Changes:

- `src/app/api/investors/pipeline/route.ts` — stage counts and stage listings
  count only the user's entries; the batch distribution moves to a separate
  `dataset` object carrying its `source`. The stale "compatibility mode" branch
  is gone (the entries table exists and is what the route reads).
- `src/app/dashboard/pipeline/page.tsx` — batch qualification renders as its own
  labelled strip ("every record, not your pipeline") instead of being counted as
  the founder's stages.
- `src/app/api/investors/saved/route.ts` — saving an investor seeds a
  `user_pipeline_entries` row at `qualified` (`ignoreDuplicates`, so a re-save
  can never drag an entry backwards). Without this the cutover would have left
  the pipeline empty with no way in except the per-card "Move" button.

## Task 2.3 gap closed

`campaignId` and `approvedDraftId` arrive in the request body and were written
into `email_messages` unvalidated, so a forged `campaign_id` could attach a send
to another tenant's campaign. `campaignId` is now resolved against
`campaigns.id` **and** `user_id` before the credit gate, so a bad ref 404s
without touching the ledger.

## Where the MVP targets actually stand (`docs/20` §7)

| Criterion | Target | Measured |
|---|---|---|
| Investors with firm linked | ≥ 60% | `investor_firms` exists; see `docs/23` — the rows *are* firms, so a self-referential join is not the fix |
| Investors with cheque range | ≥ 40% | 14 / 18,995 (0.07%) |
| Investors with thesis text | ≥ 40% | 26 / 18,995 (0.14%) |
| Investors with email | ≥ 50% | 4,921 / 18,995 (25.9%) |
| `outreach_readiness = 'ready'` | ≥ 500 | **0** |
| One real email sent, replied, in pipeline | yes | 0 sends |
| Fresh DB rebuildable from migrations | yes | 20 files, 20 applied, 0 pending |
| `tsc --noEmit` | 0 errors | 0 |

The cheque/thesis percentages are not a B6 problem and not fixable by more
research of the same kind: 12 of the 27 tier-A firms publish nothing
(`docs/24`), and the corpus is 60% funds-of-funds and 35% wealth advisers
(`docs/23` §4). Reaching 40% means replacing the population, not enriching it.

## Checks run

- `npx tsc --noEmit` — 0 errors.
- `npx vitest run` — 100 passed, 61 skipped (the skipped suites probe a live
  server; ECONNREFUSED on 3000).
- `npm run db:status` — 20 files, 20 applied, 0 pending.
- Live queries for every figure in this document.

## B6 verified against a live server (2026-11-04)

The rewrite was previously asserted, not exercised. It has now been run end to
end with two authenticated tenants against a local dev server
(`http://localhost:50467`):

```
node scripts/cross-tenant-test.cjs --base-url http://localhost:50467 --verbose
→ Cross-tenant isolation: 50 passed, 0 failed
```

Results that specifically cover B6 and task 2.3:

| Assertion | Result |
|---|---|
| A moves a shared investor into its own entry → `200 {success:true}` | ✔ |
| A sees that move when listing its chosen stage | ✔ |
| Row payload carries `dataset_status` and **no** `outreach_readiness` | ✔ |
| B does **not** see A's stage move in the same stage listing | ✔ |
| B's summary loads on dataset defaults only (`stages` array present) | ✔ |
| Invalid stage id → `400` | ✔ |
| Note attribution stays with the authenticated sender | ✔ |

The `dataset_status` / `outreach_readiness` assertion is the one that would have
caught the original bug: the corpus's qualification is now a separate labelled
field, so a founder's stage list can no longer be populated by 18,995 records
they never touched. Anonymous access returns `401` on all four probed routes.

Still not run: a visual check of the pipeline board, and the
`/api/investors/saved` seeding path under a browser session (it is covered by
unit tests, not by this harness).
