// =============================================
// Advanced investor filters
// =============================================
// Cheque size, thesis, lead/follow and firm name are real columns on
// `investors`, but they are sparse: cheque size exists on 14 rows and thesis
// text on 26 out of ~19k. They are still worth filtering on, so both the list
// endpoint and the Discover endpoint share one parser and one applier — two
// copies would drift and quietly produce different results for the same input.

export interface AdvancedInvestorFilters {
  minCheque: number | null;
  maxCheque: number | null;
  hasThesis: boolean | null;
  leadPreference: "lead" | "co_lead" | "follower" | null;
  firm: string;
}

export const LEAD_PREFERENCES = ["lead", "co_lead", "follower"] as const;

const toPositiveInt = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
};

const toBoolean = (value: unknown): boolean | null => {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return null;
};

/**
 * Normalise filter input from either a query string (list endpoint) or a JSON
 * body (discover endpoint). Unknown values become null rather than an error so
 * a stale URL never breaks the page.
 */
export function parseAdvancedFilters(
  input: Record<string, unknown> | URLSearchParams
): AdvancedInvestorFilters {
  const get = (key: string): unknown => {
    if (input instanceof URLSearchParams) return input.get(key);
    return input[key];
  };

  const lead = String(get("leadPreference") ?? "").trim().toLowerCase();

  return {
    minCheque: toPositiveInt(get("minCheque")),
    maxCheque: toPositiveInt(get("maxCheque")),
    hasThesis: toBoolean(get("hasThesis")),
    leadPreference: (LEAD_PREFERENCES as readonly string[]).includes(lead)
      ? (lead as AdvancedInvestorFilters["leadPreference"])
      : null,
    // PostgREST treats commas and parens as syntax inside .or()/.ilike values,
    // and a firm name from the corpus can contain them ("Smith, Jones & Co").
    firm: String(get("firm") ?? "")
      .replace(/[,()%]/g, " ")
      .trim()
      .slice(0, 80),
  };
}

/**
 * Apply the advanced filters to a Supabase query builder.
 *
 * Cheque semantics, stated plainly so the UI can match:
 *  - minCheque: the investor can write cheques AT LEAST this large
 *    (`max_check_size >= minCheque`).
 *  - maxCheque: the investor's smallest cheque is at most this large
 *    (`min_check_size <= maxCheque`); rows with no minimum recorded cannot
 *    prove that, so they are excluded.
 */
export function applyAdvancedFilters<T>(query: T, filters: AdvancedInvestorFilters): T {
  // Supabase's builder methods are chainable but each returns a new type
  // parameter, so widen locally and hand the result back as T.
  let q: any = query;

  if (filters.minCheque) q = q.gte("max_check_size", filters.minCheque);
  if (filters.maxCheque) q = q.lte("min_check_size", filters.maxCheque);

  if (filters.hasThesis === true) {
    q = q.not("investment_thesis", "is", null).neq("investment_thesis", "");
  } else if (filters.hasThesis === false) {
    q = q.or("investment_thesis.is.null,investment_thesis.eq.");
  }

  if (filters.leadPreference) q = q.eq("lead_preference", filters.leadPreference);

  // This corpus is a list of firms, so the firm's name lives on `full_name`
  // (current_firm_id is unpopulated). Matching full_name is the honest
  // equivalent of "filter by firm" here.
  if (filters.firm) q = q.ilike("full_name", `%${filters.firm}%`);

  return q as T;
}

/** True when at least one advanced filter is active. */
export function hasAdvancedFilters(filters: AdvancedInvestorFilters): boolean {
  return Boolean(
    filters.minCheque ||
      filters.maxCheque ||
      filters.hasThesis !== null ||
      filters.leadPreference ||
      filters.firm
  );
}
