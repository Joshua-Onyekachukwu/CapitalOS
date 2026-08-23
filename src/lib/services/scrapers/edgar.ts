// =============================================
// SEC EDGAR Form D Fetcher
// =============================================
// Uses CockroachDB for data.

import { query } from "@/lib/db";

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

interface FetchResult {
  filingsFound: number;
  parsed: number;
  staged: number;
  errors: string[];
}

const EDGAR_BASE = "https://efts.sec.gov/LATEST";
const EDGAR_FILING_BASE = "https://www.sec.gov/Archives/edgar/data";
const RATE_LIMIT_MS = 120;

let lastRequestTime = 0;

async function edgarFetch(url: string): Promise<Response> {
  const now = Date.now();
  const wait = RATE_LIMIT_MS - (now - lastRequestTime);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestTime = Date.now();

  return fetch(url, {
    headers: {
      "User-Agent": "CapitalOS/1.0 (investor-research@capitalos.io)",
      "Accept": "application/json",
    },
  });
}

export async function searchFormDFilings(startDate: string = "2024-01-01", endDate: string = "2024-12-31", limit: number = 100): Promise<EdgarFiling[]> {
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
    } catch {
      break;
    }
  }

  return filings.slice(0, limit);
}

export async function stageEdgarFilings(filings: EdgarFiling[]): Promise<FetchResult> {
  const result: FetchResult = { filingsFound: filings.length, parsed: 0, staged: 0, errors: [] };

  // Create or find EDGAR data provider
  const providers = await query<{ id: string }>(
    `SELECT id FROM data_providers WHERE name = 'sec_edgar'`
  );

  let providerId: string;
  if (providers.length) {
    providerId = providers[0].id;
  } else {
    const rows = await query<{ id: string }>(
      `INSERT INTO data_providers (name, display_name, provider_type, status)
       VALUES ('sec_edgar', 'SEC EDGAR', 'public_records', 'active')
       RETURNING id`
    );
    providerId = rows[0].id;
  }

  // Create acquisition job
  const jobs = await query<{ id: string }>(
    `INSERT INTO data_acquisition_jobs (provider_id, job_type, filters, requested_count, status, started_at)
     VALUES ($1, 'edgar_fetch', $2::jsonb, $3, 'running', NOW())
     RETURNING id`,
    [providerId, JSON.stringify({ source: "sec_edgar", form_type: "D" }), filings.length]
  );
  const jobId = jobs[0].id;

  const BATCH_SIZE = 200;
  const rawRecords: string[] = [];
  const rawParams: any[] = [];
  let paramIdx = 1;

  for (const filing of filings) {
    try {
      const name = filing.display_names[0]?.replace(/\s*\(CIK\s+\d+\)\s*$/, "") || "";
      if (!name) continue;

      let investorType = "venture_capital";
      if (filing.items.includes("3C.1")) investorType = "venture_capital";
      else if (filing.items.includes("3C.7")) investorType = "angel_syndicate";
      else if (filing.items.includes("3C.11")) investorType = "private_equity";

      const location = filing.biz_locations[0] || "";
      const state = filing.biz_states[0] || "";

      rawRecords.push(`($${paramIdx++}::jsonb, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
      rawParams.push(
        JSON.stringify({ fullName: name, firmName: name, location, country: state.length === 2 ? "United States" : state, city: location.split(",")[0]?.trim() || "", investorType, sourceId: filing.adsh }),
        "public_records",
        "sec_edgar",
        `https://www.sec.gov/Archives/edgar/data/${filing.ciks[0]}/${filing.adsh.replace(/-/g, "")}/${filing.adsh}-primary_doc.xml`,
        jobId,
        "pending"
      );
      result.parsed++;
    } catch (err) {
      result.errors.push(`Filing ${filing.adsh}: ${err}`);
    }
  }

  // Batch insert
  for (let i = 0; i < rawRecords.length; i += BATCH_SIZE) {
    const batch = rawRecords.slice(i, i + BATCH_SIZE);
    const batchParams = rawParams.slice(i * 6, (i + batch.length) * 6);
    try {
      await query(
        `INSERT INTO raw_records (raw_data, source_type, source_provider, source_url, import_job_id, status)
         VALUES ${batch.join(", ")}`,
        batchParams
      );
      result.staged += batch.length;
    } catch (err: any) {
      result.errors.push(`Batch insert error: ${err.message}`);
    }
  }

  // Update job status
  await query(
    `UPDATE data_acquisition_jobs SET status = 'completed', found_count = $1, processed_count = $2, completed_at = NOW() WHERE id = $3`,
    [result.parsed, result.staged, jobId]
  );

  return result;
}

export async function runEdgarPipeline(startDate: string = "2024-01-01", endDate: string = "2024-12-31", limit: number = 200): Promise<FetchResult> {
  const filings = await searchFormDFilings(startDate, endDate, limit);
  return stageEdgarFilings(filings);
}
