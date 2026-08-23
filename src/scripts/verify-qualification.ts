import { query, closePool } from "./db";

async function verify() {
  console.log("\n🔍 Verifying Bulk Qualification Results\n");
  console.log("=".repeat(50));

  const total = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM investors`);
  const scored = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM investors WHERE fit_score > 0`);
  const unscored = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM investors WHERE fit_score = 0 OR fit_score IS NULL`);

  const totalCount = parseInt(total[0]?.count || "0");
  const scoredCount = parseInt(scored[0]?.count || "0");
  const unscoredCount = parseInt(unscored[0]?.count || "0");

  console.log(`\n📊 Total Investors:    ${totalCount.toLocaleString()}`);
  console.log(`   Scored:            ${scoredCount.toLocaleString()}`);
  console.log(`   Unscored:          ${unscoredCount.toLocaleString()}`);
  console.log(`   Coverage:          ${totalCount ? ((scoredCount / totalCount) * 100).toFixed(1) : 0}%`);

  // Outreach readiness breakdown
  const readinessData = await query<{ outreach_readiness: string }>(
    `SELECT outreach_readiness FROM investors WHERE fit_score > 0`
  );

  if (readinessData.length > 0) {
    const breakdown: Record<string, number> = {};
    for (const row of readinessData) {
      const key = row.outreach_readiness || "unknown";
      breakdown[key] = (breakdown[key] || 0) + 1;
    }

    console.log("\n📧 Outreach Readiness Breakdown:");
    const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
    for (const [status, count] of sorted) {
      const pct = ((count / scoredCount) * 100).toFixed(1);
      const bar = "█".repeat(Math.round(parseFloat(pct) / 2));
      console.log(`   ${status.padEnd(20)} ${count.toLocaleString().padStart(8)} (${pct}%) ${bar}`);
    }
  }

  // Fit score distribution
  const fitData = await query<{ fit_score: number }>(
    `SELECT fit_score FROM investors WHERE fit_score > 0`
  );

  if (fitData.length > 0) {
    const buckets = { "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0 };
    let sum = 0, min = 101, max = 0;

    for (const row of fitData) {
      const score = row.fit_score;
      sum += score;
      if (score < min) min = score;
      if (score > max) max = score;
      if (score <= 20) buckets["0-20"]++;
      else if (score <= 40) buckets["21-40"]++;
      else if (score <= 60) buckets["41-60"]++;
      else if (score <= 80) buckets["61-80"]++;
      else buckets["81-100"]++;
    }

    const avg = (sum / fitData.length).toFixed(1);
    console.log(`\n📈 Fit Score Distribution:`);
    console.log(`   Average: ${avg} | Min: ${min} | Max: ${max}`);
    console.log(`   Total scored: ${fitData.length.toLocaleString()}`);

    for (const [range, count] of Object.entries(buckets)) {
      const pct = ((count / fitData.length) * 100).toFixed(1);
      const bar = "█".repeat(Math.round(parseFloat(pct) / 2));
      console.log(`   ${range.padEnd(8)} ${count.toLocaleString().padStart(8)} (${pct}%) ${bar}`);
    }
  }

  // Sample top investors
  const topInvestors = await query<any>(
    `SELECT full_name, email, investor_type, fit_score, outreach_readiness, country, data_quality_score
     FROM investors WHERE fit_score > 0 ORDER BY fit_score DESC LIMIT 10`
  );

  if (topInvestors.length > 0) {
    console.log(`\n🏆 Top 10 Investors by Fit Score:`);
    console.log("   " + "-".repeat(90));
    console.log(`   ${"Name".padEnd(22)} ${"Type".padEnd(20)} ${"Fit".padEnd(5)} ${"Readiness".padEnd(18)} ${"Country".padEnd(15)} ${"Quality"}`);
    console.log("   " + "-".repeat(90));
    for (const inv of topInvestors) {
      console.log(
        `   ${(inv.full_name || "Unknown").padEnd(22)} ` +
        `${(inv.investor_type || "—").padEnd(20)} ` +
        `${String(inv.fit_score).padEnd(5)} ` +
        `${(inv.outreach_readiness || "—").padEnd(18)} ` +
        `${(inv.country || "—").padEnd(15)} ` +
        `${inv.data_quality_score || "—"}`
      );
    }
  }

  console.log("\n" + "=".repeat(50));

  const coverage = totalCount ? ((scoredCount / totalCount) * 100) : 0;
  if (coverage >= 95) console.log("✅ PASS — Bulk qualification complete. 95%+ investors scored.");
  else if (coverage >= 80) console.log("⚠️  WARN — Coverage below 95%.");
  else console.log("❌ FAIL — Coverage too low.");

  await closePool();
}

verify().catch((err) => {
  console.error("❌ Verification failed:", err.message);
  process.exit(1);
});
