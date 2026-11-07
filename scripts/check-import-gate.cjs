#!/usr/bin/env node
/**
 * End-to-end check of the admin CSV import gate.
 *
 * Proves, against the deployed app and the real database, that:
 *   • a preview writes nothing and returns a token;
 *   • a confirm without that token is refused;
 *   • a confirm with the token writes to the staging table, not the corpus;
 *   • the same file is deduped on the way in.
 *
 * Requires IMPORT_GATE=1 because it temporarily grants the E2E account admin
 * role, and restores it afterwards. It never touches `investors`.
 *
 * Usage: IMPORT_GATE=1 node scripts/check-import-gate.cjs
 */

require("dotenv").config({ path: ".env.e2e.local", quiet: true });
require("dotenv").config({ path: ".env.local", quiet: true });
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  require("dotenv").config({ path: ".env", quiet: true });
}

const { createClient } = require("@supabase/supabase-js");
const { chromium } = require("playwright");
const db = require("./db.cjs");

if (process.env.IMPORT_GATE !== "1") {
  console.error("Refusing to run: set IMPORT_GATE=1 (this grants then revokes admin on the E2E account).");
  process.exit(2);
}

const BASE_URL = process.env.E2E_BASE_URL || "https://capital-os-nine.vercel.app";
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const SOURCE = "gate_check";
const STAGING_EMAIL = "gate-check@example.invalid";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Supabase service credentials are required (.env.local).");
  process.exit(1);
}
if (!EMAIL || !PASSWORD) {
  console.error("E2E_EMAIL / E2E_PASSWORD missing — run `npm run e2e:seed` first.");
  process.exit(1);
}

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const CSV = [
  "full_name,email,investor_type,min_check_size",
  "Gate Check Capital,gate-check@example.invalid,venture_capital,$250k",
  "Gate Check Capital,gate-check@example.invalid,venture_capital,$250k",
].join("\n");

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail });
  if (!ok) throw new Error(`${name} failed: ${JSON.stringify(detail)}`);
}

async function stagingCount() {
  const rows = await db.query(
    "select count(*)::int as n from public.investors_import_staging where email = $1",
    [STAGING_EMAIL]
  );
  return rows[0].n;
}

async function cleanup() {
  await db.query("delete from public.investors_import_staging where source = $1", [SOURCE]);
  await db.query(
    "delete from public.audit_log where action = 'investor_csv_import' and details->>'source' = $1",
    [SOURCE]
  );
}

(async () => {
  let browser;
  let userId = null;
  let originalMeta = null;

  try {
    await cleanup();

    const users = await db.query(
      "select id, raw_app_meta_data from auth.users where lower(email) = lower($1) limit 1",
      [EMAIL]
    );
    if (users.length === 0) throw new Error(`E2E user ${EMAIL} not found`);
    userId = users[0].id;
    originalMeta = users[0].raw_app_meta_data || {};

    // Grant admin for the duration of the check; restored in `finally`.
    const { error: grantError } = await sp.auth.admin.updateUserById(userId, {
      app_metadata: { ...originalMeta, role: "admin" },
    });
    if (grantError) throw new Error(`could not grant admin: ${grantError.message}`);

    browser = await chromium.launch({ channel: "msedge" });
    const page = await browser.newPage({ baseURL: BASE_URL });
    await page.goto("/login");
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button:has-text("Log In")');
    await page.waitForURL(/\/dashboard/, { timeout: 45_000 });

    // 1. Preview writes nothing.
    const preview = await page.request.post("/api/admin/import/preview", {
      data: { csvContent: CSV, source: SOURCE, target: "investors_import_staging" },
    });
    const previewBody = await preview.json();
    check("preview status 200", preview.status() === 200, { status: preview.status(), previewBody });
    check("preview produced a token", typeof previewBody.previewToken === "string", previewBody);
    check("preview counted one insert", previewBody.wouldInsert === 1, previewBody);
    check("preview counted one duplicate", previewBody.duplicates === 1, previewBody);
    check("preview wrote nothing", (await stagingCount()) === 0, await stagingCount());

    // 2. Confirm without a token is refused.
    const unconfirmed = await page.request.post("/api/admin/import", {
      data: { csvContent: CSV, source: SOURCE, target: "investors_import_staging" },
    });
    check("confirm without preview refused", unconfirmed.status() === 400, {
      status: unconfirmed.status(),
      body: await unconfirmed.text(),
    });
    check("still nothing written", (await stagingCount()) === 0, await stagingCount());

    // 3. Confirm with the token writes to staging only.
    const confirmed = await page.request.post("/api/admin/import", {
      data: {
        csvContent: CSV,
        source: SOURCE,
        target: "investors_import_staging",
        previewToken: previewBody.previewToken,
      },
    });
    const confirmedBody = await confirmed.json();
    check("confirm status 200", confirmed.status() === 200, {
      status: confirmed.status(),
      confirmedBody,
    });
    check("one row inserted", confirmedBody.inserted === 1, confirmedBody);
    check("duplicate skipped", confirmedBody.duplicates === 1, confirmedBody);
    check("staging holds the row", (await stagingCount()) === 1, await stagingCount());

    const corpus = await db.query(
      "select count(*)::int as n from public.investors where email = $1",
      [STAGING_EMAIL]
    );
    check("corpus untouched", corpus[0].n === 0, corpus[0]);

    console.log(JSON.stringify({ ok: true, baseUrl: BASE_URL, checks: results }, null, 2));
  } finally {
    await cleanup().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (userId) {
      await sp.auth.admin
        .updateUserById(userId, { app_metadata: originalMeta || {} })
        .catch(() => {});
    }
    await db.close();
  }
})().catch((err) => {
  console.error(JSON.stringify({ ok: false, checks: results, error: err.message }, null, 2));
  process.exit(1);
});
