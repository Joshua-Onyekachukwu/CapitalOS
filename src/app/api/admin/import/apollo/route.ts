// =============================================
// Apollo Bulk Import API Route
// =============================================
// Pulls investors from Apollo API in batches, normalizes them,
// deduplicates against existing data, and inserts into Supabase.
// Rate-limited to Apollo's plan limits.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeInvestor, generateDeduplicationKeys } from "@/lib/services/investor/normalization";

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
  if (!APOLLO_API_KEY) {
    return NextResponse.json(
      { error: "Apollo API key not configured. Set APOLLO_API_KEY in .env.local" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const {
      query = "investor",
      pages = 5,
      perPage = 25,
      sectors,
      geographies,
    } = body;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const progress: ImportProgress = {
      phase: "fetching",
      totalFetched: 0,
      inserted: 0,
      duplicates: 0,
      errors: 0,
      errorMessages: [],
    };

    // Fetch existing dedup keys
    const { data: existingInvestors } = await supabase
      .from("investors")
      .select("email, linkedin_url")
      .not("email", "is", null)
      .limit(100000);

    const existingEmails = new Set<string>();
    const existingLinkedins = new Set<string>();
    (existingInvestors || []).forEach((inv) => {
      if (inv.email) existingEmails.add(inv.email.toLowerCase());
      if (inv.linkedin_url) existingLinkedins.add(inv.linkedin_url.toLowerCase().replace(/\/+$/, ""));
    });

    // Fetch from Apollo in pages
    const allNormalized: ReturnType<typeof normalizeInvestor>[] = [];

    for (let page = 1; page <= pages; page++) {
      try {
        const searchBody: Record<string, unknown> = {
          q_keywords: query,
          per_page: Math.min(perPage, 100),
          page,
        };

        if (sectors?.length) {
          searchBody.organization_industry_tag_ids = sectors;
        }
        if (geographies?.length) {
          searchBody.organization_locations = geographies;
        }

        const response = await apolloRequest<{
          people: Record<string, unknown>[];
          pagination: { total_entries: number };
        }>("/people/search", searchBody);

        const people = response.people || [];
        progress.totalFetched += people.length;

        // Normalize each person
        for (const person of people) {
          try {
            const mapped = mapApolloPerson(person);
            const normalized = normalizeInvestor(mapped);

            // Dedup check
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
              // Add to dedup set
              if (normalized.email) existingEmails.add(normalized.email.toLowerCase());
              if (normalized.linkedinUrl) existingLinkedins.add(normalized.linkedinUrl.toLowerCase().replace(/\/+$/, ""));
            }
          } catch (err) {
            progress.errors++;
            progress.errorMessages.push(`Person normalize error: ${err}`);
          }
        }

        // Rate limit: 8 requests per second for Apollo
        if (page < pages) {
          await new Promise((r) => setTimeout(r, 200));
        }
      } catch (err) {
        progress.errors++;
        progress.errorMessages.push(`Apollo page ${page}: ${err}`);
      }
    }

    // Batch insert into Supabase (500 at a time)
    progress.phase = "inserting";
    const BATCH_SIZE = 500;

    for (let i = 0; i < allNormalized.length; i += BATCH_SIZE) {
      const batch = allNormalized.slice(i, i + BATCH_SIZE);

      const insertData = batch.map((inv) => ({
        full_name: inv.fullName,
        first_name: inv.firstName,
        last_name: inv.lastName,
        email: inv.email,
        phone: inv.phone,
        linkedin_url: inv.linkedinUrl,
        job_title: inv.jobTitle,
        bio: inv.bio,
        location: inv.location,
        country: inv.country,
        city: inv.city,
        investor_type: inv.investorType || "unknown",
        investment_stages: inv.investmentStages,
        investment_sectors: inv.investmentSectors,
        investment_geographies: inv.investmentGeographies,
        min_check_size: inv.minCheckSize,
        max_check_size: inv.maxCheckSize,
        currency: inv.currency,
        portfolio_count: inv.portfolioCount,
        website_url: inv.websiteUrl,
        avatar_url: inv.avatarUrl,
        source: "apollo",
        source_id: inv.sourceId,
        source_provider: "apollo",
        data_quality_score: inv.email ? 50 : 20,
        outreach_readiness: "not_ready",
        is_active: true,
      }));

      const { error, data } = await supabase
        .from("investors")
        .insert(insertData)
        .select("id");

      if (error) {
        progress.errors++;
        progress.errorMessages.push(`Batch insert: ${error.message}`);
      } else {
        progress.inserted += data?.length || batch.length;
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
