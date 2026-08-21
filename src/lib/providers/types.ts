// =============================================
// Investor Data Provider Abstraction Types
// =============================================

export interface InvestorSearchFilters {
  query?: string;
  sectors?: string[];
  stages?: string[];
  geographies?: string[];
  investorTypes?: string[];
  minCheckSize?: number;
  maxCheckSize?: number;
  currency?: string;
  firmId?: string;
  limit?: number;
  offset?: number;
}

export interface InvestorProviderResult {
  providerId: string;
  providerName: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  jobTitle?: string;
  bio?: string;
  location?: string;
  country?: string;
  city?: string;
  investorType?: string;
  firmName?: string;
  firmDomain?: string;
  firmWebsite?: string;
  investmentStages?: string[];
  investmentSectors?: string[];
  investmentGeographies?: string[];
  minCheckSize?: number;
  maxCheckSize?: number;
  currency?: string;
  portfolioCount?: number;
  lastInvestmentDate?: string;
  recentInvestmentCount?: number;
  websiteUrl?: string;
  avatarUrl?: string;
  raw?: Record<string, unknown>;
}

export interface CompanySearchFilters {
  query?: string;
  sectors?: string[];
  stages?: string[];
  geographies?: string[];
  minRevenue?: number;
  maxRevenue?: number;
  minEmployees?: number;
  maxEmployees?: number;
  limit?: number;
  offset?: number;
}

export interface CompanyProviderResult {
  providerId: string;
  providerName: string;
  name: string;
  domain?: string;
  description?: string;
  industry?: string;
  sectors?: string[];
  stage?: string;
  country?: string;
  city?: string;
  employeeCount?: number;
  revenue?: number;
  foundedYear?: number;
  websiteUrl?: string;
  linkedinUrl?: string;
  logoUrl?: string;
  raw?: Record<string, unknown>;
}

export interface EnrichmentParams {
  email?: string;
  linkedinUrl?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
}

export interface EnrichmentResult {
  enriched: boolean;
  data: Partial<InvestorProviderResult>;
  creditsUsed: number;
}

export interface CompanyEnrichmentParams {
  domain?: string;
  companyName?: string;
  linkedinUrl?: string;
}

export interface CompanyEnrichmentResult {
  enriched: boolean;
  data: Partial<CompanyProviderResult>;
  creditsUsed: number;
}

export interface ProviderUsage {
  totalCredits: number;
  creditsUsed: number;
  creditsRemaining: number;
  monthlyLimit: number;
  usagePercentage: number;
}

export interface ProviderHealth {
  status: "healthy" | "degraded" | "down";
  latency?: number;
  lastChecked: Date;
  message?: string;
}

// =============================================
// Provider Interface
// =============================================

export interface InvestorDataProvider {
  name: string;
  displayName: string;

  searchInvestors(
    filters: InvestorSearchFilters
  ): Promise<InvestorProviderResult[]>;

  getInvestor(providerId: string): Promise<InvestorProviderResult | null>;

  searchCompanies(
    filters: CompanySearchFilters
  ): Promise<CompanyProviderResult[]>;

  enrichContact(
    params: EnrichmentParams
  ): Promise<EnrichmentResult>;

  enrichCompany(
    params: CompanyEnrichmentParams
  ): Promise<CompanyEnrichmentResult>;

  getUsage(): Promise<ProviderUsage>;

  healthCheck(): Promise<ProviderHealth>;
}
