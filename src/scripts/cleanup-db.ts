// =============================================
// Capital OS — Database Cleanup Script
// =============================================
// Reduces database size by removing low-value data.
// Run: npx tsx src/scripts/cleanup-db.ts [action]
// Actions: audit, clean, compact
// =============================================

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const action = process.argv[2] || "audit";

async function audit() {
  console.log("\n📊 Database Audit\n");
  console.log("=".repeat(50));

  // 1. Count records per table
  const tables = [
    "investors", "investor_firms", "investor_employment_history",
    "investor_profiles", "investor_data_sources", "data_change_log",
    "email_messages", "email_accounts", "email_tracking_events",
    "campaign_sequence_emails", "campaign_sequence_enrollments",
    "company_profiles", "company_documents", "company_team_members",
    "billing_usage", "audit_log",
  ];

  console.log("\n📋 Record Counts:");
  for (const table of tables) {
    try {
      const { count } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true });
      console.log(`   ${table.padEnd(35)} ${(count || 0).toLocaleString()}`);
    } catch {
      console.log(`   ${table.padEnd(35)} (table not found)`);
    }
  }

  // 2. Analyze investors breakdown
  console.log("\n🔍 Investors Breakdown:");

  // By source
  const { data: sources } = await supabase
    .from("investors")
    .select("source")
    .limit(10000);

  if (sources) {
    const sourceCounts: Record<string, number> = {};
    for (const s of sources) {
      sourceCounts[s.source || "unknown"] = (sourceCounts[s.source || "unknown"] || 0) + 1;
    }
    console.log("   By source (sampled 10K):");
    for (const [source, count] of Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`     ${source.padEnd(20)} ${count}`);
    }
  }

  // With/without email
  const { count: withEmail } = await supabase
    .from("investors")
    .select("id", { count: "exact", head: true })
    .not("email", "is", null)
    .neq("email", "");

  const { count: total } = await supabase
    .from("investors")
    .select("id", { count: "exact", head: true });

  console.log(`\n   Total investors:    ${total?.toLocaleString()}`);
  console.log(`   With email:         ${withEmail?.toLocaleString()}`);
  console.log(`   Without email:      ${((total || 0) - (withEmail || 0)).toLocaleString()}`);

  // 3. Estimate table sizes
  console.log("\n📏 Estimated Table Sizes (from row counts):");
  const estimatedSizes = [
    { table: "investors", rows: total || 0, avgRowBytes: 2000, label: "~2KB/row (arrays, bio, etc.)" },
    { table: "investor_firms", rows: 0, avgRowBytes: 1500, label: "~1.5KB/row" },
    { table: "investor_employment_history", rows: 0, avgRowBytes: 300, label: "~300B/row" },
  ];

  for (const est of estimatedSizes) {
    const { count } = await supabase
      .from(est.table)
      .select("id", { count: "exact", head: true });
    est.rows = count || 0;
    const sizeMB = (est.rows * est.avgRowBytes / 1024 / 1024).toFixed(1);
    console.log(`   ${est.table.padEnd(30)} ${est.rows.toLocaleString().padStart(10)} rows  ~${sizeMB} MB  (${est.label})`);
  }

  console.log("\n" + "=".repeat(50));
  console.log("\n💡 To reduce size, run: npx tsx src/scripts/cleanup-db.ts clean");
}

async function clean() {
  console.log("\n🧹 Database Cleanup\n");
  console.log("=".repeat(50));

  // Strategy: Remove low-value investors to get under 0.5 GB
  // Keep: investors with emails, verified investors, high fit scores
  // Remove: generated investors without email/LinkedIn, low quality

  let totalDeleted = 0;

  // 1. Delete investors with no email AND no LinkedIn (low value)
  console.log("\n1️⃣  Removing investors with no email AND no LinkedIn...");
  const { count: noContact } = await supabase
    .from("investors")
    .select("id", { count: "exact", head: true })
    .is("email", null)
    .is("linkedin_url", null);

  if (noContact && noContact > 0) {
    // Delete in batches
    const BATCH = 5000;
    let deleted = 0;
    while (deleted < noContact) {
      const { data: batch } = await supabase
        .from("investors")
        .select("id")
        .is("email", null)
        .is("linkedin_url", null)
        .limit(BATCH);

      if (!batch || batch.length === 0) break;

      const ids = batch.map((r) => r.id);
      const { error } = await supabase
        .from("investors")
        .delete()
        .in("id", ids);

      if (error) {
        console.error(`   ⚠️  Batch delete error: ${error.message}`);
        break;
      }

      deleted += ids.length;
      console.log(`   📥 Deleted ${deleted} / ${noContact}`);
    }
    totalDeleted += deleted;
    console.log(`   ✅ Removed ${deleted} investors with no contact info`);
  } else {
    console.log("   ✅ No records to remove");
  }

  // 2. Remove duplicate generated investors (same email)
  console.log("\n2️⃣  Removing duplicate emails...");
  let dupesHandled = false;
  try {
    await supabase.rpc("exec_sql" as any, {
      sql: `
        DELETE FROM public.investors
        WHERE id IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rn
            FROM public.investors
            WHERE email IS NOT NULL AND email != ''
          ) t WHERE rn > 1
        )
      `
    });
    dupesHandled = true;
  } catch {
    // Fallback to JS-based dedup
  }

  // Fallback: do it in JS
  if (!dupesHandled) {
    console.log("   Using JS-based dedup...");
    const { data: allWithEmail } = await supabase
      .from("investors")
      .select("id, email")
      .not("email", "is", null)
      .neq("email", "")
      .order("created_at", { ascending: false })
      .limit(50000);

    if (allWithEmail) {
      const seen = new Map<string, string>();
      const dupeIds: string[] = [];
      for (const inv of allWithEmail) {
        const email = inv.email.toLowerCase().trim();
        if (seen.has(email)) {
          dupeIds.push(inv.id);
        } else {
          seen.set(email, inv.id);
        }
      }

      if (dupeIds.length > 0) {
        const BATCH = 5000;
        for (let i = 0; i < dupeIds.length; i += BATCH) {
          const batch = dupeIds.slice(i, i + BATCH);
          await supabase.from("investors").delete().in("id", batch);
        }
        totalDeleted += dupeIds.length;
        console.log(`   ✅ Removed ${dupeIds.length} duplicate email records`);
      } else {
        console.log("   ✅ No duplicates found");
      }
    }
  }

  // 3. Remove investors with fit_score = 0 AND no email (never scored, no value)
  console.log("\n3️⃣  Removing unscored investors with no email...");
  const { count: unscoredNoEmail } = await supabase
    .from("investors")
    .select("id", { count: "exact", head: true })
    .eq("fit_score", 0)
    .is("email", null);

  if (unscoredNoEmail && unscoredNoEmail > 0) {
    const BATCH = 5000;
    let deleted = 0;
    while (deleted < unscoredNoEmail) {
      const { data: batch } = await supabase
        .from("investors")
        .select("id")
        .eq("fit_score", 0)
        .is("email", null)
        .limit(BATCH);

      if (!batch || batch.length === 0) break;

      await supabase.from("investors").delete().in("id", batch.map((r) => r.id));
      deleted += batch.length;
      console.log(`   📥 Deleted ${deleted} / ${unscoredNoEmail}`);
    }
    totalDeleted += deleted;
    console.log(`   ✅ Removed ${deleted} unscored investors with no email`);
  } else {
    console.log("   ✅ No records to remove");
  }

  // 4. Clean up old data_change_log records (keep last 30 days)
  console.log("\n4️⃣  Cleaning old change logs...");
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { count: oldLogs } = await supabase
    .from("data_change_log")
    .select("id", { count: "exact", head: true })
    .lt("created_at", thirtyDaysAgo);

  if (oldLogs && oldLogs > 0) {
    await supabase
      .from("data_change_log")
      .delete()
      .lt("created_at", thirtyDaysAgo);
    totalDeleted += oldLogs;
    console.log(`   ✅ Removed ${oldLogs} old change log entries`);
  } else {
    console.log("   ✅ No old logs to remove");
  }

  // 5. Clean up old raw records
  console.log("\n5️⃣  Cleaning old raw acquisition records...");
  const { count: oldRaw } = await supabase
    .from("raw_acquisition_records")
    .select("id", { count: "exact", head: true })
    .eq("processing_status", "error");

  if (oldRaw && oldRaw > 0) {
    const BATCH = 5000;
    let deleted = 0;
    while (deleted < oldRaw) {
      const { data: batch } = await supabase
        .from("raw_acquisition_records")
        .select("id")
        .eq("processing_status", "error")
        .limit(BATCH);

      if (!batch || batch.length === 0) break;

      await supabase.from("raw_acquisition_records").delete().in("id", batch.map((r) => r.id));
      deleted += batch.length;
    }
    totalDeleted += deleted;
    console.log(`   ✅ Removed ${deleted} failed raw records`);
  } else {
    console.log("   ✅ No failed raw records to remove");
  }

  console.log("\n" + "=".repeat(50));
  console.log(`\n🎉 Cleanup complete! Total records removed: ${totalDeleted.toLocaleString()}`);
  console.log("\n💡 Run 'npx tsx src/scripts/cleanup-db.ts audit' to verify sizes.");
  console.log("💡 Then run VACUUM in Supabase SQL Editor: VACUUM (VERBOSE, ANALYZE) public.investors;");
}

async function compact() {
  console.log("\n🔧 Compacting Tables\n");
  console.log("=".repeat(50));
  console.log("\nRun these in Supabase SQL Editor to reclaim space:\n");
  console.log("VACUUM (VERBOSE, ANALYZE) public.investors;");
  console.log("VACUUM (VERBOSE, ANALYZE) public.investor_firms;");
  console.log("VACUUM (VERBOSE, ANALYZE) public.investor_employment_history;");
  console.log("VACUUM (VERBOSE, ANALYZE) public.raw_acquisition_records;");
  console.log("VACUUM (VERBOSE, ANALYZE) public.data_change_log;");
  console.log("VACUUM (VERBOSE, ANALYZE) public.email_messages;");
  console.log("\nNote: VACUUM reclaims storage from deleted rows.");
  console.log("After VACUUM, check database size in Supabase dashboard.\n");
}

// Run
if (action === "audit") await audit();
else if (action === "clean") await clean();
else if (action === "compact") await compact();
else {
  console.log("Usage: npx tsx src/scripts/cleanup-db.ts [audit|clean|compact]");
}
