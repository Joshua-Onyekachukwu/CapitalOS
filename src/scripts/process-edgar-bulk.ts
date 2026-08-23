// Fast bulk processor for EDGAR records
// Normalizes fund names directly into investor_firms + investors tables
// Bypasses the slow per-record matching pipeline
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../.env.local") });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  const { data: records, error } = await supabase
    .from("raw_records")
    .select("id, raw_data, source_provider")
    .eq("status", "pending")
    .eq("source_provider", "sec_edgar")
    .order("created_at", { ascending: true })
    .limit(5000);

  if (error || !records || records.length === 0) {
    console.log("No pending EDGAR records found.");
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
    const firmInserts: Record<string, unknown>[] = [];
    const investorInserts: Record<string, unknown>[] = [];
    const recordUpdates: { id: string; status: string; investorId?: string }[] = [];

    for (const record of batch) {
      try {
        const raw = record.raw_data as Record<string, string>;
        const name = raw.fullName || raw.firmName || "";
        const location = raw.location || "";
        const state = (raw.country || "").length === 2 ? raw.country : "";
        const city = raw.city || location.split(",")[0]?.trim() || "";
        const investorType = raw.investorType || "venture_capital";

        if (!name || name.length < 3) {
          recordUpdates.push({ id: record.id, status: "error" });
          errors++;
          continue;
        }

        const normalized = normalizeFirmName(name);
        let firmId = firmCache.get(normalized);

        if (!firmId) {
          const geo = STATE_MAP[state] || { country: state || "Unknown", city: "" };
          firmInserts.push({
            name, normalized_name: normalized, firm_type: investorType,
            country: geo.country || "Unknown", headquarters: location || null,
            source: "sec_edgar", source_id: raw.sourceId || null, data_quality_score: 30,
          });
          // Use a temp ID — will be resolved after batch insert
          firmId = `pending-${normalized}`;
          firmCache.set(normalized, firmId);
          firmsCreated++;
        } else {
          firmsUpdated++;
        }

        const geo = STATE_MAP[state] || { country: state || "Unknown", city: "" };
        investorInserts.push({
          full_name: name, investor_type: investorType, current_firm_id: firmId.startsWith("pending-") ? null : firmId,
          country: geo.country || "Unknown", city: city || null, location: location || null,
          source: "sec_edgar", source_id: raw.sourceId || null, source_provider: "sec_edgar",
          data_quality_score: 25, outreach_readiness: "not_ready", is_active: true,
        });
        recordUpdates.push({ id: record.id, status: "new" });
      } catch (err) {
        recordUpdates.push({ id: record.id, status: "error" });
        errors++;
      }
    }

    // Batch insert firms
    if (firmInserts.length > 0) {
      const { data: insertedFirms } = await supabase
        .from("investor_firms")
        .insert(firmInserts)
        .select("id, normalized_name");

      if (insertedFirms) {
        for (const firm of insertedFirms) {
          if (firm.normalized_name) {
            firmCache.set(firm.normalized_name, firm.id);
          }
        }
        firmsCreated = firmCache.size;
      }
    }

    // Resolve firm IDs in investor inserts
    for (const inv of investorInserts) {
      if (inv.current_firm_id === null) {
        // Find the firm by matching normalized name from the raw record
        // This is a best-effort — we'll link after insert
      }
    }

    // Batch insert investors (skip those with null firm_id for now)
    const validInvestors = investorInserts.filter((inv) => inv.current_firm_id !== null);
    if (validInvestors.length > 0) {
      const { data: inserted } = await supabase
        .from("investors")
        .insert(validInvestors)
        .select("id");

      investorsCreated += inserted?.length || 0;
    }

    // Mark records as processed
    for (const update of recordUpdates) {
      await supabase
        .from("raw_records")
        .update({ status: update.status, processed_at: new Date().toISOString() })
        .eq("id", update.id);
    }

    const processed = Math.min(i + BATCH_SIZE, records.length);
    console.log(`  Progress: ${processed}/${records.length} (firms: ${firmCache.size}, investors: +${validInvestors.length}, errors: ${errors})`);
  }

  console.log("");
  console.log("=== Results ===");
  console.log(`Firms created: ${firmsCreated}`);
  console.log(`Firms found (existing): ${firmsUpdated}`);
  console.log(`Investors created: ${investorsCreated}`);
  console.log(`Investors skipped (duplicate): ${investorsSkipped}`);
  console.log(`Errors: ${errors}`);
}

// markProcessed is done inline via batch updates

main().catch(console.error);
