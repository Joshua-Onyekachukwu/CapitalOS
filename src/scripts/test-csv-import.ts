// =============================================
// Test CSV Import Pipeline
// =============================================
// Creates a sample CSV of investors and runs it through the import pipeline.

import "./load-env";
import { importCsvToSupabase } from "../lib/services/investor/csv-import";

const SAMPLE_CSV = `full_name,email,firm_name,investor_type,investment_stages,investment_sectors,linkedin_url,job_title,city,country
"Sarah Chen","sarah@sequoiacap.com","Sequoia Capital","venture_capital","seed;series_a","AI;SaaS;enterprise","https://linkedin.com/in/sarahchen","Partner","San Francisco","United States"
"Marcus Williams","marcus@a16z.com","Andreessen Horowitz","venture_capital","series_a;series_b","AI;crypto;fintech","https://linkedin.com/in/marcuswilliams","General Partner","San Francisco","United States"
"James Liu","james@lightspeed.com","Lightspeed Venture Partners","venture_capital","seed;series_a","SaaS;cloud;enterprise","https://linkedin.com/in/jamesliu","Partner","Menlo Park","United States"
"Emma Rodriguez","emma@foundersfund.com","Founders Fund","venture_capital","seed;series_a;series_b","AI;deep_tech;aerospace","https://linkedin.com/in/emmarodriguez","Partner","San Francisco","United States"
"Priya Patel","priya@ycombinator.com","Y Combinator","accelerator","pre_seed;seed","AI;SaaS;marketplace","https://linkedin.com/in/priyapatel","Partner","San Francisco","United States"
"David Kim","david@benchmark.com","Benchmark","venture_capital","seed;series_a","marketplace;consumer;SaaS","https://linkedin.com/in/davidkim","General Partner","San Francisco","United States"
"Lisa Thompson","lisa@greylock.com","Greylock Partners","venture_capital","seed;series_a;series_b","enterprise;SaaS;developer_tools","https://linkedin.com/in/lisathompson","Partner","San Francisco","United States"
"Robert Zhang","robert@obra-capital.com","Obra Capital","family_office","series_a;series_b;growth","fintech;insurtech","https://linkedin.com/in/robertzhang","Managing Director","New York","United States"
"Ana Silva","ana@kaszek.com","Kaszek Ventures","venture_capital","seed;series_a","fintech;marketplace;consumer","https://linkedin.com/in/anasilva","Partner","Buenos Aires","Argentina"
"Chen Wei","chen@matr Ventures.com","Matrix Partners","venture_capital","seed;series_a;series_b","enterprise;SaaS;cloud","https://linkedin.com/in/chenwei","Partner","Beijing","China"
"Michael Brown","michael@accel.com","Accel","venture_capital","series_a;series_b","fintech;SaaS;enterprise","https://linkedin.com/in/michaelbrown","Partner","London","United Kingdom"
"Sophie Martin","sophie@partech.com","Partech","venture_capital","seed;series_a","AI;healthtech;deeptech","https://linkedin.com/in/sophiemartin","General Partner","Paris","France"
"Hiroshi Tanaka","hiroshi@softbank.com","SoftBank Investment Advisers","venture_capital","series_b;growth","AI;mobility;fintech","https://linkedin.com/in/hiroshitanaka","Managing Partner","Tokyo","Japan"
"Rachel Green","rachel@sequoia.com","Sequoia Capital","venture_capital","series_a;series_b","SaaS;enterprise;devtools","https://linkedin.com/in/rachelgreen","Operating Partner","London","United Kingdom"
"Amit Sharma","amit@blume.vc","Blume Ventures","venture_capital","pre_seed;seed","SaaS;fintech;deeptech","https://linkedin.com/in/amitsharma","Partner","Mumbai","India"`;

async function testImport() {
  console.log("🧪 Testing CSV Import Pipeline\n");
  console.log("=".repeat(50));

  // 1. Test CSV parsing
  console.log("\n1️⃣  Testing CSV parsing...");
  const lines = SAMPLE_CSV.split("\n").filter((l) => l.trim());
  console.log(`   CSV has ${lines.length - 1} data rows`);

  // 2. Run the import
  console.log("\n2️⃣  Running import pipeline...");
  const startTime = Date.now();

  const result = await importCsvToSupabase(SAMPLE_CSV, "test_import");

  const elapsed = Date.now() - startTime;

  // 3. Show results
  console.log(`\n3️⃣  Results (${elapsed}ms):`);
  console.log("=".repeat(50));
  console.log(`   Total rows:    ${result.totalRows}`);
  console.log(`   Parsed:        ${result.parsed}`);
  console.log(`   Normalized:    ${result.normalized}`);
  console.log(`   Inserted:      ${result.inserted}`);
  console.log(`   Duplicates:    ${result.duplicates}`);
  console.log(`   Failed:        ${result.failed}`);

  if (result.errors.length > 0) {
    console.log(`\n   ⚠️  Errors:`);
    result.errors.forEach((err) => console.log(`   • ${err}`));
  }

  console.log("\n" + "=".repeat(50));

  if (result.inserted > 0) {
    console.log(`\n✅ Import successful! ${result.inserted} investors added to database.`);
  } else if (result.duplicates > 0) {
    console.log(`\n⚠️  All records were duplicates. ${result.duplicates} already exist.`);
  } else {
    console.log(`\n❌ Import failed. Check errors above.`);
  }
}

testImport().catch(console.error);
