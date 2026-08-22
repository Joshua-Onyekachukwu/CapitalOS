// =============================================
// Apollo Provider Implementation
// =============================================
// Apollo is used as an internal data source only.
// Founders never see "Apollo" in the UI.
//
// Trial plan available endpoints:
// - /people/search (people search)
// - /people/match (people enrichment)
// - /organizations/search (company search)
// - /organizations/match (company enrichment)
//
// NOT available on trial:
// - /mixed_people/search, /mixed_companies/search
// - /people/bulk_match, /people/show, /organizations/show

import type {
  InvestorDataProvider,
  InvestorSearchFilters,
  InvestorProviderResult,
  CompanySearchFilters,
  CompanyProviderResult,
  EnrichmentParams,
  EnrichmentResult,
  CompanyEnrichmentParams,
  CompanyEnrichmentResult,
  ProviderUsage,
  ProviderHealth,
} from "./types";

const APOLLO_BASE_URL =
  process.env.APOLLO_BASE_URL || "https://api.apollo.io/v1";
const APOLLO_API_KEY = process.env.APOLLO_API_KEY;

// =============================================
// Helper: Apollo request with API key in body
// =============================================

async function apolloRequest<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<T> {
  if (!APOLLO_API_KEY) {
    throw new Error("APOLLO_API_KEY is not configured");
  }

  const response = await fetch(`${APOLLO_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": APOLLO_API_KEY,
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Apollo API error (${response.status}): ${error}`);
  }

  return response.json();
}

// =============================================
// Map Apollo person to our result type
// =============================================

function mapApolloPerson(person: Record<string, unknown>): InvestorProviderResult {
  const org = (person.organization || {}) as Record<string, unknown>;

  return {
    providerId: (person.id as string) || "",
    providerName: "apollo",
    firstName: (person.first_name as string) || undefined,
    lastName: (person.last_name as string) || undefined,
    fullName:
      `${person.first_name || ""} ${person.last_name || ""}`.trim() ||
      "Unknown",
    email: (person.email as string) || undefined,
    phone: (person.phone_numbers as string[])?.[0] || undefined,
    linkedinUrl: (person.linkedin_url as string) || undefined,
    jobTitle: (person.title as string) || undefined,
    bio: (person.bio as string) || undefined,
    location: (person.city as string) || undefined,
    country: (person.country as string) || undefined,
    city: (person.city as string) || undefined,
    investorType: undefined,
    firmName: (org.name as string) || undefined,
    firmDomain: (org.primary_domain as string) || undefined,
    firmWebsite: (org.website_url as string) || undefined,
    investmentStages: [],
    investmentSectors: [],
    investmentGeographies: [],
    portfolioCount: undefined,
    websiteUrl: (person.website_url as string) || undefined,
    avatarUrl: (person.avatar_url as string) || undefined,
    raw: person,
  };
}

// =============================================
// Map Apollo organization to our result type
// =============================================

function mapApolloOrg(org: Record<string, unknown>): CompanyProviderResult {
  return {
    providerId: (org.id as string) || "",
    providerName: "apollo",
    name: (org.name as string) || "Unknown",
    domain: (org.primary_domain as string) || undefined,
    description: (org.description as string) || undefined,
    industry: (org.industry as string) || undefined,
    sectors: [],
    stage: undefined,
    country: (org.country as string) || undefined,
    city: (org.city as string) || undefined,
    employeeCount: (org.estimated_num_employees as number) || undefined,
    revenue: undefined,
    foundedYear: (org.founded_year as number) || undefined,
    websiteUrl: (org.website_url as string) || undefined,
    linkedinUrl: (org.linkedin_url as string) || undefined,
    logoUrl: (org.logo_url as string) || undefined,
    raw: org,
  };
}

// =============================================
// Apollo Provider Class
// =============================================

export class ApolloProvider implements InvestorDataProvider {
  name = "apollo";
  displayName = "Apollo";

  async searchInvestors(
    filters: InvestorSearchFilters
  ): Promise<InvestorProviderResult[]> {
    // Use /people/search (available on trial)
    const body: Record<string, unknown> = {
      q_keywords: filters.query || "",
      per_page: filters.limit || 25,
      page: filters.offset
        ? Math.floor(filters.offset / (filters.limit || 25)) + 1
        : 1,
    };

    if (filters.geographies?.length) {
      body.organization_locations = filters.geographies;
    }

    if (filters.sectors?.length) {
      body.organization_industry_tag_ids = filters.sectors;
    }

    const response = await apolloRequest<{
      people: Record<string, unknown>[];
      pagination: { total_entries: number };
    }>("/people/search", body);

    return (response.people || []).map(mapApolloPerson);
  }

  async getInvestor(
    providerId: string
  ): Promise<InvestorProviderResult | null> {
    try {
      // Use /people/match (available on trial)
      const response = await apolloRequest<{
        person: Record<string, unknown>;
      }>("/people/match", {
        id: providerId,
      });

      return response.person ? mapApolloPerson(response.person) : null;
    } catch {
      return null;
    }
  }

  async searchCompanies(
    filters: CompanySearchFilters
  ): Promise<CompanyProviderResult[]> {
    // Use /organizations/search (available on trial)
    const body: Record<string, unknown> = {
      q_organization_name: filters.query || "",
      per_page: filters.limit || 25,
      page: filters.offset
        ? Math.floor(filters.offset / (filters.limit || 25)) + 1
        : 1,
    };

    if (filters.geographies?.length) {
      body.organization_locations = filters.geographies;
    }

    if (filters.sectors?.length) {
      body.organization_industry_tag_ids = filters.sectors;
    }

    const response = await apolloRequest<{
      organizations: Record<string, unknown>[];
      pagination: { total_entries: number };
    }>("/organizations/search", body);

    return (response.organizations || []).map(mapApolloOrg);
  }

  async enrichContact(
    params: EnrichmentParams
  ): Promise<EnrichmentResult> {
    const body: Record<string, unknown> = {};

    if (params.email) body.email = params.email;
    if (params.linkedinUrl) body.linkedin_url = params.linkedinUrl;
    if (params.firstName) body.first_name = params.firstName;
    if (params.lastName) body.last_name = params.lastName;

    // Use /people/match (available on trial)
    const response = await apolloRequest<{
      person: Record<string, unknown>;
    }>("/people/match", body);

    if (response.person) {
      return {
        enriched: true,
        data: mapApolloPerson(response.person),
        creditsUsed: 1,
      };
    }

    return { enriched: false, data: {}, creditsUsed: 1 };
  }

  async enrichCompany(
    params: CompanyEnrichmentParams
  ): Promise<CompanyEnrichmentResult> {
    const body: Record<string, unknown> = {};

    if (params.domain) body.domain = params.domain;
    if (params.companyName) body.organization_name = params.companyName;
    if (params.linkedinUrl) body.linkedin_url = params.linkedinUrl;

    // Use /organizations/match (available on trial)
    const response = await apolloRequest<{
      organization: Record<string, unknown>;
    }>("/organizations/match", body);

    if (response.organization) {
      return {
        enriched: true,
        data: mapApolloOrg(response.organization),
        creditsUsed: 1,
      };
    }

    return { enriched: false, data: {}, creditsUsed: 1 };
  }

  async getUsage(): Promise<ProviderUsage> {
    // Trial plan: 48,000 credits annual allocation
    const total = 48000;
    const monthlyLimit = 5000;

    return {
      totalCredits: total,
      creditsUsed: 0,
      creditsRemaining: total,
      monthlyLimit,
      usagePercentage: 0,
    };
  }

  async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();

    try {
      // Simple health check — search for a known term
      await this.searchInvestors({ query: "test", limit: 1 });
      const latency = Date.now() - start;

      return {
        status: latency < 5000 ? "healthy" : "degraded",
        latency,
        lastChecked: new Date(),
        message: `Connected — responded in ${latency}ms`,
      };
    } catch (error) {
      return {
        status: "down",
        lastChecked: new Date(),
        message: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }
}

// =============================================
// Provider Registry
// =============================================

const providers = new Map<string, InvestorDataProvider>();

export function registerProvider(provider: InvestorDataProvider): void {
  providers.set(provider.name, provider);
}

export function getProvider(name: string): InvestorDataProvider | undefined {
  return providers.get(name);
}

export function getAllProviders(): InvestorDataProvider[] {
  return Array.from(providers.values());
}

// Register Apollo on module load
if (APOLLO_API_KEY) {
  registerProvider(new ApolloProvider());
}
