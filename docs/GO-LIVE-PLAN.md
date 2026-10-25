# First Outreach Campaign — Week-by-Week Go-Live Plan

From your Apollo CSV to the first sent email, using only what exists in the
system today. Dates assume you start the day after this plan is written.

## Week 0 — Provision keys (Day 1–2, blocking everything else)

| Key | Where | Cost | Used for |
|---|---|---|---|
| Gmail App Password (16 chars) | https://myaccount.google.com/apppasswords | Free | Supabase Auth SMTP + global outreach sender |
| Valid Apollo API key | https://app.apollo.io → Settings → API (current key returns 401) | Free tier OK | Contact enrichment: employee counts + company domains |
| ZeroBounce API key | https://www.zerobounce.net | Pay-per-verify (~$0.008) | `--verify` flag on the contacts pipeline |

Supabase Auth SMTP: enable Custom SMTP in the dashboard and paste the values
printed by `node scripts/auth-smtp-values.js`. Steps:
[docs/AUTH-SMTP-SETUP.md](AUTH-SMTP-SETUP.md). Then run
`node scripts/auth-smtp-values.js --verify` — the reset email must arrive
before any campaign work.

Vercel (outreach sender): add `SMTP_PASS=<same app password>` to Production +
Preview. Note: your current Gmail sender caps at ~500 recipients/day and is
penny-wise for cold outreach — acceptable for the first campaign only.

## Week 1 — Import + dedupe + warmup starts (Days 3–9)

### Day 3 — Run the contacts pipeline on your Apollo CSV

```bash
# Preview: filtering, tier drops, employee counts — no writes, no API cost
node scripts/apollo-contacts-pipeline.js --input data/your-apollo-export.csv --dry-run

# Live: writes accepted/rejected CSVs, infers domains and email candidates
node scripts/apollo-contacts-pipeline.js --input data/your-apollo-export.csv
```

Review `data-backups/apollo-contacts/accepted-<date>.csv` before importing.
Default behavior drops Entry/Intern titles and companies ≥10 employees
(`--max-employees 10`). Re-run with different thresholds if needed.

### Day 3–4 — Verify emails (pay-per-verify, budget-capped)

```bash
node scripts/apollo-contacts-pipeline.js --input data/your-apollo-export.csv \
  --verify --verify-budget 500 --verify-only
```

Cost at 500 verifications: ~$4. Keep only deliverable emails
(`--verify-only`). If you want a free smoke test first: `--verify-smtp`
(MX + RCPT TO probe, best-effort, no cost).

### Day 5 — Stage into the database

```bash
node scripts/apollo-contacts-pipeline.js --input data/your-apollo-export.csv \
  --verify --verify-budget 500 --verify-only --stage-records
npx tsx src/scripts/process-raw-records.ts 500 --provider=apollo-contacts
```

Check what landed:

```sql
SELECT status, count(*) FROM raw_records
WHERE source_provider='apollo-contacts' GROUP BY status;
```

### Day 5 — Start domain warmup (non-negotiable, runs in background)

In the app: Settings → Email → connect your sender account → start warmup.
The engine ramps automatically (5 → 8 → 12 → 18 → 25 → 35 emails/day over
6 stages). Do NOT skip: sending cold without warmup burns the domain.

## Week 2 — Seed the pipeline (Days 10–16)

- Review the accepted CSV investors in Discover; move real targets into
  Qualified/Outreach (Kanban verified working against prod data).
- Save your first target list (25–50 investors max — small beats big for
  deliverability).
- Create the campaign → generate the 3-step sequence with AI → review every
  draft (AI is slow, ~100s/email; edit before approving).
- Enroll investors. Enrollments start `scheduled`; a reply auto-pauses the
  sequence (stop-on-reply) and stores an AI-classified interest level plus a
  suggested draft.

## Week 3 — First sends (Days 17–23)

- Warmup is ~2 weeks in; daily cap is fine for a 25–50 person batch.
- Use the sequence execute endpoint (or the Outreach page) to send step 1.
- Watch Email Health daily: bounces → suppress, complaints → critical alert.
- Track opens/replies in Analytics; reply insights appear per thread.

## Week 4 — Iterate (Days 24–30)

- A/B one variable (subject line or first line), not five.
- If reply rate < 5%: fix targeting before copy.
- Scale +25 investors/week only while health score stays green.

## Standing rules

1. Never buy a scraped "verified" list — the pipeline exists so you don't have to.
2. Every cold email needs: real name, real company, real reason, one CTA.
3. Bounce rate above 3% → stop sending, re-verify, resume.
4. Weekly: export campaign metrics, review reply insights, prune the list.
