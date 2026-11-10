// =============================================
// Saved-search alert matcher
// =============================================
// A saved filter is a standing question ("seed AI in the US with an email").
// This service answers it against the current corpus and records an alert when
// the answer grew since the filter was last checked.
//
// Honest limits, which the UI repeats:
//  * "New" means rows whose `created_at` is after the filter's last check. If
//    the corpus is never imported into, there will be no new matches — an empty
//    alert list is the truth, not a failure.
//  * Matching uses exactly the list endpoint's predicates (shared module), so a
//    match count here is the same number the database page would show.

import { getServiceClient } from "@/lib/supabase/service";
import { applyInvestorFilters, filtersFromRecord } from "@/lib/services/investors/query";

const FIRST_LOOKBACK_DAYS = 30;
const THROTTLE_MS = 5 * 60 * 1000;

export interface SearchAlert {
  id: string;
  savedFilterId: string | null;
  filterName: string;
  filters: Record<string, unknown>;
  matchedCount: number;
  sampleInvestorIds: string[];
  createdAt: string;
  readAt: string | null;
}

function parseFilters(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

export async function evaluateSavedFilters(
  userId: string,
  options: { force?: boolean } = {}
): Promise<{ checked: number; created: number; skipped: boolean }> {
  const sp = getServiceClient();

  const { data: saved, error } = await sp
    .from("saved_filters")
    .select("id, name, filters, last_checked_at")
    .eq("user_id", userId)
    .eq("page_name", "investors");
  if (error) throw error;

  const filters = saved ?? [];
  if (filters.length === 0) return { checked: 0, created: 0, skipped: false };

  // Throttle: opening the bell repeatedly must not re-scan the corpus.
  if (!options.force) {
    const newest = filters.reduce((latest, f) => {
      const t = f.last_checked_at ? new Date(f.last_checked_at as string).getTime() : 0;
      return Math.max(latest, t);
    }, 0);
    if (newest && Date.now() - newest < THROTTLE_MS) {
      return { checked: 0, created: 0, skipped: true };
    }
  }

  let created = 0;

  for (const filter of filters) {
    const checkedAt = new Date();
    const windowStart =
      filter.last_checked_at !== null && filter.last_checked_at !== undefined
        ? new Date(filter.last_checked_at as string)
        : new Date(checkedAt.getTime() - FIRST_LOOKBACK_DAYS * 86_400_000);

    const raw = parseFilters(filter.filters);
    const query = filtersFromRecord(raw);

    const { count, error: countError } = await applyInvestorFilters(
      sp.from("investors").select("id", { count: "exact", head: true }),
      query
    ).gt("created_at", windowStart.toISOString());

    // A failed count for one filter must not abort the others.
    if (countError) {
      console.error("[search-alerts] count failed:", countError.message);
      continue;
    }

    if ((count ?? 0) > 0) {
      const { data: sample } = await applyInvestorFilters(sp.from("investors").select("id"), query)
        .gt("created_at", windowStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(5);

      const { error: insertError } = await sp.from("search_alerts").insert({
        user_id: userId,
        saved_filter_id: filter.id,
        filter_name: filter.name,
        filters: raw,
        matched_count: count ?? 0,
        sample_investor_ids: (sample ?? []).map((s) => s.id),
      });

      if (insertError) {
        console.error("[search-alerts] insert failed:", insertError.message);
        continue;
      }
      created += 1;
    }

    await sp
      .from("saved_filters")
      .update({ last_checked_at: checkedAt.toISOString() })
      .eq("id", filter.id)
      .eq("user_id", userId);
  }

  return { checked: filters.length, created, skipped: false };
}

export async function listAlerts(userId: string, limit = 20): Promise<SearchAlert[]> {
  const sp = getServiceClient();
  const { data, error } = await sp
    .from("search_alerts")
    .select(
      "id, saved_filter_id, filter_name, filters, matched_count, sample_investor_ids, created_at, read_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    savedFilterId: (row.saved_filter_id as string | null) ?? null,
    filterName: row.filter_name as string,
    filters: parseFilters(row.filters),
    matchedCount: Number(row.matched_count ?? 0),
    sampleInvestorIds: ((row.sample_investor_ids as string[] | null) ?? []).filter(Boolean),
    createdAt: row.created_at as string,
    readAt: (row.read_at as string | null) ?? null,
  }));
}
