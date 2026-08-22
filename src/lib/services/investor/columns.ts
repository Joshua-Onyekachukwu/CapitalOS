// =============================================
// Shared Column Mapping
// =============================================
// Single source of truth for CSV column detection.
// Used by csv-import.ts and ingestion.ts.

export const COLUMN_MAP: Record<string, string[]> = {
  fullName: ["full_name", "fullname", "name", "investor_name", "full name"],
  firstName: ["first_name", "firstname", "first name", "given_name"],
  lastName: ["last_name", "lastname", "last name", "surname", "family_name"],
  email: ["email", "email_address", "e-mail", "email address"],
  phone: ["phone", "phone_number", "telephone", "mobile", "phone number"],
  linkedinUrl: ["linkedin_url", "linkedin", "linkedin profile", "linkedin url", "profile_url"],
  jobTitle: ["job_title", "title", "position", "role", "job title"],
  bio: ["bio", "biography", "about", "description"],
  location: ["location", "city", "address"],
  country: ["country", "nation", "country_name"],
  city: ["city", "city_name", "town"],
  investorType: ["investor_type", "type", "investor type", "fund_type", "fund type"],
  firmName: ["firm_name", "firm", "company", "organization", "fund", "investor firm", "firm name"],
  firmDomain: ["firm_domain", "domain", "website_domain", "firm domain"],
  firmWebsite: ["firm_website", "website", "firm website", "url"],
  investmentStages: ["investment_stages", "stages", "stage", "investment stage", "stages focus"],
  investmentSectors: ["investment_sectors", "sectors", "sector", "industry", "investment sector", "sectors focus"],
  investmentGeographies: ["investment_geographies", "geographies", "geography", "region", "countries", "location focus"],
  portfolioCount: ["portfolio_count", "portfolio", "deals", "investments", "portfolio count"],
  websiteUrl: ["website_url", "personal_website", "personal website"],
  avatarUrl: ["avatar_url", "avatar", "photo", "profile_image", "headshot"],
  sourceId: ["source_id", "id", "external_id", "provider_id", "source id"],
};

/**
 * Map CSV headers to our field names using flexible column detection.
 */
export function mapColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_"));

  for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
    for (let i = 0; i < lowerHeaders.length; i++) {
      if (aliases.includes(lowerHeaders[i])) {
        mapping[field] = headers[i];
        break;
      }
    }
  }

  return mapping;
}
