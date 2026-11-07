#!/usr/bin/env node
/**
 * Create (or rotate) the account the signed-in smoke test uses.
 *
 * The password is generated here, never asked for in chat, and written only to
 * .env.e2e.local — which `.env*` keeps out of git. Re-running the script
 * rotates the password instead of failing on an existing user.
 *
 * Usage: node scripts/e2e-seed-user.cjs
 */

require("dotenv").config({ path: ".env.local", quiet: true });
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  require("dotenv").config({ path: ".env", quiet: true });
}

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.env.E2E_EMAIL || "e2e-smoke@capitalos.test";
const BASE_URL = process.env.E2E_BASE_URL || "https://capital-os-nine.vercel.app";

if (!URL || !SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}

const password = `${crypto.randomBytes(18).toString("base64url")}aA1!`;

const sp = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });

async function findUser(email) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sp.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    const hit = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}

(async () => {
  let action = "created";
  let userId;

  const { data: created, error } = await sp.auth.admin.createUser({
    email: EMAIL,
    password,
    email_confirm: true,
    user_metadata: { full_name: "E2E Smoke", purpose: "automated smoke test" },
  });

  if (created?.user) {
    userId = created.user.id;
  } else if (error && /already|exists|registered/i.test(error.message)) {
    const existing = await findUser(EMAIL);
    if (!existing) throw new Error(`user ${EMAIL} exists but could not be found`);
    userId = existing.id;
    const { error: updateError } = await sp.auth.admin.updateUserById(userId, { password });
    if (updateError) throw new Error(updateError.message);
    action = "rotated";
  } else {
    throw new Error(error?.message || "could not create the test user");
  }

  const envPath = path.resolve(__dirname, "..", ".env.e2e.local");
  fs.writeFileSync(
    envPath,
    [
      `E2E_EMAIL=${EMAIL}`,
      `E2E_PASSWORD=${password}`,
      `E2E_BASE_URL=${BASE_URL}`,
      "",
    ].join("\n"),
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        action,
        userId,
        email: EMAIL,
        credentialsFile: path.relative(process.cwd(), envPath),
        passwordWritten: true,
      },
      null,
      2
    )
  );
})().catch((err) => {
  console.error("seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
