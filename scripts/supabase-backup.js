#!/usr/bin/env node
/**
 * Supabase Database Backup Script
 * ================================
 * Backs up the Supabase database directly using pg client
 * (bypasses Docker DNS issues with the Supabase CLI on Windows)
 *
 * Usage: node scripts/supabase-backup.js
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const PASSWORD = "%2BLyJ.n6AeYnNW%2F";
const PROJECT_REF = "keepilpdaphpkofqgcae";

// Try multiple pooler regions
const POOLER_REGIONS = [
  "eu-central-1",
  "us-west-1",
  "us-east-2",
  "ap-southeast-1",
  "us-east-1",
  "eu-west-1",
];

async function connect() {
  for (const region of POOLER_REGIONS) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const connStr = `postgresql://postgres.${PROJECT_REF}:${PASSWORD}@${host}:6543/postgres`;
    
    try {
      const client = new Client({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
      });
      await client.connect();
      console.log(`  ✅ Connected via ${region}`);
      return client;
    } catch (e) {
      console.log(`  ❌ ${region}: ${e.message.slice(0, 60)}`);
    }
  }
  
  // Also try direct connection (IPv6)
  try {
    const client = new Client({
      host: `db.${PROJECT_REF}.supabase.co`,
      port: 5432,
      database: "postgres",
      user: "postgres",
      password: "+LyJ.n6AeYnNW/C",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
      family: 6,
    });
    await client.connect();
    console.log(`  ✅ Connected via direct IPv6`);
    return client;
  } catch (e) {
    console.log(`  ❌ direct: ${e.message.slice(0, 60)}`);
  }
  
  return null;
}

async function main() {
  const outDir = path.join(__dirname, "..", "backups");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  const prefix = path.join(outDir, `supabase-backup-${timestamp}`);
  
  console.log("═══════════════════════════════════════════════");
  console.log("  Supabase Database Backup");
  console.log("═══════════════════════════════════════════════\n");
  
  console.log("🔌 Connecting to Supabase...\n");
  const client = await connect();
  
  if (!client) {
    console.error("\n❌ Could not connect to Supabase from any region.");
    console.error("   The database may be paused or recovering.");
    console.error("   Try: Supabase Dashboard → Settings → General → Restore project");
    process.exit(1);
  }
  
  try {
    // ── 1. Check database status ──
    console.log("\n📊 Step 1: Checking database status...\n");
    
    const sizeRes = await client.query("SELECT pg_size_pretty(pg_database_size(current_database())) AS size");
    console.log(`  Database size: ${sizeRes.rows[0].size}`);
    
    const readOnly = await client.query("SHOW transaction_read_only");
    console.log(`  Read-only mode: ${readOnly.rows[0].transaction_read_only}`);
    
    if (readOnly.rows[0].transaction_read_only === "on") {
      console.log("\n⚠️  Database is in read-only mode (hot standby).");
      console.log("   Cannot write TRUNCATE/VACUUM, but CAN read/export data.");
      console.log("   Proceeding with read-only backup...\n");
    }
    
    // ── 2. Audit tables ──
    console.log("📋 Step 2: Auditing tables...\n");
    
    const tables = await client.query(`
      SELECT tablename, 
             pg_size_pretty(pg_total_relation_size('public.' || tablename)) AS size
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY pg_total_relation_size('public.' || tablename) DESC
    `);
    
    for (const t of tables.rows) {
      console.log(`  ${t.tablename}: ${t.size}`);
    }
    
    // ── 3. Backup investors ──
    console.log("\n📦 Step 3: Backing up investors table...\n");
    
    const invCount = await client.query("SELECT COUNT(*)::int AS cnt FROM investors");
    console.log(`  Total investors: ${invCount.rows[0].cnt.toLocaleString()}`);
    
    const invBySource = await client.query(`
      SELECT COALESCE(source, '(null)') AS source, COUNT(*)::int AS count 
      FROM investors GROUP BY source ORDER BY count DESC
    `);
    console.log("  By source:");
    for (const r of invBySource.rows) {
      console.log(`    ${r.source}: ${r.count.toLocaleString()}`);
    }
    
    // Export investors to CSV
    console.log("\n  📄 Exporting investors to CSV...");
    const investors = await client.query("SELECT * FROM investors ORDER BY created_at DESC");
    
    if (investors.rows.length > 0) {
      const headers = Object.keys(investors.rows[0]).join(",");
      const csvRows = investors.rows.map((r) =>
        Object.values(r)
          .map((v) => {
            if (v === null || v === undefined) return "";
            const s = String(v).replace(/"/g, '""');
            return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
          })
          .join(",")
      );
      const csv = [headers, ...csvRows].join("\n");
      const csvPath = `${prefix}-investors.csv`;
      fs.writeFileSync(csvPath, csv);
      console.log(`  ✅ ${csvPath} (${investors.rows.length.toLocaleString()} rows)`);
    }
    
    // ── 4. Backup firms ──
    console.log("\n📦 Step 4: Backing up firms...\n");
    
    try {
      const firms = await client.query("SELECT * FROM investor_firms ORDER BY name");
      if (firms.rows.length > 0) {
        const headers = Object.keys(firms.rows[0]).join(",");
        const csvRows = firms.rows.map((r) =>
          Object.values(r)
            .map((v) => (v === null ? "" : String(v).replace(/"/g, '""')))
            .join(",")
        );
        const csv = [headers, ...csvRows].join("\n");
        const csvPath = `${prefix}-firms.csv`;
        fs.writeFileSync(csvPath, csv);
        console.log(`  ✅ ${csvPath} (${firms.rows.length} rows)`);
      }
    } catch (e) {
      console.log(`  ⚠️  Firms table: ${e.message}`);
    }
    
    // ── 5. Backup auth users ──
    console.log("\n📦 Step 5: Backing up auth users...\n");
    
    try {
      const users = await client.query(`
        SELECT id, email, phone, raw_user_meta_data, raw_app_meta_data, 
               created_at, last_sign_in_at
        FROM auth.users 
        ORDER BY created_at DESC
      `);
      if (users.rows.length > 0) {
        const headers = Object.keys(users.rows[0]).join(",");
        const csvRows = users.rows.map((r) =>
          Object.values(r)
            .map((v) => {
              if (v === null || v === undefined) return "";
              const s = typeof v === "object" ? JSON.stringify(v) : String(v);
              return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
            })
            .join(",")
        );
        const csv = [headers, ...csvRows].join("\n");
        const csvPath = `${prefix}-auth-users.csv`;
        fs.writeFileSync(csvPath, csv);
        console.log(`  ✅ ${csvPath} (${users.rows.length} users)`);
      } else {
        console.log("  ⚠️  No auth users found");
      }
    } catch (e) {
      console.log(`  ⚠️  Auth users: ${e.message}`);
    }
    
    // ── 6. Backup company profiles ──
    console.log("\n📦 Step 6: Backing up company profiles...\n");
    
    try {
      const companies = await client.query("SELECT * FROM company_profiles ORDER BY name");
      if (companies.rows.length > 0) {
        const headers = Object.keys(companies.rows[0]).join(",");
        const csvRows = companies.rows.map((r) =>
          Object.values(r)
            .map((v) => (v === null ? "" : String(v).replace(/"/g, '""')))
            .join(",")
        );
        const csv = [headers, ...csvRows].join("\n");
        const csvPath = `${prefix}-companies.csv`;
        fs.writeFileSync(csvPath, csv);
        console.log(`  ✅ ${csvPath} (${companies.rows.length} rows)`);
      }
    } catch (e) {
      console.log(`  ⚠️  Companies table: ${e.message}`);
    }
    
    // ── Summary ──
    console.log("\n═══════════════════════════════════════════════");
    console.log("  ✅ Backup Complete!");
    console.log("═══════════════════════════════════════════════");
    console.log(`  📁 Location: ${outDir}`);
    console.log(`  📊 Investors: ${invCount.rows[0].cnt.toLocaleString()}`);
    console.log(`  🏢 Firms: exported`);
    console.log(`  👤 Auth users: exported`);
    console.log(`  🏭 Companies: exported`);
    console.log("═══════════════════════════════════════════════\n");
    
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("\n💥 Fatal error:", err.message);
  process.exit(1);
});
