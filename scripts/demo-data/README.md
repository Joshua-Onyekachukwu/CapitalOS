# Demo dataset tooling

Deterministic, obviously-synthetic data for demos, load tests and calibration.
Nothing in here ever represents a real person, a real fund or traction.

## Rules the generator enforces

1. Every investor, firm and founder row has `is_synthetic = true` and a
   `demo_batch` (default `demo-2026-11`) so a whole load can be removed atomically.
2. Investor emails use the reserved `.example` TLD — mail can never be delivered.
3. Founder/waitlist emails use `@founders.demo.capitalos.example`.
4. LinkedIn and website URLs point at `demo.capitalos.example`.
5. Names are drawn per cultural group matched to the row's country, so a
   Lagos-based investor is not called "Wei Kowalski".
6. The public waitlist counter, admin signup stats and facet "total" either
   exclude synthetic rows or report them separately. Do not remove those
   filters to make a demo look bigger.

## Commands

```bash
# Generate + load (idempotent: replaces the batch)
node scripts/demo-data/seed.mjs

# Shape the load
node scripts/demo-data/seed.mjs --investors=100000 --firms=10000 --founders=10000
node scripts/demo-data/seed.mjs --dry-run          # generate, print stats, no writes
node scripts/demo-data/seed.mjs --clear            # remove the batch only
node scripts/demo-data/seed.mjs --investors=5000 --founders=0 --waitlist=false

# Post-load checks (distributions, unsafe emails, facet rollup)
node scripts/demo-data/verify.mjs

# Portable backup of the *organic* corpus (no synthetic rows, no vectors)
node scripts/demo-data/export.mjs [outDir]

# Database size and table breakdown
node scripts/demo-data/db-size.mjs

# Apply a migration (no supabase CLI required)
node scripts/demo-data/apply-sql.mjs supabase/migrations/043_demo_dataset_and_facet_fix.sql
```

## Notes

- The Supabase pooler drops long-lived connections. `seed.mjs` reconnects and
  retries every statement; inserts are `on conflict (id) do nothing`, so a retry
  cannot duplicate a row. A short final count check fails the run loudly rather
  than reporting a partial load.
- Loading ~100k investors takes roughly 6–8 minutes at 250 rows per statement.
- `scripts/demo-data/*.log` is git-ignored output, not data.
