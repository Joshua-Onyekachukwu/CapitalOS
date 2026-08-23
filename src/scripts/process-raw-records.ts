// Process pending raw records through normalization + promotion
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../.env.local") });

import { processRawRecords, promoteNewRecords } from "../lib/services/investor/ingestion";

async function main() {
  const batchSize = parseInt(process.argv[2] || "500");

  console.log("=== Processing Raw Records ===");
  console.log(`Batch size: ${batchSize}`);
  console.log("");

  // Step 1: Process (normalize + match)
  console.log("Step 1: Normalizing and matching...");
  const processResult = await processRawRecords(batchSize);
  console.log(`  Total: ${processResult.totalRecords}`);
  console.log(`  Matched: ${processResult.matched}`);
  console.log(`  New: ${processResult.newRecords}`);
  console.log(`  Duplicates: ${processResult.duplicates}`);
  console.log(`  Errors: ${processResult.errors}`);

  if (processResult.errorMessages.length > 0) {
    processResult.errorMessages.slice(0, 5).forEach((e) => console.log(`  Error: ${e}`));
  }

  // Step 2: Promote new records to canonical
  if (processResult.newRecords > 0) {
    console.log("");
    console.log("Step 2: Promoting new records to canonical investors...");
    const promoteResult = await promoteNewRecords(processResult.newRecords);
    console.log(`  Promoted: ${promoteResult.promoted}`);
    console.log(`  Errors: ${promoteResult.errors}`);
  }

  console.log("");
  console.log("=== Done ===");
}

main().catch(console.error);
