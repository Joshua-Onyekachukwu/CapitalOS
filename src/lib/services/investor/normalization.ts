// =============================================
// Investor Data Normalization Pipeline
// =============================================

import type { InvestorProviderResult } from "@/lib/providers/types";

// =============================================
// Normalized Investor Shape
// =============================================

export interface NormalizedInvestor {
  fullName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  jobTitle?: string;
  bio?: string;
  location?: string;
  country?: string;
  city?: string;
  investorType: string;
  investmentStages: string[];
  investmentSectors: string[];
  investmentGeographies: string[];
  minCheckSize?: number;
  maxCheckSize?: number;
  currency: string;
  portfolioCount: number;
  websiteUrl?: string;
  avatarUrl?: string;
  source: string;
  sourceId: string;
  raw: Record<string, unknown>;
}

// =============================================
// Stage Normalization Map
// =============================================

const STAGE_MAP: Record<string, string> = {
  "pre-seed": "pre_seed",
  preseed: "pre_seed",
  "pre seed": "pre_seed",
  seed: "seed",
  "series a": "series_a",
  seriesa: "series_a",
  "series b": "series_b",
  seriesb: "series_b",
  "series c": "series_c",
  seriesc: "series_c",
  growth: "growth",
  late_stage: "late_stage",
  "late stage": "late_stage",
  pre_ipo: "pre_ipo",
  "pre-ipo": "pre_ipo",
};

export function normalizeStage(stage: string): string {
  const lower = stage.toLowerCase().trim();
  return STAGE_MAP[lower] || lower.replace(/\s+/g, "_");
}

// =============================================
// Investor Type Normalization
// =============================================

const TYPE_MAP: Record<string, string> = {
  angel: "angel_investor",
  "angel investor": "angel_investor",
  syndicate: "angel_syndicate",
  "angel syndicate": "angel_syndicate",
  vc: "venture_capital",
  "venture capital": "venture_capital",
  "venture capitalist": "venture_capital",
  cvc: "corporate_venture",
  "corporate venture": "corporate_venture",
  "corporate venture capital": "corporate_venture",
  family_office: "family_office",
  "family office": "family_office",
  pe: "private_equity",
  "private equity": "private_equity",
  accelerator: "accelerator",
  incubator: "incubator",
  "government fund": "government_fund",
  "university fund": "university_fund",
  "venture studio": "venture_studio",
  micro_vc: "micro_vc",
  "micro vc": "micro_vc",
  "impact investor": "impact_investor",
  strategic: "strategic_investor",
  "strategic investor": "strategic_investor",
};

export function normalizeInvestorType(type: string): string {
  const lower = type.toLowerCase().trim();
  return TYPE_MAP[lower] || lower.replace(/\s+/g, "_");
}

// =============================================
// Sector Normalization
// =============================================

const SECTOR_SYNONYMS: Record<string, string> = {
  "artificial intelligence": "ai",
  ai: "ai",
  "ai infrastructure": "ai_infrastructure",
  "machine learning": "ml",
  "deep learning": "ml",
  "developer tools": "devtools",
  "dev tools": "devtools",
  fintech: "fintech",
  "financial technology": "fintech",
  healthtech: "healthtech",
  "health care": "healthtech",
  healthcare: "healthtech",
  climatetech: "climatetech",
  "climate tech": "climatetech",
  cleantech: "cleantech",
  "clean tech": "cleantech",
  edtech: "edtech",
  "education technology": "edtech",
  cybersecurity: "cybersecurity",
  "info security": "cybersecurity",
  saas: "saas",
  "software as a service": "saas",
  enterprise: "enterprise",
  "enterprise software": "enterprise",
  b2b: "enterprise",
  consumer: "consumer",
  b2c: "consumer",
  marketplace: "marketplace",
  "market place": "marketplace",
  deeptech: "deeptech",
  "deep tech": "deeptech",
  robotics: "robotics",
  spacetech: "spacetech",
  "space tech": "spacetech",
  aerospace: "spacetech",
  proptech: "proptech",
  "real estate": "proptech",
  agritech: "agritech",
  "agriculture": "agritech",
  logistics: "logistics",
  supply_chain: "logistics",
  mobility: "mobility",
  transportation: "mobility",
  energy: "energy",
  "clean energy": "energy",
  media: "media",
  "digital media": "media",
  web3: "web3",
  blockchain: "web3",
  crypto: "web3",
};

export function normalizeSector(sector: string): string {
  const lower = sector.toLowerCase().trim();
  return SECTOR_SYNONYMS[lower] || lower.replace(/\s+/g, "_");
}

// =============================================
// Country Normalization
// =============================================

const COUNTRY_MAP: Record<string, string> = {
  us: "United States",
  usa: "United States",
  "united states": "United States",
  "united states of america": "United States",
  uk: "United Kingdom",
  "united kingdom": "United Kingdom",
  "great britain": "United Kingdom",
  de: "Germany",
  germany: "Germany",
  fr: "France",
  france: "France",
  nl: "Netherlands",
  netherlands: "Netherlands",
  japan: "Japan",
  cn: "China",
  china: "China",
  in: "India",
  india: "India",
  br: "Brazil",
  brazil: "Brazil",
  ng: "Nigeria",
  nigeria: "Nigeria",
  za: "South Africa",
  "south africa": "South Africa",
  ke: "Kenya",
  kenya: "Kenya",
  ae: "United Arab Emirates",
  "united arab emirates": "United Arab Emirates",
  uae: "United Arab Emirates",
  sa: "Saudi Arabia",
  "saudi arabia": "Saudi Arabia",
  sg: "Singapore",
  singapore: "Singapore",
  il: "Israel",
  israel: "Israel",
};

export function normalizeCountry(country: string): string {
  const lower = country.toLowerCase().trim();
  return COUNTRY_MAP[lower] || country;
}

// =============================================
// Currency Normalization
// =============================================

export function normalizeCurrency(currency: string): string {
  const upper = currency.toUpperCase().trim();
  const map: Record<string, string> = {
    USD: "USD",
    "$": "USD",
    EUR: "EUR",
    "€": "EUR",
    GBP: "GBP",
    "£": "GBP",
  };
  return map[upper] || upper;
}

// =============================================
// Main Normalization Function
// =============================================

export function normalizeInvestor(
  raw: InvestorProviderResult
): NormalizedInvestor {
  return {
    fullName: raw.fullName || "Unknown",
    firstName: raw.firstName,
    lastName: raw.lastName,
    email: raw.email,
    phone: raw.phone,
    linkedinUrl: raw.linkedinUrl,
    jobTitle: raw.jobTitle,
    bio: raw.bio,
    location: raw.location,
    country: raw.country ? normalizeCountry(raw.country) : undefined,
    city: raw.city,
    investorType: raw.investorType
      ? normalizeInvestorType(raw.investorType)
      : "angel_investor",
    investmentStages: (raw.investmentStages || []).map(normalizeStage),
    investmentSectors: (raw.investmentSectors || []).map(normalizeSector),
    investmentGeographies: (raw.investmentGeographies || []).map(
      normalizeCountry
    ),
    minCheckSize: raw.minCheckSize,
    maxCheckSize: raw.maxCheckSize,
    currency: normalizeCurrency(raw.currency || "USD"),
    portfolioCount: raw.portfolioCount || 0,
    websiteUrl: raw.websiteUrl,
    avatarUrl: raw.avatarUrl,
    source: raw.providerName,
    sourceId: raw.providerId,
    raw: raw.raw || {},
  };
}

// =============================================
// Deduplication Key Generation
// =============================================

export function generateDeduplicationKeys(investor: NormalizedInvestor): string[] {
  const keys: string[] = [];

  // Email (highest confidence)
  if (investor.email) {
    keys.push(`email:${investor.email.toLowerCase().trim()}`);
  }

  // LinkedIn URL
  if (investor.linkedinUrl) {
    const linkedin = investor.linkedinUrl
      .replace(/\/+$/, "")
      .toLowerCase();
    keys.push(`linkedin:${linkedin}`);
  }

  // Name + Firm (requires firm data)
  // This would be done during the merge step

  // Source ID (provider-specific)
  if (investor.sourceId) {
    keys.push(`source:${investor.source}:${investor.sourceId}`);
  }

  return keys;
}
