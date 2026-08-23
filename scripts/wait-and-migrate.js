// =============================================
// Wait for Supabase + Auto-Migrate
// =============================================
// Keeps retrying until Supabase is online, then migrates.
// Run: node scripts/wait-and-migrate.js
// =============================================

require("dotenv").config({ path: ".env.local" });

const https = require("https");
const http = require("http");
const { Client } = require("pg");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAX_WAIT_MINUTES = 30;
const CHECK_INTERVAL_MS = 15000; // 15 seconds

function checkSupabase() {
  return new Promise((resolve) => {
    const url = `${SUPABASE_URL}/rest/v1/investors?select=id&limit=1`;
    const req = https.get(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      timeout: 10000,
    }, (res) => {
      resolve(res.statusCode);
      res.resume();
    });
    req.on("error", () => resolve(0));
    req.on("timeout", () => { req.destroy(); resolve(0); });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const startTime = Date.now();
  const maxWait = MAX_WAIT_MINUTES * 60 * 1000;
  let attempt = 0;

  console.log("═══════════════════════════════════════════════");
  console.log("  Waiting for Supabase to come online...");
  console.log("  (Checks every 15 seconds, max 30 minutes)");
  console.log("═══════════════════════════════════════════════\n");

  while (Date.now() - startTime < maxWait) {
    attempt++;
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    const status = await checkSupabase();

    if (status === 200) {
      console.log(`\n✅ Supabase is ONLINE! (after ${elapsed}s, ${attempt} attempts)\n`);
      console.log("Starting migration...\n");

      // Spawn the migration script as a child process
      const { execSync } = require("child_process");
      try {
        execSync("node scripts/migrate-supabase-to-cockroach.js", {
          stdio: "inherit",
          cwd: __dirname + "/..",
          timeout: 600000, // 10 min max for the actual migration
        });
        console.log("\n🎉 Migration complete!");
      } catch (err) {
        console.error("\nMigration failed:", err.message);
        process.exit(1);
      }
      return;
    }

    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    process.stdout.write(`\r  ⏳ [${mins}m ${secs}s] Attempt ${attempt} — Supabase HTTP ${status || "timeout"}, waiting...`);

    await sleep(CHECK_INTERVAL_MS);
  }

  console.log(`\n\n⏰ Timeout after ${MAX_WAIT_MINUTES} minutes. Supabase is still offline.`);
  console.log("Please check your Supabase dashboard and try again.");
  process.exit(1);
}

// If called directly, run main. If required as module, export.
if (require.main === module) {
  main().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}
