// Fast bulk processor for EDGAR records
// Normalizes fund names directly into investor_firms + investors tables
// Bypasses the slow per-record matching pipeline
import { query, closePool } from "./db";

// State code to location mapping
const STATE_MAP: Record<string, { country: string; city: string }> = {
  AL: { country: "United States", city: "" }, AK: { country: "United States", city: "" },
  AZ: { country: "United States", city: "" }, AR: { country: "United States", city: "" },
  CA: { country: "United States", city: "" }, CO: { country: "United States", city: "" },
  CT: { country: "United States", city: "" }, DE: { country: "United States", city: "" },
  FL: { country: "United States", city: "" }, GA: { country: "United States", city: "" },
  HI: { country: "United States", city: "" }, ID: { country: "United States", city: "" },
  IL: { country: "United States", city: "" }, IN: { country: "United States", city: "" },
  IA: { country: "United States", city: "" }, KS: { country: "United States", city: "" },
  KY: { country: "United States", city: "" }, LA: { country: "United States", city: "" },
  ME: { country: "United States", city: "" }, MD: { country: "United States", city: "" },
  MA: { country: "United States", city: "" }, MI: { country: "United States", city: "" },
  MN: { country: "United States", city: "" }, MS: { country: "United States", city: "" },
  MO: { country: "United States", city: "" }, MT: { country: "United States", city: "" },
  NE: { country: "United States", city: "" }, NV: { country: "United States", city: "" },
  NH: { country: "United States", city: "" }, NJ: { country: "United States", city: "" },
  NM: { country: "United States", city: "" }, NY: { country: "United States", city: "" },
  NC: { country: "United States", city: "" }, ND: { country: "United States", city: "" },
  OH: { country: "United States", city: "" }, OK: { country: "United States", city: "" },
  OR: { country: "United States", city: "" }, PA: { country: "United States", city: "" },
  RI: { country: "United States", city: "" }, SC: { country: "United States", city: "" },
  SD: { country: "United States", city: "" }, TN: { country: "United States", city: "" },
  TX: { country: "United States", city: "" }, UT: { country: "United States", city: "" },
  VT: { country: "United States", city: "" }, VA: { country: "United States", city: "" },
  WA: { country: "United States", city: "" }, WV: { country: "United States", city: "" },
  WI: { country: "United States", city: "" }, WY: { country: "United States", city: "" },
  DC: { country: "United States", city: "" },
  E9: { country: "Cayman Islands", city: "" }, A1: { country: "Canada", city: "" },
  A2: { country: "Canada", city: "" }, X0: { country: "United Kingdom", city: "" },
  L3: { country: "Israel", city: "" }, F4: { country: "China", city: "" },
  V8: { country: "Switzerland", city: "" }, N4: { country: "Luxembourg", city: "" },
  Z4: { country: "Canada", city: "" }, A6: { country: "Australia", city: "" },
};

function classifyFundType(items: string[]): string {
  if (items.includes("3C.1")) return "venture_capital";
  if (items.includes("3C.7")) return "private_equity";
  if (items.includes("3C.11")) return "private_equity";
  if (items.includes("3C")) return "private_equity";
  return "venture_capital";
}

function normalizeFirmName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(llc|ltd|inc|llp|corp|corporation|co|company|lp|plc|ag|gmbh|s\.?a\.?|sas|bv|nv|pty\.?\s*ltd\.?)\s*$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  console.log("=== EDGAR Bulk Processor ===");

  // Fetch all pending EDGAR raw records
  const records = await query<{ id: string; raw_data: any; source_provider: string }>(
    `SELECT id, raw_data, source_provider FROM raw_records 
     WHERE status = 'pending' AND source_provider = 'sec_edgar'
     ORDER BY created_at ASC LIMIT 5000`
  );

  if (records.length === 0) {
    console.log("No pending EDGAR records found.");
    await closePool();
    return;
  }

  console.log(`Found ${records.length} pending EDGAR records`);

  let firmsCreated = 0;
  let firmsUpdated = 0;
  let investorsCreated = 0;
  let investorsSkipped = 0;
  let errors = 0;

  // Cache for firm name lookups
  const firmCache = new Map<string, string>(); // normalized_name -> firm_id

  console.log('Starting bulk processing...');

  const BATCH_SIZE = 50;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    for (const record of batch) {
      try {
        const raw = record.raw_data as Record<string, string>;
        const name = raw.fullName || raw.firmName || "";
        const location = raw.location || "";
        const state = (raw.country || "").length === 2 ? raw.country : "";
        const city = raw.city || location.split(",")[0]?.trim() || "";
        const investorType = raw.investorType || "venture_capital";

        if (!name || name.length < 3) {
          await query(`UPDATE raw_records SET status = 'error', processed_at = $1 WHERE id = $2`, [new Date().toISOString(), record.id]);
          errors++;
          continue;
        }

        const normalized = normalizeFirmName(name);
        let firmId = firmCache.get(normalized);

        if (!firmId) {
          const geo = STATE_MAP[state] || { country: state || "Unknown", city: "" };

          // Insert firm
          const firms = await query<{ id: string }>(
            `INSERT INTO investor_firms (name, normalized_name, firm_type, country, headquarters, source, source_id, data_quality_score) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [name, normalized, investorType, geo.country || "Unknown", location || null, "sec_edgar", raw.sourceId || null, 30]
          );
          firmId = firms[0]?.id;
          if (firmId) {
            firmCache.set(normalized, firmId);
            firmsCreated++;
          }
        } else {
          firmsUpdated++;
        }

        // Insert investor
        const geo = STATE_MAP[state] || { country: state || "Unknown", city: "" };
        await query(
          `INSERT INTO investors (full_name, investor_type, current_firm_id, country, city, location, source, source_id, source_provider, data_quality_score, outreach_readiness, is_active) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [name, investorType, firmId || null, geo.country || "Unknown", city || null, location || null, "sec_edgar", raw.sourceId || null, "sec_edgar", 25, "not_ready", true]
        );
        investorsCreated++;

        // Mark record as processed
        await query(`UPDATE raw_records SET status = 'new', processed_at = $1 WHERE id = $2`, [new Date().toISOString(), record.id]);
      } catch (err) {
        await query(`UPDATE raw_records SET status = 'error', processed_at = $1 WHERE id = $2`, [new Date().toISOString(), record.id]);
        errors++;
      }
    }

    const processed = Math.min(i + BATCH_SIZE, records.length);
    console.log(`  Progress: ${processed}/${records.length} (firms: ${firmCache.size}, investors: +${BATCH_SIZE}, errors: ${errors})`);
  }

  console.log("");
  console.log("=== Results ===");
  console.log(`Firms created: ${firmsCreated}`);
  console.log(`Firms found (existing): ${firmsUpdated}`);
  console.log(`Investors created: ${investorsCreated}`);
  console.log(`Investors skipped (duplicate): ${investorsSkipped}`);
  console.log(`Errors: ${errors}`);

  await closePool();
}

main().catch(console.error);
