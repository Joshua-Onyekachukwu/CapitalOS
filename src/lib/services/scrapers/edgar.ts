// =============================================
// SEC EDGAR Form D Fetcher
// =============================================
// Fetches fund/investor data from SEC EDGAR's public API.
// Form D filings contain: fund names, locations, fund types,
// offering amounts, industry classifications.
//
// EDGAR API: https://efts.sec.gov/LATEST/search-index
// Rate limit: 10 requests/second (be polite)

import { createClient } from "@supabase/supabase-js";

// =============================================
// Types
// =============================================

interface EdgarFiling {
  adsh: string;
  display_names: string[];
  file_date: string;
  biz_locations: string[];
  biz_states: string[];
  form: string;
  items: string[];
  ciks: string[];
  sic_codes: string[];
}

interface EdgarFullFiling {
  filer: {
    name: string;
    cik: string;
    addresses: Record<string, { city: string; state: string; country: string }>;
  };
  offeringData: {
    industryGroup: string;
    investmentFundType: string;
    isPooledInvestmentFund: boolean;
  };
  issuer: {
    entityName: string;
    entityAddress: {
      city: string;
      stateOrCountry: string;
      stateOrCountryDescription: string;
    };
  };
  totalOfferingAmount: number;
  totalAmountSold: number;
  totalRemaining: number;
}

interface FetchResult {
  filingsFound: number;
  parsed: number;
  staged: number;
  errors: string[];
}

// =============================================
// EDGAR API Client
// =============================================

const EDGAR_BASE = "https://efts.sec.gov/LATEST";
const EDGAR_FILING_BASE = "https://www.sec.gov/Archives/edgar/data";
const RATE_LIMIT_MS = 120; // ~8 requests/second (be polite)

let lastRequestTime = 0;

async function edgarFetch(url: string): Promise<Response> {
  // Rate limiting
  const now = Date.now();
  const wait = RATE_LIMIT_MS - (now - lastRequestTime);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestTime = Date.now();

  return fetch(url, {
    headers: {
      "User-Agent": "CapitalOS/1.0 (investor-research@capitalos.io)",
      "Accept": "application/json",
    },
  });
}

// =============================================
// Step 1: Search for Form D filings
// =============================================

export async function searchFormDFilings(
  startDate: string = "2024-01-01",
  endDate: string = "2024-12-31",
  limit: number = 100
): Promise<EdgarFiling[]> {
  const filings: EdgarFiling[] = [];
  let offset = 0;
  const batchSize = 20;

  while (filings.length < limit) {
    const url = `${EDGAR_BASE}/search-index?q=%22form+d%22&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=${offset}&size=${batchSize}`;

    try {
      const response = await edgarFetch(url);
      if (!response.ok) break;

      const data = await response.json();
      const hits = data?.hits?.hits || [];

      if (hits.length === 0) break;

      for (const hit of hits) {
        const src = hit._source;
        filings.push({
          adsh: src.adsh,
          display_names: src.display_names || [],
          file_date: src.file_date,
          biz_locations: src.biz_locations || [],
          biz_states: src.biz_states || [],
          form: src.form,
          items: src.items || [],
          ciks: src.ciks || [],
          sic_codes: src.sics || [],
        });
      }

      offset += batchSize;
    } catch (err) {
      console.error("EDGAR search error:", err);
      break;
    }
  }

  return filings.slice(0, limit);
}

// =============================================
// Step 2: Fetch individual filing details
// =============================================

export async function fetchFilingDetails(adsh: string): Promise<EdgarFullFiling | null> {
  try {
    // Fetch the primary document
    const docUrl = `${EDGAR_FILING_BASE}/${adsh.replace(/-/g, "")}/${adsh}-primary_doc.xml`;
    const response = await edgarFetch(docUrl);

    if (!response.ok) {
      // Try the JSON version
      const jsonUrl = `${EDGAR_FILING_BASE}/${adsh.replace(/-/g, "")}/${adsh}-index.json`;
      const jsonResp = await edgarFetch(jsonUrl);
      if (!jsonResp.ok) return null;
      // Parse JSON index to find the XML file
      return null;
    }

    const xml = await response.text();
    return parseFormDXml(xml);
  } catch {
    return null;
  }
}

// =============================================
// Step 3: Parse Form D XML
// =============================================

function parseFormDXml(xml: string): EdgarFullFiling | null {
  try {
    // Extract key fields using regex (lightweight XML parsing)
    const getTag = (tag: string): string => {
      const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
      return match?.[1]?.trim() || "";
    };

    const getNestedTag = (parent: string, child: string): string => {
      const parentMatch = xml.match(new RegExp(`<${parent}[^>]*>([\\s\\S]*?)</${parent}>`));
      if (!parentMatch) return "";
      const childMatch = parentMatch[1].match(new RegExp(`<${child}[^>]*>([^<]*)</${child}>`));
      return childMatch?.[1]?.trim() || "";
    };

    return {
      filer: {
        name: getTag("filerName") || getTag("entityName"),
        cik: getTag("cik"),
        addresses: {},
      },
      offeringData: {
        industryGroup: getNestedTag("offeringData", "industryGroup"),
        investmentFundType: getNestedTag("offeringData", "investmentFundType"),
        isPooledInvestmentFund: xml.includes("isPooledInvestmentFund>yes"),
      },
      issuer: {
        entityName: getTag("issuerName") || getTag("entityName"),
        entityAddress: {
          city: getTag("city"),
          stateOrCountry: getTag("stateOrCountry"),
          stateOrCountryDescription: getTag("stateOrCountryDescription"),
        },
      },
      totalOfferingAmount: parseFloat(getTag("totalOfferingAmount")) || 0,
      totalAmountSold: parseFloat(getTag("totalAmountSold")) || 0,
      totalRemaining: parseFloat(getTag("totalRemaining")) || 0,
    };
  } catch {
    return null;
  }
}

// =============================================
// Step 4: Normalize and stage into raw_records
// =============================================

export async function stageEdgarFilings(
  filings: EdgarFiling[]
): Promise<FetchResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const result: FetchResult = {
    filingsFound: filings.length,
    parsed: 0,
    staged: 0,
    errors: [],
  };

  // First, create or find the EDGAR data provider
  let { data: provider } = await supabase
    .from("data_providers")
    .select("id")
    .eq("name", "sec_edgar")
    .single();

  if (!provider) {
    const { data: newProvider } = await supabase
      .from("data_providers")
      .insert({
        name: "sec_edgar",
        display_name: "SEC EDGAR",
        provider_type: "public_records",
        status: "active",
      })
      .select("id")
      .single();
    provider = newProvider;
  }

  if (!provider) {
    result.errors.push("Failed to create EDGAR data provider");
    return result;
  }

  // Create an acquisition job
  const { data: job } = await supabase
    .from("data_acquisition_jobs")
    .insert({
      provider_id: provider.id,
      job_type: "edgar_fetch",
      filters: { source: "sec_edgar", form_type: "D" },
      requested_count: filings.length,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  const BATCH_SIZE = 200;
  const rawRecords: Record<string, unknown>[] = [];

  for (const filing of filings) {
    try {
      // Parse the filing into a normalized shape
      const name = filing.display_names[0]?.replace(/\s*\(CIK\s+\d+\)\s*$/, "") || "";
      const location = filing.biz_locations[0] || "";
      const state = filing.biz_states[0] || "";

      if (!name) continue;

      // Determine fund type from items
      let investorType = "venture_capital";
      if (filing.items.includes("3C.1")) investorType = "venture_capital";
      else if (filing.items.includes("3C.7")) investorType = "angel_syndicate";
      else if (filing.items.includes("3C.11")) investorType = "private_equity";

      rawRecords.push({
        raw_data: {
          fullName: name,
          firmName: name,
          location: location,
          country: state.length === 2 ? "United States" : state,
          city: location.split(",")[0]?.trim() || "",
          investorType: investorType,
          sourceId: filing.adsh,
        },
        source_type: "public_records",
        source_provider: "sec_edgar",
        source_url: `https://www.sec.gov/Archives/edgar/data/${filing.ciks[0]}/${filing.adsh.replace(/-/g, "")}/${filing.adsh}-primary_doc.xml`,
        import_job_id: job?.id || null,
        status: "pending",
      });

      result.parsed++;
    } catch (err) {
      result.errors.push(`Filing ${filing.adsh}: ${err}`);
    }
  }

  // Batch insert raw records
  for (let i = 0; i < rawRecords.length; i += BATCH_SIZE) {
    const batch = rawRecords.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("raw_records").insert(batch);

    if (error) {
      result.errors.push(`Batch insert error: ${error.message}`);
    } else {
      result.staged += batch.length;
    }
  }

  // Update job status
  if (job) {
    await supabase
      .from("data_acquisition_jobs")
      .update({
        status: "completed",
        found_count: result.parsed,
        processed_count: result.staged,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  }

  return result;
}

// =============================================
// Full Pipeline: EDGAR → raw_records
// =============================================

export async function runEdgarPipeline(
  startDate: string = "2024-01-01",
  endDate: string = "2024-12-31",
  limit: number = 200
): Promise<FetchResult> {
  // 1. Search for filings
  const filings = await searchFormDFilings(startDate, endDate, limit);

  // 2. Stage into raw_records
  const result = await stageEdgarFilings(filings);

  return result;
}
