// Run the EDGAR fund scraper
// Usage: npx tsx src/scripts/run-edgar.ts [startDate] [endDate] [limit]

import { config } from "dotenv";
import { resolve } from "path";
import { runEdgarFundPipeline } from "./edgar-scrape";

// Load env
config({ path: resolve(__dirname, "../../.env.local") });

const startDate = process.argv[2] || "2020-01-01";
const endDate = process.argv[3] || "2026-08-23";
const limit = parseInt(process.argv[4] || "2000");

async function main() {
  console.log("=== SEC EDGAR Fund Scraper ===");
  console.log(`Date range: ${startDate} to ${endDate}`);
  console.log(`Limit: ${limit} filings`);
  console.log("");

  const result = await runEdgarFundPipeline(startDate, endDate, limit);

  console.log("");
  console.log("=== Results ===");
  console.log(`Filings found: ${result.filingsFound}`);
  console.log(`Staged to raw_records: ${result.staged}`);
  console.log(`Errors: ${result.errors}`);

  if (result.errorMessages.length > 0) {
    console.log("");
    console.log("Errors:");
    result.errorMessages.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
  }
}

main().catch(console.error);
