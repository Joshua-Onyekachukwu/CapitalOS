#!/usr/bin/env node
/**
 * Supabase Auth Migration Script
 * ================================
 * Exports all users (email/password, OAuth, metadata) from the OLD
 * Supabase project and imports them into a NEW Supabase project.
 *
 * This does NOT migrate database data — only authentication accounts.
 * Database data should be in CockroachDB already.
 *
 * PREREQUISITES:
 *   1. Create a new Supabase project at https://supabase.com
 *   2. Get the SERVICE_ROLE_KEY from the new project (Settings → API)
 *   3. Get the SERVICE_ROLE_KEY from the old project (if accessible)
 *   4. Set environment variables below
 *
 * USAGE:
 *   node scripts/migrate-supabase-auth.js
 *
 * ENV VARS NEEDED:
 *   OLD_SUPABASE_URL        — Old project URL (https://xxx.supabase.co)
 *   OLD_SUPABASE_SERVICE_KEY — Old project service role key
 *   NEW_SUPABASE_URL        — New project URL (https://yyy.supabase.co)
 *   NEW_SUPABASE_SERVICE_KEY — New project service role key
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });

const OLD_URL = process.env.OLD_SUPABASE_URL;
const OLD_KEY = process.env.OLD_SUPABASE_SERVICE_KEY;
const NEW_URL = process.env.NEW_SUPABASE_URL;
const NEW_KEY = process.env.NEW_SUPABASE_SERVICE_KEY;

async function supabaseAdmin(url, key) {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getAllUsers(admin) {
  const users = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error(`  ❌ Error listing users (page ${page}):`, error.message);
      break;
    }

    users.push(...data.users);
    console.log(`  📋 Fetched page ${page}: ${data.users.length} users (total: ${users.length})`);

    if (data.users.length < perPage) break;
    page++;
  }

  return users;
}

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  Supabase Auth Migration");
  console.log("═══════════════════════════════════════════════\n");

  // Validate env vars
  if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY) {
    console.error("❌ Missing environment variables. Set these in .env.local:\n");
    console.error("  OLD_SUPABASE_URL=https://old-project.supabase.co");
    console.error("  OLD_SUPABASE_SERVICE_KEY=eyJ...");
    console.error("  NEW_SUPABASE_URL=https://new-project.supabase.co");
    console.error("  NEW_SUPABASE_SERVICE_KEY=eyJ...");
    process.exit(1);
  }

  console.log("📤 Step 1: Connecting to OLD Supabase project...");
  const oldAdmin = await supabaseAdmin(OLD_URL, OLD_KEY);

  console.log("📥 Step 2: Connecting to NEW Supabase project...");
  const newAdmin = await supabaseAdmin(NEW_URL, NEW_KEY);

  // ── Export users from old project ──
  console.log("\n📋 Step 3: Fetching users from old project...\n");
  const users = await getAllUsers(oldAdmin);

  if (users.length === 0) {
    console.log("  ⚠️  No users found in old project. Nothing to migrate.");
    return;
  }

  console.log(`\n  ✅ Found ${users.length} users in old project\n`);

  // ── Categorize users ──
  const emailUsers = users.filter((u) => u.email);
  const phoneUsers = users.filter((u) => !u.email && u.phone);
  const oauthUsers = users.filter((u) => u.app_metadata?.provider && u.app_metadata.provider !== "email");

  console.log(`  📊 Breakdown:`);
  console.log(`     Email/password: ${emailUsers.length}`);
  console.log(`     Phone auth: ${phoneUsers.length}`);
  console.log(`     OAuth: ${oauthUsers.length}\n`);

  // ── Import users into new project ──
  console.log("📥 Step 4: Importing users into new project...\n");

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of users) {
    const email = user.email || `${user.phone || user.id}@migrated.supabase`;

    try {
      // Create user with admin API (preserves metadata, roles, etc.)
      const { data, error } = await newAdmin.auth.admin.createUser({
        email: email,
        email_confirm: true, // Auto-confirm since they were already verified
        user_metadata: user.user_metadata || {},
        app_metadata: user.app_metadata || {},
      });

      if (error) {
        if (error.message.includes("already exists")) {
          skipped++;
          console.log(`  ⏭️  ${email} — already exists (skipped)`);
        } else {
          errors++;
          console.log(`  ❌ ${email} — ${error.message}`);
        }
      } else {
        created++;
        if (created % 50 === 0) {
          console.log(`  ✅ ...${created} users imported so far`);
        }
      }
    } catch (err) {
      errors++;
      console.log(`  ❌ ${email} — ${err.message}`);
    }
  }

  // ── Summary ──
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Migration Complete!");
  console.log("═══════════════════════════════════════════════");
  console.log(`  📊 Total users:     ${users.length}`);
  console.log(`  ✅ Created:         ${created}`);
  console.log(`  ⏭️  Skipped:         ${skipped}`);
  console.log(`  ❌ Errors:          ${errors}`);
  console.log("═══════════════════════════════════════════════\n");

  if (errors > 0) {
    console.log("⚠️  Some users failed to migrate. Check the output above.");
    console.log("    They may need to be created manually or re-signed-up.");
  }

  console.log("📋 NEXT STEPS:");
  console.log("  1. Update .env.local with the new Supabase project URL and keys:");
  console.log("     NEXT_PUBLIC_SUPABASE_URL=" + NEW_URL);
  console.log("     NEXT_PUBLIC_SUPABASE_ANON_KEY=<new-anon-key>");
  console.log("     SUPABASE_SERVICE_ROLE_KEY=" + NEW_KEY.slice(0, 20) + "...");
  console.log("  2. Restart the dev server");
  console.log("  3. Test login with an existing account");
}

main().catch((err) => {
  console.error("\n💥 Fatal error:", err.message);
  process.exit(1);
});
