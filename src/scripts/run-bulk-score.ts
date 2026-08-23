// =============================================
// Run Bulk Scoring via Supabase RPC
// =============================================
// Creates the scoring function and executes it.
// Run: npx tsx src/scripts/run-bulk-score.ts
// =============================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("🔧 Creating scoring function in Supabase...\n");
  
  // Read the SQL file
  const sqlPath = resolve(__dirname, "qualify-bulk.sql");
  const sql = readFileSync(sqlPath, "utf-8");
  
  // Split into function creation and UPDATE statement
  // The SQL has two parts: CREATE FUNCTION and then UPDATE
  const parts = sql.split("-- Step 2:");
  
  // First, try to create the function via RPC
  // We'll use the Supabase SQL endpoint directly
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY!,
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  
  if (!response.ok) {
    console.log("⚠️  Direct SQL not available. Trying alternative approach...\n");
    
    // Alternative: Run the UPDATE directly via individual SQL statements
    // Split the SQL into the function creation and the UPDATE
    const functionSql = `
CREATE OR REPLACE FUNCTION public.score_investors_bulk()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.investors
  SET 
    data_quality_score = LEAST(100, (
      (CASE WHEN email IS NOT NULL THEN 12 ELSE 0 END) +
      (CASE WHEN linkedin_url IS NOT NULL THEN 12 ELSE 0 END) +
      (CASE WHEN job_title IS NOT NULL THEN 12 ELSE 0 END) +
      (CASE WHEN investment_stages IS NOT NULL AND array_length(investment_stages, 1) > 0 THEN 12 ELSE 0 END) +
      (CASE WHEN investment_sectors IS NOT NULL AND array_length(investment_sectors, 1) > 0 THEN 12 ELSE 0 END) +
      (CASE WHEN bio IS NOT NULL AND length(bio) > 0 THEN 13 ELSE 0 END) +
      (CASE WHEN country IS NOT NULL THEN 13 ELSE 0 END) +
      (CASE WHEN city IS NOT NULL THEN 13 ELSE 0 END)
    )),
    outreach_readiness = CASE
      WHEN do_not_contact = true THEN 'do_not_contact'::outreach_readiness
      WHEN (
        (CASE WHEN email IS NOT NULL THEN 30 ELSE 0 END) +
        (CASE WHEN linkedin_url IS NOT NULL THEN 20 ELSE 0 END) +
        (CASE WHEN is_verified = true THEN 15 ELSE 0 END) +
        (CASE WHEN bio IS NOT NULL AND length(bio) > 50 THEN 10 ELSE 0 END)
      ) >= 70 THEN 'ready'::outreach_readiness
      WHEN (
        (CASE WHEN email IS NOT NULL THEN 30 ELSE 0 END) +
        (CASE WHEN linkedin_url IS NOT NULL THEN 20 ELSE 0 END) +
        (CASE WHEN is_verified = true THEN 15 ELSE 0 END) +
        (CASE WHEN bio IS NOT NULL AND length(bio) > 50 THEN 10 ELSE 0 END)
      ) >= 40 THEN 'needs_verification'::outreach_readiness
      ELSE 'not_ready'::outreach_readiness
    END,
    fit_score = ROUND(
      (CASE 
        WHEN investment_sectors @> ARRAY['saas'] OR investment_sectors @> ARRAY['enterprise'] OR investment_sectors @> ARRAY['b2b'] THEN 100
        WHEN investment_sectors && ARRAY['ai','ml','datascience'] THEN 85
        WHEN investment_sectors && ARRAY['fintech','payments','banking'] THEN 85
        WHEN investment_sectors && ARRAY['saas','enterprise','b2b','software','cloud','devtools'] THEN 85
        WHEN investment_sectors && ARRAY['healthtech','healthcare','biotech'] THEN 85
        WHEN investment_sectors && ARRAY['consumer','b2c','marketplace','ecommerce'] THEN 85
        WHEN investment_sectors IS NOT NULL AND array_length(investment_sectors, 1) > 0 THEN 50
        ELSE 30
      END * 0.25) +
      (CASE
        WHEN investment_stages @> ARRAY['seed'] THEN 100
        WHEN investment_stages && ARRAY['pre_seed'] THEN 75
        WHEN investment_stages && ARRAY['series_a'] THEN 75
        WHEN investment_stages && ARRAY['series_b'] THEN 40
        WHEN investment_stages IS NOT NULL AND array_length(investment_stages, 1) > 0 THEN 50
        ELSE 40
      END * 0.20) +
      (CASE
        WHEN lower(country) = 'united states' THEN 100
        WHEN investment_geographies && ARRAY['United States'] THEN 100
        WHEN investment_geographies && ARRAY['Global'] THEN 90
        WHEN country IS NOT NULL THEN 30
        ELSE 40
      END * 0.15) +
      (CASE WHEN min_check_size IS NOT NULL OR max_check_size IS NOT NULL THEN 70 ELSE 50 END * 0.10) +
      (LEAST(100, (
        (CASE WHEN email IS NOT NULL THEN 12 ELSE 0 END) +
        (CASE WHEN linkedin_url IS NOT NULL THEN 12 ELSE 0 END) +
        (CASE WHEN job_title IS NOT NULL THEN 12 ELSE 0 END) +
        (CASE WHEN investment_stages IS NOT NULL AND array_length(investment_stages, 1) > 0 THEN 12 ELSE 0 END) +
        (CASE WHEN investment_sectors IS NOT NULL AND array_length(investment_sectors, 1) > 0 THEN 12 ELSE 0 END) +
        (CASE WHEN bio IS NOT NULL AND length(bio) > 0 THEN 13 ELSE 0 END) +
        (CASE WHEN country IS NOT NULL THEN 13 ELSE 0 END) +
        (CASE WHEN city IS NOT NULL THEN 13 ELSE 0 END)
      )) * 0.10) +
      (LEAST(100, (
        (CASE WHEN email IS NOT NULL THEN 30 ELSE 0 END) +
        (CASE WHEN linkedin_url IS NOT NULL THEN 20 ELSE 0 END) +
        (CASE WHEN is_verified = true THEN 15 ELSE 0 END) +
        (CASE WHEN bio IS NOT NULL AND length(bio) > 50 THEN 10 ELSE 0 END)
      )) * 0.10) +
      (50 * 0.05) +
      (CASE 
        WHEN bio IS NOT NULL AND length(bio) > 50 THEN 80
        WHEN bio IS NOT NULL THEN 40
        ELSE 20
      END * 0.05)
    ),
    fit_score_breakdown = jsonb_build_object(
      'factors', jsonb_build_array(
        jsonb_build_object('factor', 'Sector Match', 'weight', 0.25),
        jsonb_build_object('factor', 'Stage Match', 'weight', 0.20),
        jsonb_build_object('factor', 'Geography Match', 'weight', 0.15),
        jsonb_build_object('factor', 'Check Size Fit', 'weight', 0.10),
        jsonb_build_object('factor', 'Data Completeness', 'weight', 0.10),
        jsonb_build_object('factor', 'Contactability', 'weight', 0.10),
        jsonb_build_object('factor', 'Recent Activity', 'weight', 0.05),
        jsonb_build_object('factor', 'Profile Depth', 'weight', 0.05)
      ),
      'confidence', LEAST(100, (
        (CASE WHEN email IS NOT NULL THEN 12 ELSE 0 END) +
        (CASE WHEN linkedin_url IS NOT NULL THEN 12 ELSE 0 END) +
        (CASE WHEN job_title IS NOT NULL THEN 12 ELSE 0 END) +
        (CASE WHEN investment_stages IS NOT NULL AND array_length(investment_stages, 1) > 0 THEN 12 ELSE 0 END) +
        (CASE WHEN investment_sectors IS NOT NULL AND array_length(investment_sectors, 1) > 0 THEN 12 ELSE 0 END) +
        (CASE WHEN bio IS NOT NULL AND length(bio) > 0 THEN 13 ELSE 0 END) +
        (CASE WHEN country IS NOT NULL THEN 13 ELSE 0 END) +
        (CASE WHEN city IS NOT NULL THEN 13 ELSE 0 END)
      )),
      'dataQuality', LEAST(100, (
        (CASE WHEN email IS NOT NULL THEN 12 ELSE 0 END) +
        (CASE WHEN linkedin_url IS NOT NULL THEN 12 ELSE 0 END) +
        (CASE WHEN job_title IS NOT NULL THEN 12 ELSE 0 END) +
        (CASE WHEN investment_stages IS NOT NULL AND array_length(investment_stages, 1) > 0 THEN 12 ELSE 0 END) +
        (CASE WHEN investment_sectors IS NOT NULL AND array_length(investment_sectors, 1) > 0 THEN 12 ELSE 0 END) +
        (CASE WHEN bio IS NOT NULL AND length(bio) > 0 THEN 13 ELSE 0 END) +
        (CASE WHEN country IS NOT NULL THEN 13 ELSE 0 END) +
        (CASE WHEN city IS NOT NULL THEN 13 ELSE 0 END)
      ))
    )
  WHERE fit_score = 0 OR fit_score IS NULL;
END;
$$;`;

    // Try creating the function
    console.log("📝 Creating score_investors_bulk() function...");
    const { error: createErr } = await supabase.rpc("exec_sql" as any, { query: functionSql });
    
    if (createErr) {
      console.log("⚠️  Cannot create function via RPC. Printing SQL for manual execution.\n");
      console.log("═══════════════════════════════════════════════════════════════");
      console.log("PASTE THIS INTO SUPABASE SQL EDITOR:");
      console.log("═══════════════════════════════════════════════════════════════\n");
      console.log(functionSql);
      console.log("\n═══════════════════════════════════════════════════════════════");
      console.log("THEN RUN: SELECT score_investors_bulk();");
      console.log("═══════════════════════════════════════════════════════════════\n");
      return;
    }
    
    console.log("✅ Function created!\n");
  }
  
  // Now call the function
  console.log("🚀 Running bulk scoring on all investors...");
  const startTime = Date.now();
  
  const { data, error } = await supabase.rpc("score_investors_bulk");
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  if (error) {
    console.error("❌ Scoring failed:", error.message);
    return;
  }
  
  console.log(`✅ Bulk scoring complete in ${elapsed}s!\n`);
  
  // Get results
  const { count: readyCount } = await supabase.from("investors").select("id", { count: "exact", head: true }).eq("outreach_readiness", "ready");
  const { count: needsReview } = await supabase.from("investors").select("id", { count: "exact", head: true }).eq("outreach_readiness", "needs_verification");
  const { count: notReady } = await supabase.from("investors").select("id", { count: "exact", head: true }).eq("outreach_readiness", "not_ready");
  
  const { count: highFit } = await supabase
    .from("investors")
    .select("id", { count: "exact", head: true })
    .gte("fit_score", 80);
  
  const { count: medFit } = await supabase
    .from("investors")
    .select("id", { count: "exact", head: true })
    .gte("fit_score", 50)
    .lt("fit_score", 80);
  
  console.log("📊 Results:");
  console.log(`   🟢 Ready:      ${readyCount?.toLocaleString() || 0}`);
  console.log(`   🟡 Needs review: ${needsReview?.toLocaleString() || 0}`);
  console.log(`   ⚪ Not ready:  ${notReady?.toLocaleString() || 0}`);
  console.log(`   ⭐ High fit (80+): ${highFit?.toLocaleString() || 0}`);
  console.log(`   🔵 Medium fit (50-79): ${medFit?.toLocaleString() || 0}\n`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
