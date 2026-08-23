/**
 * Enable Row-Level Security (RLS) on all CockroachDB tables.
 *
 * Architecture:
 *   - A session variable `app.user_id` is set by the application before each query.
 *   - A helper function `app.current_user_id()` reads that variable.
 *   - Policies use the function to enforce tenant isolation.
 *
 * Table categories:
 *   1. User-owned: user_id = current user
 *   2. Company-owned: via company_profiles.user_id join
 *   3. Public/shared: no RLS (investors, firms, sectors, etc.)
 */

import { Pool } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();

  try {
    // ========================================
    // 0. Create app schema if needed
    // ========================================
    console.log("Creating app schema...");
    await client.query(`CREATE SCHEMA IF NOT EXISTS app`);
    console.log("  ✅ app schema ready");

    // ========================================
    // 1. Create session-setting helper
    // ========================================
    console.log("Creating app.current_user_id() helper function...");
    await client.query(`
      CREATE OR REPLACE FUNCTION app.current_user_id()
      RETURNS UUID
      LANGUAGE SQL
      STABLE
      AS $$
        SELECT nullif(current_setting('app.user_id', true), '')::uuid
      $$;
    `);
    console.log("  ✅ app.current_user_id() created");

    // ========================================
    // 2. User-owned tables (user_id = auth.uid)
    // ========================================
    const userOwnedTables = [
      "profiles",                // id = user id
      "company_profiles",        // user_id
      "saved_investors",         // user_id
      "email_accounts",          // user_id
      "email_messages",          // user_id
      "email_threads",           // user_id
      "email_tracking_events",   // user_id
      "campaign_sequences",      // user_id
      "campaign_sequence_enrollments", // user_id
      "campaign_sequence_emails",      // user_id
      "user_subscriptions",      // user_id
      "credit_ledger",           // user_id
      "background_jobs",         // user_id
      "billing_events",          // user_id
      "admin_audit_log",         // user_id
      "investor_search_history", // user_id
    ];

    console.log(`\nEnabling RLS on ${userOwnedTables.length} user-owned tables...`);

    for (const table of userOwnedTables) {
      // Enable RLS
      await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);

      // Drop existing policies (idempotent)
      const existingPolicies = await client.query(
        `SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = $1`,
        [table]
      );
      for (const row of existingPolicies.rows) {
        await client.query(`DROP POLICY IF EXISTS ${row.policyname} ON ${table}`);
      }

      // profiles uses id instead of user_id
      const userIdCol = table === "profiles" ? "id" : "user_id";

      // SELECT policy
      await client.query(`
        CREATE POLICY ${table}_select ON ${table}
          FOR SELECT
          USING (
            app.current_user_id() IS NOT NULL
            AND ${userIdCol} = app.current_user_id()
          )
      `);

      // INSERT policy
      await client.query(`
        CREATE POLICY ${table}_insert ON ${table}
          FOR INSERT
          WITH CHECK (
            app.current_user_id() IS NOT NULL
            AND ${userIdCol} = app.current_user_id()
          )
      `);

      // UPDATE policy
      await client.query(`
        CREATE POLICY ${table}_update ON ${table}
          FOR UPDATE
          USING (
            app.current_user_id() IS NOT NULL
            AND ${userIdCol} = app.current_user_id()
          )
          WITH CHECK (
            app.current_user_id() IS NOT NULL
            AND ${userIdCol} = app.current_user_id()
          )
      `);

      // DELETE policy
      await client.query(`
        CREATE POLICY ${table}_delete ON ${table}
          FOR DELETE
          USING (
            app.current_user_id() IS NOT NULL
            AND ${userIdCol} = app.current_user_id()
          )
      `);

      console.log(`  ✅ ${table} — SELECT/INSERT/UPDATE/DELETE policies`);
    }

    // ========================================
    // 3. data_acquisition_jobs uses created_by
    // ========================================
    console.log("\nEnabling RLS on data_acquisition_jobs (created_by)...");
    await client.query(`ALTER TABLE data_acquisition_jobs ENABLE ROW LEVEL SECURITY`);
    // Drop existing policies
    const existingDaqPolicies = await client.query(
      `SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'data_acquisition_jobs'`
    );
    for (const row of existingDaqPolicies.rows) {
      await client.query(`DROP POLICY IF EXISTS ${row.policyname} ON data_acquisition_jobs`);
    }
    for (const op of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
      const using = op === "INSERT" ? "WITH CHECK" : "USING";
      await client.query(`
        CREATE POLICY data_acquisition_jobs_${op.toLowerCase()} ON data_acquisition_jobs
          FOR ${op}
          ${using} (
            app.current_user_id() IS NOT NULL
            AND created_by = app.current_user_id()
          )
      `);
    }
    console.log("  ✅ data_acquisition_jobs — all policies");

    // ========================================
    // 4. Helper functions for cross-table ownership checks
    // ========================================
    console.log("\nCreating ownership helper functions...");
    
    // Check if user owns a company profile
    await client.query(`
      CREATE OR REPLACE FUNCTION app.user_owns_company(company_uuid UUID)
      RETURNS BOOLEAN
      LANGUAGE SQL
      STABLE
      AS $$
        SELECT EXISTS (
          SELECT 1 FROM company_profiles
          WHERE id = company_uuid AND user_id = app.current_user_id()
        );
      $$;
    `);
    console.log("  ✅ app.user_owns_company() created");

    // Check if user owns a campaign sequence
    await client.query(`
      CREATE OR REPLACE FUNCTION app.user_owns_sequence(seq_uuid UUID)
      RETURNS BOOLEAN
      LANGUAGE SQL
      STABLE
      AS $$
        SELECT EXISTS (
          SELECT 1 FROM campaign_sequences
          WHERE id = seq_uuid AND user_id = app.current_user_id()
        );
      $$;
    `);
    console.log("  ✅ app.user_owns_sequence() created");

    // ========================================
    // 5. Company-owned tables (via company_profiles)
    // ========================================
    const companyOwnedTables = [
      { table: "company_documents", fk: "company_id" },
      { table: "company_team_members", fk: "company_id" },
    ];

    console.log(`\nEnabling RLS on ${companyOwnedTables.length} company-owned tables...`);

    for (const { table, fk } of companyOwnedTables) {
      await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);

      const existingPolicies = await client.query(
        `SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = $1`,
        [table]
      );
      for (const row of existingPolicies.rows) {
        await client.query(`DROP POLICY IF EXISTS ${row.policyname} ON ${table}`);
      }

      const userCheck = `app.current_user_id() IS NOT NULL AND app.user_owns_company(${table}.${fk})`;

      await client.query(`CREATE POLICY ${table}_select ON ${table} FOR SELECT USING (${userCheck})`);
      await client.query(`CREATE POLICY ${table}_insert ON ${table} FOR INSERT WITH CHECK (${userCheck})`);
      await client.query(`CREATE POLICY ${table}_update ON ${table} FOR UPDATE USING (${userCheck}) WITH CHECK (${userCheck})`);
      await client.query(`CREATE POLICY ${table}_delete ON ${table} FOR DELETE USING (${userCheck})`);

      console.log(`  ✅ ${table} — company-owner policies via ${fk}`);
    }

    // ========================================
    // 6. Cascade-owned tables (owned via FK chain)
    // ========================================
    const cascadeOwnedTables = [
      { table: "campaign_sequence_steps", fk: "sequence_id" },
    ];

    console.log(`\nEnabling RLS on ${cascadeOwnedTables.length} cascade-owned tables...`);

    for (const { table, fk } of cascadeOwnedTables) {
      await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);

      const existingPolicies = await client.query(
        `SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = $1`,
        [table]
      );
      for (const row of existingPolicies.rows) {
        await client.query(`DROP POLICY IF EXISTS ${row.policyname} ON ${table}`);
      }

      const userCheck = `app.current_user_id() IS NOT NULL AND app.user_owns_sequence(${table}.${fk})`;

      for (const op of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
        const using = op === "INSERT" ? "WITH CHECK" : "USING";
        await client.query(`CREATE POLICY ${table}_${op.toLowerCase()} ON ${table} FOR ${op} ${using} (${userCheck})`);
      }
      console.log(`  ✅ ${table} — cascade policies via ${fk}`);
    }

    // ========================================
    // 6. Force RLS on all protected tables
    // ========================================
    const allProtected = [
      ...userOwnedTables,
      "data_acquisition_jobs",
      ...companyOwnedTables.map((t) => t.table as string),
      ...cascadeOwnedTables.map((t) => t.table as string),
    ];

    console.log(`\nEnforcing RLS (FORCE ROW LEVEL SECURITY) on ${allProtected.length} tables...`);
    for (const table of allProtected) {
      await client.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
    }
    console.log("  ✅ Force RLS enabled on all protected tables");

    // ========================================
    // 7. Summary
    // ========================================
    const rlsStatus = await client.query(`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    `);

    console.log("\n📊 Final RLS Status:");
    console.log("─".repeat(60));
    for (const row of rlsStatus.rows) {
      const rls = row.relrowsecurity ? "🔒 RLS" : "🔓 open";
      const force = row.relforcerowsecurity ? " (forced)" : "";
      console.log(`  ${rls}${force}  ${row.relname}`);
    }
    console.log("─".repeat(60));

    const protectedCount = rlsStatus.rows.filter((r) => r.relrowsecurity).length;
    const openCount = rlsStatus.rows.filter((r) => !r.relrowsecurity).length;
    console.log(`\n✅ ${protectedCount} tables with RLS, ${openCount} tables open (public/shared)\n`);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error("❌ FAILED:", e.message);
  process.exit(1);
});
