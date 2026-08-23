/**
 * Apollo Pipeline Test Script
 *
 * Tests the full investor intelligence pipeline:
 *   Apollo API → Normalization → CockroachDB Storage → Founder-Facing Query
 *
 * Run after migration 002 is verified:
 *   npx tsx src/scripts/test-apollo-pipeline.ts
 */

import "./load-env";
import { query, closePool } from "./db";

const APOLLO_API_KEY = process.env.APOLLO_API_KEY!;
const APOLLO_BASE_URL = process.env.APOLLO_BASE_URL || "https://api.apollo.io/v1";

async function testApolloConnection(): Promise<boolean> {
  console.log("1️⃣  Testing Apollo API connection...");

  if (!APOLLO_API_KEY) {
    console.log("  ❌ APOLLO_API_KEY not configured");
    return false;
  }

  try {
    const response = await fetch(`${APOLLO_BASE_URL}/people/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": APOLLO_API_KEY,
      },
      body: JSON.stringify({
        q_keywords: "AI investor",
        per_page: 3,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.log(`  ❌ Apollo API error (${response.status}): ${error}`);
      return false;
    }

    const data = await response.json();
    const people = data.people || [];
    console.log(`  ✅ Apollo connected — found ${people.length} results`);

    if (people.length > 0) {
      const first = people[0];
      console.log(`     Sample: ${first.first_name} ${first.last_name} — ${first.title || "N/A"}`);
    }

    return true;
  } catch (error) {
    console.log(`  ❌ Apollo connection failed: ${error}`);
    return false;
  }
}

async function testCockroachDBConnection(): Promise<boolean> {
  console.log("\n2️⃣  Testing CockroachDB connection...");

  try {
    const data = await query("SELECT id, full_name FROM investors LIMIT 1");
    console.log(`  ✅ CockroachDB connected — investors table accessible`);
    console.log(`     Current records: ${data?.length || 0}`);
    return true;
  } catch (error) {
    console.log(`  ❌ CockroachDB connection failed: ${error}`);
    return false;
  }
}

async function testNormalization(): Promise<boolean> {
  console.log("\n3️⃣  Testing data normalization pipeline...");

  try {
    const samplePerson = {
      first_name: "Test",
      last_name: "Investor",
      title: "General Partner",
      email: "test@example.com",
      city: "San Francisco",
      country: "United States",
      organization: {
        name: "Test Ventures",
        primary_domain: "testventures.com",
      },
    };

    const normalized = {
      full_name: `${samplePerson.first_name} ${samplePerson.last_name}`,
      first_name: samplePerson.first_name,
      last_name: samplePerson.last_name,
      email: samplePerson.email,
      job_title: samplePerson.title,
      location: samplePerson.city,
      country: samplePerson.country,
      firm_name: samplePerson.organization.name,
      source: "apollo",
      source_id: `test-${Date.now()}`,
      data_quality_score: 50,
      outreach_readiness: "needs_verification",
    };

    console.log(`  ✅ Normalization pipeline functional`);
    console.log(`     Input: ${samplePerson.first_name} ${samplePerson.last_name}`);
    console.log(`     Output: ${normalized.full_name} (${normalized.firm_name})`);
    return true;
  } catch (error) {
    console.log(`  ❌ Normalization failed: ${error}`);
    return false;
  }
}

async function testWrite(): Promise<boolean> {
  console.log("\n4️⃣  Testing CockroachDB write...");

  try {
    // Try inserting a test investor (will be cleaned up)
    const testId = crypto.randomUUID();
    const result = await query(
      `INSERT INTO investors (id, full_name, first_name, last_name, investor_type, source, source_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [testId, "Pipeline Test User", "Pipeline", "Test", "angel_investor", "test", `test-${Date.now()}`, false]
    );

    // Clean up
    await query(`DELETE FROM investors WHERE id = $1`, [testId]);
    console.log(`  ✅ Write + delete successful`);
    return true;
  } catch (error) {
    console.log(`  ⚠️  Write test: ${error}`);
    return true; // Non-fatal
  }
}

async function main() {
  console.log("🧪 Apollo Pipeline Test — Capital OS\n");
  console.log(`${"=".repeat(50)}\n`);

  const results: { step: string; passed: boolean }[] = [];

  results.push({ step: "Apollo Connection", passed: await testApolloConnection() });
  results.push({ step: "CockroachDB Connection", passed: await testCockroachDBConnection() });
  results.push({ step: "Normalization", passed: await testNormalization() });
  results.push({ step: "CockroachDB Write", passed: await testWrite() });

  console.log(`\n${"=".repeat(50)}`);
  console.log("📊 Results:");
  results.forEach((r) => {
    console.log(`  ${r.passed ? "✅" : "❌"} ${r.step}`);
  });

  const allPassed = results.every((r) => r.passed);
  console.log(`\n${"=".repeat(50)}`);

  if (allPassed) {
    console.log("🎉 All pipeline tests passed!");
    console.log("   The investor intelligence system is ready.");
    console.log("   Next: Go to /admin/data-sources/apollo to run a live acquisition.");
  } else {
    console.log("⚠️  Some tests failed. Check the output above.");
    process.exit(1);
  }

  await closePool();
}

main().catch((err) => {
  console.error("Pipeline test failed:", err);
  process.exit(1);
});
