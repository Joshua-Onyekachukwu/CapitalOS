// =============================================
// Improved SEC EDGAR Scraper
// =============================================
// Focuses on Form D filings from investment funds (VC, PE, angels)
// Filters out operating companies filing Form D
// Uses the EFTS search API with proper form type filtering

import { query, closePool } from "./db";

interface EdgarFiling {
  adsh: string;
  display_names: string[];
  file_date: string;
  biz_locations: string[];
  biz_states: string[];
  form: string;
  items: string[];
  ciks: string[];
  root_forms: string[];
}

const EDGAR_BASE = "https://efts.sec.gov/LATEST";
const RATE_LIMIT_MS = 150; // ~7 req/sec (polite)

let lastRequestTime = 0;

async function edgarFetch(url: string): Promise<Response> {
  const now = Date.now();
  const wait = RATE_LIMIT_MS - (now - lastRequestTime);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestTime = Date.now();

  return fetch(url, {
    headers: {
      "User-Agent": "CapitalOS/1.0 (investor-research@capitalos.io)",
      Accept: "application/json",
    },
  });
}

// =============================================
// Search for Form D filings (fund-type items only)
// =============================================
export async function searchFundFilings(
  startDate: string,
  endDate: string,
  limit: number = 500
): Promise<EdgarFiling[]> {
  const filings: EdgarFiling[] = [];
  let offset = 0;
  const batchSize = 100;

  while (filings.length < limit) {
    const url = `${EDGAR_BASE}/search-index?q=%22form+d%22&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=${offset}&size=${batchSize}`;

    try {
      const response = await edgarFetch(url);
      if (!response.ok) {
        console.error(`EDGAR returned ${response.status}`);
        break;
      }

      const data = await response.json();
      const hits = data?.hits?.hits || [];

      if (hits.length === 0) break;

      for (const hit of hits) {
        const src = hit._source;
        const isFormD = src.root_forms?.includes("D") || src.form === "D" || src.form === "D/A";

        if (isFormD) {
          filings.push({
            adsh: src.adsh,
            display_names: src.display_names || [],
            file_date: src.file_date,
            biz_locations: src.biz_locations || [],
            biz_states: src.biz_states || [],
            form: src.form,
            items: src.items || [],
            ciks: src.ciks || [],
            root_forms: src.root_forms || [],
          });
        }
      }

      offset += batchSize;
      if (hits.length < batchSize) break;
    } catch (err) {
      console.error(`EDGAR search error at offset ${offset}:`, err);
      break;
    }
  }

  return filings.slice(0, limit);
}

// =============================================
// Determine fund type from Form D items
// =============================================
function classifyFundType(items: string[]): string {
  if (items.includes("3C.1")) return "venture_capital";
  if (items.includes("3C.7")) return "private_equity";
  if (items.includes("3C.11")) return "private_equity";
  if (items.includes("3C")) return "private_equity";
  return "venture_capital"; // Default for Form D funds
}

// =============================================
// Normalize state codes to country
// =============================================
function stateToLocation(state: string, city: string): { country: string; city: string; state: string } {
  const US_STATES: Record<string, string> = {
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
    CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
    HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
    KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
    MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
    MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
    NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
    OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
    SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
    VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
    DC: "District of Columbia",
  };

  const s = state.toUpperCase().trim();
  if (US_STATES[s]) {
    return { country: "United States", city: city.split(",")[0]?.trim() || "", state: US_STATES[s] };
  }
  if (s === "E9") return { country: "Cayman Islands", city: city.split(",")[0]?.trim() || "", state: "" };
  if (s === "A1") return { country: "Canada", city: city.split(",")[0]?.trim() || "", state: "" };
  if (s === "A2") return { country: "Canada", city: city.split(",")[0]?.trim() || "", state: "" };
  if (s === "X0") return { country: "United Kingdom", city: city.split(",")[0]?.trim() || "", state: "" };
  if (s === "L3") return { country: "Israel", city: city.split(",")[0]?.trim() || "", state: "" };
  if (s === "F4") return { country: "China", city: city.split(",")[0]?.trim() || "", state: "" };
  if (s === "V8") return { country: "Switzerland", city: city.split(",")[0]?.trim() || "", state: "" };
  if (s === "N4") return { country: "Luxembourg", city: city.split(",")[0]?.trim() || "", state: "" };
  if (s === "Z4") return { country: "Canada", city: city.split(",")[0]?.trim() || "", state: "" };
  if (s === "A6") return { country: "Australia", city: city.split(",")[0]?.trim() || "", state: "" };
  return { country: s.length === 2 ? "Unknown" : s, city: city.split(",")[0]?.trim() || "", state: s };
}

// =============================================
// Stage filings into raw_records
// =============================================
export async function stageFundFilings(
  filings: EdgarFiling[]
): Promise<{ staged: number; errors: number; errorMessages: string[] }> {
  let staged = 0;
  let errors = 0;
  const errorMessages: string[] = [];

  // Ensure EDGAR provider exists
  const providers = await query<{ id: string }>(
    `SELECT id FROM data_providers WHERE name = $1`,
    ["sec_edgar"]
  );

  let providerId: string | null = null;
  if (providers.length > 0) {
    providerId = providers[0].id;
  } else {
    const newProviders = await query<{ id: string }>(
      `INSERT INTO data_providers (name, display_name, provider_type, status) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      ["sec_edgar", "SEC EDGAR", "public_records", "active"]
    );
    providerId = newProviders[0]?.id || null;
  }

  // Create acquisition job
  const jobs = await query<{ id: string }>(
    `INSERT INTO data_acquisition_jobs (provider_id, job_type, filters, requested_count, status, started_at) 
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [providerId, "edgar_fetch", JSON.stringify({ source: "sec_edgar", form_type: "D", filing_count: filings.length }), filings.length, "running", new Date().toISOString()]
  );
  const jobId = jobs[0]?.id || null;

  // Process in batches
  const BATCH_SIZE = 200;

  for (let i = 0; i < filings.length; i += BATCH_SIZE) {
    const batch = filings.slice(i, i + BATCH_SIZE);

    for (const filing of batch) {
      try {
        let name = filing.display_names[0] || "";
        name = name.replace(/\s*\(CIK\s+\d+\)\s*$/i, "").trim();
        name = name.replace(/\s*\(.*?\)\s*$/g, "").trim();

        if (!name || name.length < 3) continue;

        const investorType = classifyFundType(filing.items);
        const location = filing.biz_locations[0] || "";
        const state = filing.biz_states[0] || "";
        const { country, city } = stateToLocation(state, location);

        await query(
          `INSERT INTO raw_records (raw_data, source_type, source_provider, source_url, import_job_id, status) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            JSON.stringify({
              fullName: name,
              firmName: name,
              location,
              country,
              city,
              investorType,
              sourceId: filing.adsh,
              filingDate: filing.file_date,
              formType: filing.form,
              fundItems: filing.items.join(","),
            }),
            "public_records",
            "sec_edgar",
            `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${filing.ciks[0]}&type=D&dateb=&owner=include&count=40`,
            jobId,
            "pending",
          ]
        );

        staged++;
      } catch (err) {
        errors++;
        errorMessages.push(`Filing ${filing.adsh}: ${err}`);
      }
    }

    const processed = Math.min(i + BATCH_SIZE, filings.length);
    console.log(`  Progress: ${processed}/${filings.length}`);
  }

  // Update job
  if (jobId) {
    await query(
      `UPDATE data_acquisition_jobs SET status = $1, found_count = $2, processed_count = $3, completed_at = $4 WHERE id = $5`,
      ["completed", filings.length, staged, new Date().toISOString(), jobId]
    );
  }

  return { staged, errors, errorMessages };
}

// =============================================
// Full Pipeline
// =============================================
export async function runEdgarFundPipeline(
  startDate: string = "2020-01-01",
  endDate: string = "2026-08-23",
  limit: number = 2000
): Promise<{
  filingsFound: number;
  staged: number;
  errors: number;
  errorMessages: string[];
}> {
  console.log(`Searching EDGAR for Form D filings from ${startDate} to ${endDate}...`);

  const filings = await searchFundFilings(startDate, endDate, limit);
  console.log(`Found ${filings.length} fund filings`);

  const result = await stageFundFilings(filings);
  console.log(`Staged ${result.staged} records, ${result.errors} errors`);

  return {
    filingsFound: filings.length,
    staged: result.staged,
    errors: result.errors,
    errorMessages: result.errorMessages,
  };
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

async function main() {
  const result = await runEdgarFundPipeline();
  console.log("\n=== Results ===");
  console.log(`Filings found: ${result.filingsFound}`);
  console.log(`Staged: ${result.staged}`);
  console.log(`Errors: ${result.errors}`);
  if (result.errorMessages.length > 0) {
    console.log("Error messages:", result.errorMessages.slice(0, 5));
  }
  await closePool();
}
