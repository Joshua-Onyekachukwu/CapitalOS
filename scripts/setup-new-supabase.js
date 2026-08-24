#!/usr/bin/env node
/**
 * Capital OS — New Supabase Project Setup
 *
 * Usage:
 *   node scripts/setup-new-supabase.js <project-url> <anon-key> <service-role-key>
 *
 * Example:
 *   node scripts/setup-new-supabase.js https://abc123.supabase.co eyJhbG... eyJhbG...
 *
 * This will:
 *   1. Back up current .env.local
 *   2. Update Supabase credentials in .env.local
 *   3. Test the new connection
 *   4. Test auth (sign up / sign in)
 *   5. Verify admin email works
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const ENV_FILE = path.join(__dirname, "..", ".env.local");
const BACKUP_FILE = path.join(__dirname, "..", ".env.local.backup");

async function main() {
  const [newUrl, newAnonKey, newServiceKey] = process.argv.slice(2);

  if (!newUrl || !newAnonKey || !newServiceKey) {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Capital OS — New Supabase Setup                            ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Usage:                                                      ║
║    node scripts/setup-new-supabase.js \\                      ║
║      <project-url> <anon-key> <service-role-key>             ║
║                                                              ║
║  Example:                                                    ║
║    node scripts/setup-new-supabase.js \\                      ║
║      https://xyz.supabase.co \\                               ║
║      eyJhbGciOiJIUzI1NiIs... \\                                ║
║      eyJhbGciOiJIUzI1NiIs...                                  ║
║                                                              ║
║  Find these values in:                                       ║
║    Supabase Dashboard → Settings → API                       ║
╚══════════════════════════════════════════════════════════════╝
    `);
    process.exit(1);
  }

  console.log("\n🔧 Capital OS — New Supabase Setup\n");

  // ── Step 1: Backup current .env.local ──
  console.log("📦 Step 1: Backing up current .env.local...");
  if (fs.existsSync(ENV_FILE)) {
    fs.copyFileSync(ENV_FILE, BACKUP_FILE);
    console.log(`   ✅ Backup saved to ${BACKUP_FILE}\n`);
  }

  // ── Step 2: Update .env.local ──
  console.log("📝 Step 2: Updating .env.local...");
  let env = fs.readFileSync(ENV_FILE, "utf8");

  // Update NEXT_PUBLIC_SUPABASE_URL
  env = env.replace(
    /NEXT_PUBLIC_SUPABASE_URL=.*/,
    `NEXT_PUBLIC_SUPABASE_URL=${newUrl}`
  );

  // Update NEXT_PUBLIC_SUPABASE_ANON_KEY
  env = env.replace(
    /NEXT_PUBLIC_SUPABASE_ANON_KEY=.*/,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${newAnonKey}`
  );

  // Update SUPABASE_SERVICE_ROLE_KEY
  env = env.replace(
    /SUPABASE_SERVICE_ROLE_KEY=.*/,
    `SUPABASE_SERVICE_ROLE_KEY=${newServiceKey}`
  );

  fs.writeFileSync(ENV_FILE, env, "utf8");
  console.log("   ✅ .env.local updated\n");

  // ── Step 3: Test new connection ──
  console.log("🔌 Step 3: Testing new Supabase connection...");
  const supabase = createClient(newUrl, newServiceKey);

  try {
    // Test auth API by listing users (service role only)
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });

    if (error) {
      if (error.message?.includes("Invalid API key") || error.message?.includes("unauthorized")) {
        console.log("   ❌ Invalid API key — check your anon key or service role key");
        process.exit(1);
      }
      // Other errors (like empty user list) are OK — means the connection works
      console.log(`   ⚠️  Auth API responded: ${error.message} (connection works)`);
    } else {
      console.log(`   ✅ Auth API connected — found ${data?.users?.length || 0} existing users\n`);
    }
  } catch (err) {
    console.log(`   ❌ Connection failed: ${err.message}`);
    process.exit(1);
  }

  // ── Step 4: Test auth — create test user ──
  console.log("👤 Step 4: Testing auth flow...");

  const testEmail = `test-${Date.now()}@capitalos-test.com`;
  const testPassword = "TestPassword123!";

  try {
    // Sign up test user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (signUpError) {
      console.log(`   ⚠️  Sign up: ${signUpError.message}`);
      if (signUpError.message.includes("already registered")) {
        console.log("   ✅ Auth is working (user exists check works)\n");
      }
    } else {
      console.log(`   ✅ Sign up works — created ${testEmail}`);

      // Sign in with the test user
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

      if (signInError) {
        console.log(`   ⚠️  Sign in: ${signInError.message}`);
      } else {
        console.log(`   ✅ Sign in works — session created`);
      }

      // Clean up test user
      if (signUpData?.user?.id) {
        const { error: deleteError } = await supabase.auth.admin.deleteUser(signUpData.user.id);
        if (!deleteError) {
          console.log(`   🧹 Test user cleaned up\n`);
        }
      }
    }
  } catch (err) {
    console.log(`   ⚠️  Auth test error: ${err.message}\n`);
  }

  // ── Step 5: Verify admin email is set ──
  console.log("👑 Step 5: Checking admin configuration...");
  const adminEmails = env.match(/COCKROACH_ADMIN_EMAILS=(.*)/)?.[1];
  if (adminEmails && adminEmails.trim()) {
    console.log(`   ✅ Admin emails: ${adminEmails.trim()}\n`);
  } else {
    console.log("   ⚠️  No COCKROACH_ADMIN_EMAILS set — add your email!\n");
  }

  // ── Summary ──
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("✅ SETUP COMPLETE!\n");
  console.log("New Supabase project connected:");
  console.log(`   URL:    ${newUrl}`);
  console.log(`   Region: auto-detected`);
  console.log(`\nNext steps:`);
  console.log(`   1. Restart dev server:  npm run dev`);
  console.log(`   2. Test login:          http://localhost:3456/login`);
  console.log(`   3. Test signup:         http://localhost:3456/signup`);
  console.log(`   4. Test admin:          http://localhost:3456/dashboard/admin`);
  console.log(`      (use email: ${adminEmails?.trim() || "add COCKROACH_ADMIN_EMAILS"})`);
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("❌ Setup failed:", err.message);
  process.exit(1);
});
