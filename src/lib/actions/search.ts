"use server";

import { createClient } from "@/lib/supabase/server";

// =============================================
// Types
// =============================================

export interface SearchFilters {
  query?: string;
  investorType?: string;
  stages?: string[];
  sectors?: string[];
  geographies?: string[];
  country?: string;
  minFitScore?: number;
  maxFitScore?: number;
  outreachReadiness?: string;
  isVerified?: boolean;
  hasEmail?: boolean;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  investors: Array<{
    id: string;
    full_name: string;
    email: string | null;
    linkedin_url: string | null;
    job_title: string | null;
    investor_type: string;
    fit_score: number;
    data_quality_score: number;
    outreach_readiness: string;
    is_verified: boolean;
    country: string | null;
    city: string | null;
    firm_name: string | null;
    investment_stages: string[];
    investment_sectors: string[];
    created_at: string;
  }>;
  total: number;
  hasMore: boolean;
}

// =============================================
// Search Investors
// =============================================

export async function searchInvestors(
  filters: SearchFilters
): Promise<SearchResult> {
  const supabase = await createClient();
  const limit = filters.limit || 25;
  const offset = filters.offset || 0;

  // Start with the view that joins firms
  let query = supabase
    .from("v_investors_with_firms")
    .select(`
      id, full_name, email, linkedin_url, job_title,
      investor_type, fit_score, data_quality_score,
      outreach_readiness, is_verified, country, city,
      firm_name, investment_stages, investment_sectors,
      created_at
    `, { count: "exact" });

  // Text search — prefer tsvector, fall back to ilike
  if (filters.query) {
    const q = filters.query;
    // Try tsvector search first (will work after migration 006)
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,firm_name.ilike.%${q}%,job_title.ilike.%${q}%,location.ilike.%${q}%`);
  }

  // Investor type
  if (filters.investorType) {
    query = query.eq("investor_type", filters.investorType);
  }

  // Stages (array overlap)
  if (filters.stages && filters.stages.length > 0) {
    query = query.overlaps("investment_stages", filters.stages);
  }

  // Sectors (array overlap)
  if (filters.sectors && filters.sectors.length > 0) {
    query = query.overlaps("investment_sectors", filters.sectors);
  }

  // Country
  if (filters.country) {
    query = query.ilike("country", `%${filters.country}%`);
  }

  // Fit score range
  if (filters.minFitScore !== undefined) {
    query = query.gte("fit_score", filters.minFitScore);
  }
  if (filters.maxFitScore !== undefined) {
    query = query.lte("fit_score", filters.maxFitScore);
  }

  // Outreach readiness
  if (filters.outreachReadiness) {
    query = query.eq("outreach_readiness", filters.outreachReadiness);
  }

  // Verified only
  if (filters.isVerified) {
    query = query.eq("is_verified", true);
  }

  // Has email
  if (filters.hasEmail) {
    query = query.not("email", "is", null);
  }

  // Sorting
  const sortField = filters.sortBy || "fit_score";
  const sortDir = filters.sortDirection || "desc";
  query = query.order(sortField, { ascending: sortDir === "asc" });

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error("Search error:", error);
    return { investors: [], total: 0, hasMore: false };
  }

  return {
    investors: data || [],
    total: count || 0,
    hasMore: (count || 0) > offset + limit,
  };
}

// =============================================
// Get Filter Options (for dropdowns)
// =============================================

export async function getFilterOptions() {
  const supabase = await createClient();

  const [typesResult, sectorsResult] = await Promise.all([
    supabase.from("investors").select("investor_type").eq("is_active", true),
    supabase.from("investor_sectors").select("name, slug").eq("is_active", true),
  ]);

  const types = [...new Set((typesResult.data || []).map((r) => r.investor_type))].sort();
  const sectors = (sectorsResult.data || []).map((s) => ({ name: s.name, slug: s.slug }));

  return {
    investorTypes: types,
    stages: [
      { label: "Pre-Seed", value: "pre_seed" },
      { label: "Seed", value: "seed" },
      { label: "Series A", value: "series_a" },
      { label: "Series B", value: "series_b" },
      { label: "Series C", value: "series_c" },
      { label: "Growth", value: "growth" },
    ],
    sectors,
    readiness: [
      { label: "Ready", value: "ready" },
      { label: "Needs Verification", value: "needs_verification" },
      { label: "Not Ready", value: "not_ready" },
      { label: "Contacted", value: "contacted" },
      { label: "Do Not Contact", value: "do_not_contact" },
    ],
  };
}
