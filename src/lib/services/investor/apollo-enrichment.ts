/**
 * Apollo enrichment pass — scheduled, conservative, evidence-backed.
 *
 * Matches existing SEC-filer investor rows against Apollo organizations by
 * canonical name, and only where the match is unambiguous fills:
 *   - investment_sectors (from Apollo industry/keywords) — when currently empty
 *   - website_url (Apollo primary_domain) — when currently null
 *   - email (senior investment-team contact via people/search) — when null
 *
 * Rules carried over from the EDGAR pass:
 *   - Unknown stays unknown: no match, no write; ambiguous matches are logged.
 *   - Every write is stamped source_provider='apollo', verification_status,
 *     last_verified_at — provenance is queryable.
 *   - Rate-limited serial fetches (150ms) and a hard per-run limit so a
 *     weekly schedule never burns a credit budget in one go.
 *   - Job outcome is recorded in background_jobs so the admin intelligence
 *     dashboard shows real scheduled-run history.
 */

import { createClient } from "@supabase/supabase-js";
import { logAdminAction } from "@/lib/services/admin/audit";

const APOLLO_BASE_URL = process.env.APOLLO_BASE_URL || "https://api.apollo.io/v1";
const RATE_MS = 150;

export interface ApolloRunSummary {
  status: "completed" | "not_configured" | "key_invalid" | "failed";
  targets: number;
  matched: number;
  ambiguous: number;
  emailsFound: number;
  sectorsFilled: number;
  websitesFilled: number;
  /** Cost accounting (see CREDIT_COSTS) */
  apiCalls: { orgSearch: number; peopleSearch: number };
  estimatedCredits: number;
  /** Dedup guard: emails skipped because another active row already owns them */
  emailConflicts: number;
  error?: string;
}

/**
 * Credit accounting per Apollo endpoint (documented plan assumptions —
 * organizations/search name-matching is free on every plan; people/search
 * may consume plan credits on every call depending on plan terms).
 * estimatedCredits is a deliberate upper bound, never an undercount.
 */
const CREDIT_COSTS = { orgSearch: 0, peopleSearch: 1 } as const;

function sp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function apolloPost<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${APOLLO_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": process.env.APOLLO_API_KEY || "",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw Object.assign(new Error("key_invalid"), { code: 401 });
  if (res.status === 403) throw Object.assign(new Error("plan_forbidden"), { code: 403 });
  if (res.status === 429) throw Object.assign(new Error("rate_limited"), { code: 429 });
  if (!res.ok) throw new Error(`apollo ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return res.json() as Promise<T>;
}

/** Token-overlap similarity on canonical names (Jaccard). */
function nameSimilarity(a: string, b: string): number {
  const ta = new Set(a.split(/\s+/).filter(Boolean));
  const tb = new Set(b.split(/\s+/).filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

const norm = (s: string) =>
  (s || "").trim().toLowerCase().replace(/\s+/g, " ")
    .replace(/\s*,?\s*(l\.?l\.?c\.?|l\.?l\.?p\.?|inc\.?|ltd\.?|limited|lp|plc|corp\.?|corporation|co\.?|company|gmbh|sas)$/i, "")
    .trim();

async function recordJob(outcome: ApolloRunSummary): Promise<void> {
  try {
    const now = new Date().toISOString();
    await sp().from("background_jobs").insert({
      job_type: "apollo_enrichment",
      status: outcome.status === "completed" ? "completed" : "failed",
      priority: 5,
      input: { scheduled: true },
      output: outcome as unknown as Record<string, unknown>,
      error_message: outcome.error || null,
      progress: outcome.targets > 0 ? Math.round(((outcome.matched) / outcome.targets) * 100) : 0,
      started_at: now,
      completed_at: now,
    });
  } catch {
    // observability is best-effort
  }
}

export async function runApolloEnrichment(opts?: { limit?: number; dryRun?: boolean; userId?: string }): Promise<ApolloRunSummary> {
  const limit = Math.min(500, Math.max(1, opts?.limit ?? 400));
  const summary: ApolloRunSummary = {
    status: "completed", targets: 0, matched: 0, ambiguous: 0,
    emailsFound: 0, sectorsFilled: 0, websitesFilled: 0,
    apiCalls: { orgSearch: 0, peopleSearch: 0 },
    estimatedCredits: 0,
    emailConflicts: 0,
  };

  if (!process.env.APOLLO_API_KEY) {
    summary.status = "not_configured";
    summary.error = "APOLLO_API_KEY is not set — scheduled run skipped";
    await recordJob(summary);
    return summary;
  }

  const db = sp();

  // Targets: active firms with no email (the outreach blocker), most-recent
  // SEC activity first. Already-enriched rows are never re-fetched.
  const { data: targets, error } = await db
    .from("investors")
    .select("id, full_name, name_normalized, email, website_url, investment_sectors, qualification_notes")
    .eq("is_active", true)
    .is("email", null)
    .order("edgar_last_filing_date", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) {
    summary.status = "failed";
    summary.error = `target query: ${error.message}`;
    await recordJob(summary);
    return summary;
  }
  summary.targets = targets?.length || 0;
  if (!targets?.length) {
    await recordJob(summary);
    return summary;
  }

  for (const row of targets) {
    try {
      // 1) Find the firm on Apollo by canonical name
      const search = await apolloPost<{ organizations?: Array<Record<string, unknown>> }>(
        "/organizations/search",
        { q_organization_name: row.full_name, page: 1, per_page: 3 }
      );
      summary.apiCalls.orgSearch++;
      const orgs = search.organizations || [];
      const best = orgs
        .map((o) => ({ o, sim: nameSimilarity(row.name_normalized || norm(row.full_name), norm(String(o.name || ""))) }))
        .sort((a, b) => b.sim - a.sim)[0];

      // Conservative match: ≥0.85 token overlap, else skip (ambiguous)
      if (!best || best.sim < 0.85) {
        summary.ambiguous++;
      } else {
        const org = best.o;
        const update: Record<string, unknown> = {
          source_provider: "apollo",
          verification_status: "verified",
          last_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // 2) Website from Apollo's primary domain (when we have none)
        const domain = org.primary_domain ? String(org.primary_domain) : null;
        if (!row.website_url && domain) {
          update.website_url = `https://${domain}`;
          summary.websitesFilled++;
        }

        // 3) Sectors from Apollo industry + keywords — only into empty arrays
        const curSectors = Array.isArray(row.investment_sectors) ? row.investment_sectors : [];
        if (curSectors.length === 0) {
          const raw = [String(org.industry || ""), ...((org.keywords as string[]) || [])]
            .map((s) => s.trim().toLowerCase()).filter(Boolean);
          const sectors = [...new Set(raw)].slice(0, 6);
          if (sectors.length > 0) {
            update.investment_sectors = sectors;
            summary.sectorsFilled++;
          }
        }

        // 4) Senior investment-team contact email (people/search; Pro plan).
        // A 403 here means plan lacks people search — degrade gracefully.
        if (domain) {
          try {
            const people = await apolloPost<{ people?: Array<Record<string, unknown>> }>(
              "/people/search",
              {
                organization_domains: [domain],
                person_titles: ["Managing Partner", "General Partner", "Partner"],
                page: 1, per_page: 1,
              }
            );
            summary.apiCalls.peopleSearch++;
            summary.estimatedCredits += CREDIT_COSTS.peopleSearch;
            const person = people.people?.[0];
            const email = person?.email ? String(person.email) : null;
            if (email && !row.email) {
              // Dedup guard: never write a contact another active row already
              // owns — enrichment must not create the duplicates we just merged.
              const { data: clash } = await db
                .from("investors")
                .select("id")
                .eq("email", email)
                .neq("id", row.id)
                .eq("is_active", true)
                .limit(1);
              if (clash && clash.length > 0) {
                summary.emailConflicts++;
              } else {
                update.email = email;
                update.job_title = person?.title ? String(person.title) : null;
                summary.emailsFound++;
              }
            }
          } catch (err) {
            if ((err as { code?: number }).code === 403) {
              summary.error = summary.error || "people/search not available on current Apollo plan";
            } else if ((err as { code?: number }).code !== 429) {
              throw err;
            }
          }
        }

        // Provenance note appended (never overwrite admin notes)
        const note = `\n[apollo ${new Date().toISOString().slice(0, 10)}] matched "${org.name}" (sim ${best.sim.toFixed(2)}); industry=${String(org.industry || "n/a")}`;
        update.qualification_notes = ((row.qualification_notes || "") + note).trim();

        if (!opts?.dryRun) await db.from("investors").update(update).eq("id", row.id);
        summary.matched++;
      }
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 401) {
        summary.status = "key_invalid";
        summary.error = "Apollo rejected the API key (401) — obtain a valid key (Pro plan) and set APOLLO_API_KEY";
        break; // every subsequent call would fail the same way
      }
      if (code === 429) {
        await new Promise((r) => setTimeout(r, 30_000));
        continue;
      }
      summary.error = summary.error || String((err as Error).message).slice(0, 200);
    }
    await new Promise((r) => setTimeout(r, RATE_MS));
  }

  await recordJob(summary);
  if (opts?.userId) {
    logAdminAction({
      userId: opts.userId,
      action: "apollo_enrichment_run",
      entityType: "investor",
      details: summary as unknown as Record<string, unknown>,
    });
  }
  return summary;
}
