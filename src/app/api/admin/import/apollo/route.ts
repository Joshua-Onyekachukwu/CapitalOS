// =============================================
// Apollo Bulk Import API Route
// =============================================
// Uses CockroachDB for data.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { normalizeInvestor, generateDeduplicationKeys } from "@/lib/services/investor/normalization";
import { requireAuth } from "@/lib/middleware/api-auth";

const APOLLO_BASE_URL = process.env.APOLLO_BASE_URL || "https://api.apollo.io/v1";
const APOLLO_API_KEY = process.env.APOLLO_API_KEY;

interface ImportProgress {
  phase: string;
  totalFetched: number;
  inserted: number;
  duplicates: number;
  errors: number;
  errorMessages: string[];
}

async function apolloRequest<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  if (!APOLLO_API_KEY) throw new Error("APOLLO_API_KEY is not configured");

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

function mapApolloPerson(person: Record<string, unknown>) {
  const org = (person.organization || {}) as Record<string, unknown>;
  return {
    providerId: (person.id as string) || "",
    providerName: "apollo",
    firstName: (person.first_name as string) || undefined,
    lastName: (person.last_name as string) || undefined,
    fullName: `${person.first_name || ""} ${person.last_name || ""}`.trim() || "Unknown",
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
    investmentStages: [] as string[],
    investmentSectors: (org.industry ? [org.industry as string] : []),
    investmentGeographies: (person.country ? [person.country as string] : []),
    portfolioCount: undefined,
    websiteUrl: (person.website_url as string) || undefined,
    avatarUrl: (person.avatar_url as string) || undefined,
    raw: person,
  };
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  if (!APOLLO_API_KEY) {
    return NextResponse.json(
      { error: "Apollo API key not configured. Set APOLLO_API_KEY in .env.local" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { query: searchQuery = "investor", pages = 5, perPage = 25, sectors, geographies } = body;

    const progress: ImportProgress = {
      phase: "fetching",
      totalFetched: 0,
      inserted: 0,
      duplicates: 0,
      errors: 0,
      errorMessages: [],
    };

    // Fetch existing dedup keys from CockroachDB
    const existingInvestors = await query<{ email: string | null; linkedin_url: string | null }>(
      `SELECT email, linkedin_url FROM investors WHERE email IS NOT NULL LIMIT 100000`
    );

    const existingEmails = new Set<string>();
    const existingLinkedins = new Set<string>();
    existingInvestors.forEach((inv) => {
      if (inv.email) existingEmails.add(inv.email.toLowerCase());
      if (inv.linkedin_url) existingLinkedins.add(inv.linkedin_url.toLowerCase().replace(/\/+$/, ""));
    });

    const allNormalized: ReturnType<typeof normalizeInvestor>[] = [];

    for (let page = 1; page <= pages; page++) {
      try {
        const searchBody: Record<string, unknown> = {
          q_keywords: searchQuery,
          per_page: Math.min(perPage, 100),
          page,
        };

        if (sectors?.length) searchBody.organization_industry_tag_ids = sectors;
        if (geographies?.length) searchBody.organization_locations = geographies;

        const response = await apolloRequest<{
          people: Record<string, unknown>[];
          pagination: { total_entries: number };
        }>("/people/search", searchBody);

        const people = response.people || [];
        progress.totalFetched += people.length;

        for (const person of people) {
          try {
            const mapped = mapApolloPerson(person);
            const normalized = normalizeInvestor(mapped);

            const dedupKeys = generateDeduplicationKeys(normalized);
            const isDuplicate = dedupKeys.some((key) => {
              if (key.startsWith("email:")) return existingEmails.has(key.replace("email:", ""));
              if (key.startsWith("linkedin:")) return existingLinkedins.has(key.replace("linkedin:", ""));
              return false;
            });

            if (isDuplicate) {
              progress.duplicates++;
            } else {
              allNormalized.push(normalized);
              if (normalized.email) existingEmails.add(normalized.email.toLowerCase());
              if (normalized.linkedinUrl) existingLinkedins.add(normalized.linkedinUrl.toLowerCase().replace(/\/+$/, ""));
            }
          } catch (err) {
            progress.errors++;
            progress.errorMessages.push(`Person normalize error: ${err}`);
          }
        }

        if (page < pages) await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        progress.errors++;
        progress.errorMessages.push(`Apollo page ${page}: ${err}`);
      }
    }

    // Batch insert into CockroachDB (500 at a time)
    progress.phase = "inserting";
    const BATCH_SIZE = 500;

    for (let i = 0; i < allNormalized.length; i += BATCH_SIZE) {
      const batch = allNormalized.slice(i, i + BATCH_SIZE);
      const valuePlaceholders: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      for (const inv of batch) {
        valuePlaceholders.push(
          `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}::text[], $${paramIdx++}::text[], $${paramIdx++}::text[], $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
        );
        params.push(
          inv.fullName, inv.firstName, inv.lastName, inv.email, inv.phone,
          inv.linkedinUrl, inv.jobTitle, inv.bio, inv.location, inv.country,
          inv.city, inv.investorType || "unknown", inv.investmentStages,
          inv.investmentSectors, inv.investmentGeographies, inv.minCheckSize,
          inv.maxCheckSize, inv.currency, inv.portfolioCount, inv.websiteUrl,
          inv.avatarUrl, "apollo", inv.sourceId, "apollo",
          inv.email ? 50 : 20, "not_ready", true
        );
      }

      try {
        await query(
          `INSERT INTO investors (full_name, first_name, last_name, email, phone, linkedin_url, job_title, bio, location, country, city, investor_type, investment_stages, investment_sectors, investment_geographies, min_check_size, max_check_size, currency, portfolio_count, website_url, avatar_url, source, source_id, source_provider, data_quality_score, outreach_readiness, is_active)
           VALUES ${valuePlaceholders.join(", ")}`,
          params
        );
        progress.inserted += batch.length;
      } catch (err: any) {
        progress.errors++;
        progress.errorMessages.push(`Batch insert: ${err.message}`);
      }
    }

    progress.phase = "complete";

    return NextResponse.json({
      success: true,
      ...progress,
      totalNormalized: allNormalized.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Apollo import failed" },
      { status: 500 }
    );
  }
}
