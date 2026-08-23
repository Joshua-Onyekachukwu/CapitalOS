// =============================================
// Capital OS — Verify Bulk Qualification Results
// =============================================
// Run: npx tsx src/scripts/verify-qualification.ts
// =============================================

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verify() {
  console.log("\n🔍 Verifying Bulk Qualification Results\n");
  console.log("=".repeat(50));

  // 1. Total investors
  const { count: total } = await supabase
    .from("investors")
    .select("id", { count: "exact", head: true });

  // 2. Scored vs unscored
  const { count: scored } = await supabase
    .from("investors")
    .select("id", { count: "exact", head: true })
    .gt("fit_score", 0);

  const { count: unscored } = await supabase
    .from("investors")
    .select("id", { count: "exact", head: true })
    .or("fit_score.eq.0,fit_score.is.null");

  console.log(`\n📊 Total Investors:    ${total?.toLocaleString()}`);
  console.log(`   Scored:            ${scored?.toLocaleString()}`);
  console.log(`   Unscored:          ${unscored?.toLocaleString()}`);
  console.log(`   Coverage:          ${total ? ((scored! / total) * 100).toFixed(1) : 0}%`);

  // 3. Outreach readiness breakdown
  const { data: readinessData } = await supabase
    .from("investors")
    .select("outreach_readiness")
    .gt("fit_score", 0);

  if (readinessData) {
    const breakdown: Record<string, number> = {};
    for (const row of readinessData) {
      const key = row.outreach_readiness || "unknown";
      breakdown[key] = (breakdown[key] || 0) + 1;
    }

    console.log("\n📧 Outreach Readiness Breakdown:");
    const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
    for (const [status, count] of sorted) {
      const pct = ((count / scored!) * 100).toFixed(1);
      const bar = "█".repeat(Math.round(parseFloat(pct) / 2));
      console.log(`   ${status.padEnd(20)} ${count.toLocaleString().padStart(8)} (${pct}%) ${bar}`);
    }
  }

  // 4. Fit score distribution
  const { data: fitData } = await supabase
    .from("investors")
    .select("fit_score")
    .gt("fit_score", 0);

  if (fitData) {
    const buckets = { "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0 };
    let sum = 0;
    let min = 101;
    let max = 0;

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

  // 5. Fit score breakdown JSONB check
  const { count: withBreakdown } = await supabase
    .from("investors")
    .select("id", { count: "exact", head: true })
    .gt("fit_score", 0)
    .not("fit_score_breakdown", "eq", "{}");

  console.log(`\n🧩 Fit Score Breakdown:`);
  console.log(`   With JSONB breakdown: ${withBreakdown?.toLocaleString()}`);

  // 6. Data quality score distribution
  const { data: qualityData } = await supabase
    .from("investors")
    .select("data_quality_score")
    .gt("fit_score", 0);

  if (qualityData) {
    const high = qualityData.filter(r => (r.data_quality_score || 0) >= 80).length;
    const medium = qualityData.filter(r => (r.data_quality_score || 0) >= 50 && (r.data_quality_score || 0) < 80).length;
    const low = qualityData.filter(r => (r.data_quality_score || 0) < 50).length;

    console.log(`\n✅ Data Quality Scores:`);
    console.log(`   High (80+):    ${high.toLocaleString()} (${((high / qualityData.length) * 100).toFixed(1)}%)`);
    console.log(`   Medium (50-79): ${medium.toLocaleString()} (${((medium / qualityData.length) * 100).toFixed(1)}%)`);
    console.log(`   Low (<50):     ${low.toLocaleString()} (${((low / qualityData.length) * 100).toFixed(1)}%)`);
  }

  // 7. Sample top investors
  const { data: topInvestors } = await supabase
    .from("investors")
    .select("full_name, email, investor_type, fit_score, outreach_readiness, country, data_quality_score")
    .gt("fit_score", 0)
    .order("fit_score", { ascending: false })
    .limit(10);

  if (topInvestors && topInvestors.length > 0) {
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

  // Summary
  const coverage = total ? ((scored! / total) * 100) : 0;
  if (coverage >= 95) {
    console.log("✅ PASS — Bulk qualification complete. 95%+ investors scored.");
  } else if (coverage >= 80) {
    console.log("⚠️  WARN — Coverage below 95%. Some investors may lack required fields.");
  } else {
    console.log("❌ FAIL — Coverage too low. Check the SQL ran correctly.");
  }

  console.log("");
}

verify().catch((err) => {
  console.error("❌ Verification failed:", err.message);
  process.exit(1);
});
