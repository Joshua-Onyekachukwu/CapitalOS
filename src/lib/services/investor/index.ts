// =============================================
// Investor Service
// =============================================

import { createClient } from "@/lib/supabase/server";
import type { NormalizedInvestor } from "./normalization";

// =============================================
// Types
// =============================================

export interface Investor {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  job_title: string | null;
  bio: string | null;
  location: string | null;
  country: string | null;
  city: string | null;
  investor_type: string;
  current_firm_id: string | null;
  investment_stages: string[];
  investment_sectors: string[];
  investment_geographies: string[];
  min_check_size: number | null;
  max_check_size: number | null;
  currency: string;
  investment_thesis: string | null;
  portfolio_count: number;
  website_url: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_verified: boolean;
  do_not_contact: boolean;
  outreach_readiness: string;
  data_quality_score: number;
  fit_score: number;
  last_investment_date: string | null;
  recent_investment_count: number;
  source: string | null;
  source_id: string | null;
  source_provider: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  firm_name?: string;
  firm_website?: string;
}

export interface InvestorFirm {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  linkedin_url: string | null;
  description: string | null;
  firm_type: string;
  headquarters: string | null;
  country: string | null;
  investment_stages: string[];
  investment_sectors: string[];
  investment_geographies: string[];
  min_check_size: number | null;
  max_check_size: number | null;
  fund_size: number | null;
  founded_year: number | null;
  portfolio_count: number;
  is_active: boolean;
  source: string | null;
  source_id: string | null;
  data_quality_score: number;
  created_at: string;
  updated_at: string;
}

export interface SearchFilters {
  query?: string;
  sectors?: string[];
  stages?: string[];
  geographies?: string[];
  investorTypes?: string[];
  minCheckSize?: number;
  maxCheckSize?: number;
  isActive?: boolean;
  isVerified?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  investors: Investor[];
  total: number;
  limit: number;
  offset: number;
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

  let query = supabase
    .from("v_investors_with_firms")
    .select("*", { count: "exact" })
    .eq("is_active", true);

  // Text search
  if (filters.query) {
    query = query.or(
      `full_name.ilike.%${filters.query}%,email.ilike.%${filters.query}%,job_title.ilike.%${filters.query}%,firm_name.ilike.%${filters.query}%`
    );
  }

  // Sector filter
  if (filters.sectors?.length) {
    query = query.overlaps("investment_sectors", filters.sectors);
  }

  // Stage filter
  if (filters.stages?.length) {
    query = query.overlaps("investment_stages", filters.stages);
  }

  // Geography filter
  if (filters.geographies?.length) {
    query = query.overlaps("investment_geographies", filters.geographies);
  }

  // Investor type filter
  if (filters.investorTypes?.length) {
    query = query.in("investor_type", filters.investorTypes);
  }

  // Check size filters
  if (filters.minCheckSize) {
    query = query.gte("max_check_size", filters.minCheckSize);
  }
  if (filters.maxCheckSize) {
    query = query.lte("min_check_size", filters.maxCheckSize);
  }

  // Active/Verified
  if (filters.isActive !== undefined) {
    query = query.eq("is_active", filters.isActive);
  }
  if (filters.isVerified !== undefined) {
    query = query.eq("is_verified", filters.isVerified);
  }

  // Pagination
  query = query
    .order("fit_score", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    throw new Error(`Search failed: ${error.message}`);
  }

  return {
    investors: (data as Investor[]) || [],
    total: count || 0,
    limit,
    offset,
  };
}

// =============================================
// Get Single Investor
// =============================================

export async function getInvestor(id: string): Promise<Investor | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_investors_with_firms")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as Investor;
}

// =============================================
// Upsert Normalized Investor
// =============================================

export async function upsertInvestor(
  investor: NormalizedInvestor
): Promise<string | null> {
  const supabase = await createClient();

  // Check for existing by email or LinkedIn
  let existingId: string | null = null;

  if (investor.email) {
    const { data } = await supabase
      .from("investors")
      .select("id")
      .eq("email", investor.email)
      .single();
    if (data) existingId = data.id;
  }

  if (!existingId && investor.linkedinUrl) {
    const { data } = await supabase
      .from("investors")
      .select("id")
      .eq("linkedin_url", investor.linkedinUrl)
      .single();
    if (data) existingId = data.id;
  }

  const record = {
    full_name: investor.fullName,
    first_name: investor.firstName,
    last_name: investor.lastName,
    email: investor.email,
    phone: investor.phone,
    linkedin_url: investor.linkedinUrl,
    job_title: investor.jobTitle,
    bio: investor.bio,
    location: investor.location,
    country: investor.country,
    city: investor.city,
    investor_type: investor.investorType,
    investment_stages: investor.investmentStages,
    investment_sectors: investor.investmentSectors,
    investment_geographies: investor.investmentGeographies,
    min_check_size: investor.minCheckSize,
    max_check_size: investor.maxCheckSize,
    currency: investor.currency,
    portfolio_count: investor.portfolioCount,
    website_url: investor.websiteUrl,
    avatar_url: investor.avatarUrl,
    source: investor.source,
    source_id: investor.sourceId,
    source_provider: investor.source,
    data_quality_score: investor.email ? 40 : 20,
  };

  if (existingId) {
    const { error } = await supabase
      .from("investors")
      .update(record)
      .eq("id", existingId);

    if (error) throw new Error(`Update failed: ${error.message}`);
    return existingId;
  } else {
    const { data, error } = await supabase
      .from("investors")
      .insert(record)
      .select("id")
      .single();

    if (error) throw new Error(`Insert failed: ${error.message}`);
    return data?.id || null;
  }
}

// =============================================
// Get All Firms
// =============================================

export async function getInvestorFirms(
  limit = 50,
  offset = 0
): Promise<{ firms: InvestorFirm[]; total: number }> {
  const supabase = await createClient();

  const { data, count, error } = await supabase
    .from("investor_firms")
    .select("*", { count: "exact" })
    .eq("is_active", true)
    .order("name")
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Query failed: ${error.message}`);

  return {
    firms: (data as InvestorFirm[]) || [],
    total: count || 0,
  };
}

// =============================================
// Get Investor Sectors
// =============================================

export async function getInvestorSectors(): Promise<
  { id: string; name: string; slug: string }[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("investor_sectors")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(`Query failed: ${error.message}`);
  return data || [];
}

// =============================================
// Get Provider Usage
// =============================================

export async function getProviderUsage(): Promise<
  {
    name: string;
    display_name: string;
    status: string;
    total_credits: number;
    credits_used: number;
    credits_remaining: number;
    usage_percentage: number;
    annual_cost: number;
    health_status: string;
  }[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_provider_usage")
    .select("*");

  if (error) throw new Error(`Query failed: ${error.message}`);
  return data || [];
}

// =============================================
// Get Acquisition Jobs
// =============================================

export async function getAcquisitionJobs(
  limit = 20,
  offset = 0
): Promise<{ jobs: Record<string, unknown>[]; total: number }> {
  const supabase = await createClient();

  const { data, count, error } = await supabase
    .from("data_acquisition_jobs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Query failed: ${error.message}`);
  return {
    jobs: data || [],
    total: count || 0,
  };
}
