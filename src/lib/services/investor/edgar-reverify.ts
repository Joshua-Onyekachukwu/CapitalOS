/**
 * EDGAR re-verification — scheduled freshness pass (monthly cadence).
 *
 * Filing freshness goes stale: a filer verified 12 months ago may have
 * stopped filing, and SEC-reported SIC codes drift. This pass re-checks the
 * oldest-verified slice of the dataset against data.sec.gov/submissions and:
 *   - refreshes edgar_last_filing_date when a newer 13F-HR exists
 *   - detects SIC description drift and re-maps sector tags — but only
 *     replaces sectors that were themselves SEC-derived (source_provider
 *     'sec_edgar' or null); evidence from other providers is never overwritten
 *   - stamps last_verified_at on every successfully rechecked row
 *   - leaves rows untouched on fetch failure (unknown stays unknown)
 *
 * SEC fair-use: ≤10 req/s — serial fetches paced at ~110ms. Cadence is
 * enforced by the run-horizon check (one run per calendar month).
 * Outcome recorded in background_jobs (job_type 'edgar_reverification').
 */

import { createClient } from "@supabase/supabase-js";
import { sectorTagsForSic } from "./sic-sectors";

const SEC_BASE = "https://data.sec.gov/submissions";
const UA = "CapitalOS-Investor-Intelligence/1.0 (filing-freshness reverification; contact: ops@capital-os.local)";
const RATE_MS = 110;

export interface EdgarReverifySummary {
  status: "completed" | "skipped_recent_run" | "failed";
  targets: number;
  rechecked: number;
  filingsRefreshed: number;
  sicDrift: number;
  sectorsRemapped: number;
  fetchFailures: number;
  error?: string;
}

function sp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function recordJob(outcome: EdgarReverifySummary): Promise<void> {
  try {
    const now = new Date().toISOString();
    await sp().from("background_jobs").insert({
      job_type: "edgar_reverification",
      status: outcome.status === "failed" ? "failed" : "completed",
      priority: 5,
      input: { scheduled: true },
      output: outcome as unknown as Record<string, unknown>,
      error_message: outcome.error || null,
      progress: outcome.targets > 0 ? Math.round((outcome.rechecked / outcome.targets) * 100) : 0,
      started_at: now,
      completed_at: now,
    });
  } catch {
    // observability is best-effort
  }
}

/** Monthly run horizon: skip if a run already happened this calendar month. */
async function ranThisMonth(): Promise<boolean> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count } = await sp()
    .from("background_jobs")
    .select("id", { count: "exact", head: true })
    .eq("job_type", "edgar_reverification")
    .eq("status", "completed")
    .gte("started_at", monthStart.toISOString());
  return (count || 0) > 0;
}

interface SecSubmissions {
  sic?: string;
  sicDescription?: string;
  filings?: {
    recent?: {
      form?: string[];
      filingDate?: string[];
    };
  };
}

interface SecInfo {
  latest13F: string | null;
  sic: string | null;
  sicDescription: string | null;
}

/** One fetch per CIK: 13F-HR freshness + entity SIC (drift detection). */
async function fetchSecInfo(cik10: string): Promise<SecInfo> {
  const res = await fetch(`${SEC_BASE}/CIK${cik10}.json`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw Object.assign(new Error(`sec ${res.status}`), { code: res.status });
  const data = (await res.json()) as SecSubmissions;
  const recent = data.filings?.recent;
  let latest13F: string | null = null;
  if (recent?.form && recent?.filingDate) {
    for (let i = 0; i < Math.min(recent.form.length, recent.filingDate.length); i++) {
      if (recent.form[i] === "13F-HR") {
        latest13F = recent.filingDate[i]; // filings are newest-first
        break;
      }
    }
  }
  return { latest13F, sic: data.sic || null, sicDescription: data.sicDescription || null };
}

export async function runEdgarReverification(opts?: { limit?: number; dryRun?: boolean; force?: boolean; userId?: string }): Promise<EdgarReverifySummary> {
  const summary: EdgarReverifySummary = {
    status: "completed", targets: 0, rechecked: 0, filingsRefreshed: 0,
    sicDrift: 0, sectorsRemapped: 0, fetchFailures: 0,
  };

  if (!opts?.force && (await ranThisMonth())) {
    summary.status = "skipped_recent_run";
    await recordJob(summary);
    return summary;
  }

  const db = sp();
  const limit = Math.min(500, Math.max(1, opts?.limit ?? 300));

  // Oldest-verified verified filers first — freshest evidence gets rebuilt
  // where it has decayed the most.
  const { data: targets, error } = await db
    .from("investors")
    .select("id, source_id, edgar_last_filing_date, edgar_sic_code, edgar_sic_description, investment_sectors, source_provider")
    .eq("is_active", true)
    .eq("verification_status", "verified")
    .not("source_id", "is", null)
    .order("last_verified_at", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) {
    summary.status = "failed";
    summary.error = `target query: ${error.message}`;
    await recordJob(summary);
    return summary;
  }

  summary.targets = targets?.length || 0;

  for (const row of targets || []) {
    const cik = String(row.source_id || "").replace(/\D/g, "").padStart(10, "0");
    if (cik.length !== 10 || /^0+$/.test(cik)) continue;

    try {
      const info = await fetchSecInfo(cik);
      const update: Record<string, unknown> = { last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() };

      // Filing freshness
      if (info.latest13F && info.latest13F > (row.edgar_last_filing_date || "")) {
        update.edgar_last_filing_date = info.latest13F;
        summary.filingsRefreshed++;
      }

      // SIC drift: SEC reports a different industry than we stored
      if (
        info.sicDescription &&
        row.edgar_sic_description &&
        info.sicDescription.trim().toLowerCase().replace(/\s+/g, " ") !==
          row.edgar_sic_description.trim().toLowerCase().replace(/\s+/g, " ")
      ) {
        summary.sicDrift++;
        update.edgar_sic_code = info.sic;
        update.edgar_sic_description = info.sicDescription;

        // Re-map sectors only when the current tags are themselves SEC-derived
        // (or empty) — evidence from other providers is never overwritten.
        if (row.source_provider === null || row.source_provider === "sec_edgar") {
          const newTags = sectorTagsForSic(info.sicDescription);
          const cur = Array.isArray(row.investment_sectors) ? row.investment_sectors : [];
          if (newTags.length > 0 && JSON.stringify(newTags) !== JSON.stringify(cur)) {
            update.investment_sectors = newTags;
            summary.sectorsRemapped++;
          }
        }
      }

      if (info.latest13F || info.sicDescription) {
        summary.rechecked++;
        if (!opts?.dryRun) await db.from("investors").update(update).eq("id", row.id);
      }
    } catch (err) {
      // Leave the row untouched on failure — unknown stays unknown.
      summary.fetchFailures++;
      const code = (err as { code?: number }).code;
      if (code === 404 || code === 403) {
        console.warn(`[edgar-reverify] CIK ${cik} fetch ${code}`);
      }
    }

    await new Promise((r) => setTimeout(r, RATE_MS));
  }

  await recordJob(summary);
  if (opts?.userId) {
    const { logAdminAction } = await import("@/lib/services/admin/audit");
    logAdminAction({
      userId: opts.userId,
      action: "edgar_reverification_run",
      entityType: "investor",
      details: summary as unknown as Record<string, unknown>,
    });
  }
  return summary;
}
