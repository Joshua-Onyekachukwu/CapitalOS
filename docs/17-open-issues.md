# Capital OS — Open Issues & Risks

## Known Issues

### I001 — Migration 004 Not Yet Applied to Production
**Severity:** High
**Status:** Ready to apply
**Description:** Migration 004 (company_profiles, billing tables) has been created and committed but not yet run in Supabase SQL Editor. The onboarding flow and billing system depend on these tables.
**Resolution:** User needs to paste migration SQL into Supabase SQL Editor and execute.

### I002 — Startup Profile Page Shows Hardcoded Data
**Severity:** Medium
**Status:** Shell exists
**Description:** The `/dashboard/startup` page has hardcoded profile sections with `done: false`. It needs to connect to the `company_profiles` table once migration 004 is applied.
**Resolution:** Connect to real company profile data after migration 004 is applied.

### I003 — Documents Page Has No Upload Backend
**Severity:** Medium
**Status:** Shell exists
**Description:** The `/dashboard/documents` page has a drag-and-drop UI but no file upload implementation. Needs Supabase Storage integration.
**Resolution:** Implement file upload to Supabase Storage, link to `company_documents` table.

### I004 — Analytics Page Shows Empty Metrics
**Severity:** Low
**Status:** Shell exists
**Description:** The `/dashboard/analytics` page shows hardcoded empty metrics. Needs real data from email_messages, campaigns, and pipeline.
**Resolution:** Build analytics queries after email and campaign data accumulates.

### I005 — Meetings Page Has No Implementation
**Severity:** Low
**Status:** Shell exists
**Description:** The `/dashboard/meetings` page exists but has no functionality.
**Resolution:** Build meeting scheduling in a future phase.

### I006 — AI Activity Page Not Connected
**Severity:** Low
**Status:** Shell exists
**Description:** The `/dashboard/ai-activity` page exists but is not connected to the credit ledger.
**Resolution:** Connect to `credit_ledger` table to show AI usage history.

## Technical Debt

### T001 — Duplicate Column Mapping Code
**Severity:** Low
**Description:** `COLUMN_MAP` is defined identically in both `csv-import.ts` and `ingestion.ts`. Should be shared.
**Resolution:** Extract to a shared module.

### T002 — Client-Side Supabase in Some Pages
**Severity:** Low
**Description:** Some pages (Outreach, Campaigns) use client-side Supabase (`createClient()` from `@/lib/supabase/client`) for data fetching. This works but bypasses RLS policy evaluation that happens server-side.
**Resolution:** Migrate to server actions or API routes for consistency.

### T003 — No Error Boundaries
**Severity:** Medium
**Description:** No React error boundaries are implemented. Client-side errors will show a white screen.
**Resolution:** Add error boundaries around major layout sections.

### T004 — No Loading States for All Pages
**Severity:** Low
**Description:** Some pages have loading states, others don't. Inconsistent UX.
**Resolution:** Add skeleton loading states to all data-dependent pages.

## Security Risks

### S001 — No Rate Limiting on API Routes
**Severity:** Medium
**Description:** API routes do not have explicit rate limiting. Could be abused for AI credit drain.
**Resolution:** Add rate limiting middleware (e.g., upstash/ratelimit).

### S002 — No CSRF Protection
**Severity:** Low
**Description:** No explicit CSRF token validation on mutation endpoints.
**Resolution:** Supabase Auth cookies provide some protection. Consider adding CSRF tokens for extra safety.

## Performance Concerns

### P001 — Large CSV Import May Timeout
**Severity:** Medium
**Description:** Importing 10K+ records via CSV may timeout on Vercel's serverless functions (30s limit for hobby plan).
**Resolution:** Implement background job processing or use Vercel's extended timeout.

### P002 — Investor Search Uses ilike Instead of Full-Text
**Severity:** Low
**Description:** Current investor search uses `ilike` patterns instead of PostgreSQL tsvector full-text search. Slower at scale.
**Resolution:** Add tsvector column and GIN index for full-text search.

## AI Reliability

### A001 — AI Responses May Be Inconsistent
**Severity:** Medium
**Description:** LLM responses are non-deterministic. Same input may produce different outputs.
**Resolution:** Acceptable for drafting/research. Critical operations use deterministic logic.

### A002 — AI May Generate Inaccurate Information
**Severity:** Medium
**Description:** AI research summaries and email drafts may contain inaccuracies.
**Resolution:** Always show "AI-generated" label. Founder reviews before using. Never auto-send.

## Unresolved Decisions

### U001 — Background Job Processing
**Status:** Not decided
**Description:** For large-scale operations (100K+ imports, batch enrichment), we need a background job system. Options: Supabase Edge Functions, custom worker, Inngest, Trigger.dev.
**Resolution:** Defer until needed.

### U002 — pgvector for Semantic Search
**Status:** Not decided
**Description:** Whether to use pgvector for semantic investor search (embedding-based similarity).
**Resolution:** Defer until traditional search proves insufficient.

### U003 — Multi-Language Support
**Status:** Not decided
**Description:** Whether to support multiple languages in the UI and AI responses.
**Resolution:** Defer until international user base grows.

---

*Last updated: August 22, 2026*
