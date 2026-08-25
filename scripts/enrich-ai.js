#!/usr/bin/env node
/**
 * AI-Powered Investor Enrichment
 * ================================
 * Uses NVIDIA API to enrich investor records that can't be enriched
 * by rule-based methods alone. Handles complex institutional names
 * like "ABCD Capital Management LP" → infers domain, email, category.
 *
 * Features:
 * - Domain inference from complex institutional names
 * - Investor type classification
 * - Sector inference
 * - Batch processing with NVIDIA API key rotation
 * - Automatic checkpoint/resume
 * - Local backup of enriched results
 *
 * Usage:
 *   node scripts/enrich-ai.js --dry-run            # Test with 5 records
 *   node scripts/enrich-ai.js --limit 100          # Enrich 100 records
 *   node scripts/enrich-ai.js                      # Enrich all without emails
 *   node scripts/enrich-ai.js --resume             # Resume from checkpoint
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const https = require("https");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BACKUP_DIR = path.resolve(__dirname, "../data-backups/enriched");
const CHECKPOINT_FILE = path.join(BACKUP_DIR, "ai-enrichment-checkpoint.json");
const PAGE_SIZE = 1000;

// NVIDIA API keys with rotation
const NVIDIA_KEYS = [
  process.env.NVIDIA_API_KEY_1,
  process.env.NVIDIA_API_KEY_2,
  process.env.NVIDIA_API_KEY_3,
  process.env.NVIDIA_API_KEY_4,
  process.env.NVIDIA_API_KEY_5,
].filter(Boolean);

let currentKeyIndex = 0;

function getNextKey() {
  const key = NVIDIA_KEYS[currentKeyIndex % NVIDIA_KEYS.length];
  currentKeyIndex++;
  return key;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call NVIDIA API with key rotation and retry
 */
async function callNvidia(prompt, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const apiKey = getNextKey();
    try {
      const result = await new Promise((resolve, reject) => {
        const postData = JSON.stringify({
          model: "meta/llama-3.1-8b-instruct",
          messages: [
            {
              role: "system",
              content: "You are a venture capital data analyst. Respond ONLY with valid JSON. No markdown, no explanation."
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 512,
          temperature: 0.1,
          top_p: 0.9,
        });

        const req = https.request(
          {
            hostname: "integrate.api.nvidia.com",
            path: "/v1/chat/completions",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              "Content-Length": Buffer.byteLength(postData),
            },
            timeout: 30000,
          },
          (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
              try {
                const parsed = JSON.parse(data);
                if (parsed.choices && parsed.choices[0]) {
                  resolve(parsed.choices[0].message.content);
                } else if (parsed.error) {
                  reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
                } else {
                  reject(new Error("No choices in response"));
                }
              } catch (e) {
                reject(new Error(`Parse error: ${e.message}`));
              }
            });
          }
        );
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
        req.write(postData);
        req.end();
      });

      return result;
    } catch (e) {
      if (attempt < retries - 1) {
        await sleep(1000 * (attempt + 1)); // Exponential backoff
      } else {
        throw e;
      }
    }
  }
}

/**
 * Batch enrich investors using AI
 * Sends multiple names in one prompt for efficiency
 */
async function batchEnrich(investors) {
  const names = investors.map((inv, i) =>
    `${i + 1}. "${inv.full_name || inv.company_name || "Unknown"}" | Location: ${inv.location || "Unknown"} | Type: ${inv.investor_type || "Unknown"}`
  ).join("\n");

  const prompt = `For each investor/entity below, infer the most likely:
- domain (company website domain, e.g. "sequoiacap.com")
- email (a likely contact email, e.g. "info@sequoiacap.com")
- investor_type (if it can be inferred from the name)
- sector (primary sector if inferable)
- city and country (if the name suggests a location)

Return a JSON array with objects like:
[{"idx":1,"domain":"example.com","email":"info@example.com","investor_type":"Venture Capital","sector":"Technology","city":"San Francisco","country":"US"}]

If you cannot infer something, use null for that field.

Investors:
${names}`;

  const response = await callNvidia(prompt);

  // Parse the JSON response
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    // Try parsing the whole response
    return JSON.parse(response);
  } catch (e) {
    console.error(`   ⚠️  Failed to parse AI response: ${e.message}`);
    return [];
  }
}

/**
 * Load checkpoint
 */
function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf8"));
  }
  return { lastId: 0, processed: 0, enriched: 0 };
}

function saveCheckpoint(data) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({ ...data, timestamp: new Date().toISOString() }));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const resume = args.includes("--resume");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : 500;

  ensureDir(BACKUP_DIR);

  console.log("═══════════════════════════════════════════════");
  console.log("  AI-Powered Investor Enrichment");
  console.log("═══════════════════════════════════════════════\n");
  console.log(`  NVIDIA API keys: ${NVIDIA_KEYS.length}`);
  console.log(`  Mode: ${dryRun ? "DRY RUN (5 records)" : `Limit: ${limit.toLocaleString()}`}\n`);

  if (NVIDIA_KEYS.length === 0) {
    console.error("❌ No NVIDIA API keys found. Set NVIDIA_API_KEY_1..5 in .env.local");
    process.exit(1);
  }

  // Checkpoint
  let checkpoint = { lastCreated: null, processed: 0, enriched: 0 };
  if (resume) {
    checkpoint = loadCheckpoint();
    console.log(`   Resuming: ${checkpoint.processed} processed, ${checkpoint.enriched} enriched\n`);
  }

  // Fetch investors without emails
  console.log("📥 Fetching investors without emails...\n");

  let allInvestors = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("investors")
      .select("*")
      .is("email", null)
      .order("created_at", { ascending: true })
      .range(from, to);

    const { data, error } = await query;
    if (error) { console.error(`   ❌ ${error.message}`); break; }
    if (!data || data.length === 0) break;

    allInvestors.push(...data);
    page++;
    process.stdout.write(`\r   Fetched ${allInvestors.length.toLocaleString()}...`);

    const maxRecords = dryRun ? 5 : limit;
    if (allInvestors.length >= maxRecords) {
      allInvestors = allInvestors.slice(0, maxRecords);
      break;
    }
  }

  console.log(`\n   To process: ${allInvestors.length.toLocaleString()}\n`);

  // Process in batches of 10
  const BATCH_SIZE = 10;
  let enriched = 0;
  let processed = 0;
  const startTime = Date.now();

  for (let i = 0; i < allInvestors.length; i += BATCH_SIZE) {
    const batch = allInvestors.slice(i, i + BATCH_SIZE);

    try {
      const results = await batchEnrich(batch);

      for (let j = 0; j < batch.length; j++) {
        const inv = batch[j];
        const aiResult = results.find((r) => r.idx === j + 1);

        if (aiResult) {
          const updates = {};

          if (aiResult.domain && !inv.company_website) {
            updates.company_website = `https://${aiResult.domain}`;
          }
          if (aiResult.email && !inv.email) {
            updates.email = aiResult.email;
            updates.email_source = "ai_inferred";
          }
          if (aiResult.investor_type && !inv.investor_type) {
            updates.investor_type = aiResult.investor_type;
          }
          if (aiResult.sector && !inv.investment_sectors) {
            updates.investment_sectors = aiResult.sector;
          }

          if (Object.keys(updates).length > 0) {
            // Update Supabase
            await supabase.from("investors").update(updates).eq("id", inv.id);
            enriched++;
          }
        }

        processed++;
        checkpoint.lastCreated = inv.created_at;
      }

      // Save checkpoint every batch
      checkpoint.processed = processed;
      checkpoint.enriched = enriched;
      saveCheckpoint(checkpoint);

      process.stdout.write(
        `\r   Processed ${processed.toLocaleString()} / ${allInvestors.length.toLocaleString()} | Enriched: ${enriched} | Rate: ${Math.round((processed / ((Date.now() - startTime) / 1000)) || 0)}/s...`
      );

      // Rate limit: ~5 requests per second
      await sleep(200);
    } catch (e) {
      console.error(`\n   ⚠️  Batch error: ${e.message}`);
      await sleep(2000); // Wait longer on error
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Save final results
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupPath = path.join(BACKUP_DIR, `ai-enrichment-${timestamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    processed,
    enriched,
    elapsed: parseFloat(elapsed),
    rate: Math.round(processed / parseFloat(elapsed)),
  }, null, 2));

  console.log("\n\n═══════════════════════════════════════════════");
  console.log("  AI Enrichment Complete");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Processed: ${processed.toLocaleString()}`);
  console.log(`  Enriched: ${enriched.toLocaleString()}`);
  console.log(`  Time: ${elapsed}s`);
  console.log(`  Rate: ${Math.round(processed / parseFloat(elapsed))}/s`);
  console.log(`  Backup: ${backupPath}`);
  console.log("═══════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\n💥 Fatal error:", err.message);
  process.exit(1);
});
