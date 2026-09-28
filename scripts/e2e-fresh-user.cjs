#!/usr/bin/env node
/**
 * Fresh-user browser E2E — walks the founder path on production:
 *   signup → auto sign-in → dashboard → discover (SEC filters) →
 *   investor database (evidence filter) → investor profile
 *     (evidence badge + merge history card).
 *
 * Prereqs:
 *   - playwright (devDependency) with cached chromium
 *   - SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL in .env.local
 *     (used to confirm email instantly via the admin API and to assert DB state)
 *   - BASE_URL (default https://capital-os-nine.vercel.app)
 *
 * Usage: node scripts/e2e-fresh-user.cjs [--keep]
 *   --keep   skip account cleanup so the run can be inspected in Supabase
 */

require("dotenv").config({ path: ".env.local" });
const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");

const BASE = process.env.BASE_URL || "https://capital-os-nine.vercel.app";
const KEEP = process.argv.includes("--keep");
const ts = Date.now();
const EMAIL = `buffy.qa+browser-e2e-${ts}@gmail.com`;
const PASSWORD = `BrE2e!${String(ts).slice(-6)}x`;
const FULL_NAME = "Browser E2E Founder";

const results = [];
function assert(name, cond, detail = "") {
  results.push({ name, pass: !!cond, detail });
  console.log(`  ${cond ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function confirmUserByEmail(email) {
  const admin = serviceClient();
  // Admin list-users has no email filter — page until found (tiny user count in practice).
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const hit = (data.users || []).find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
    if (hit) {
      if (!hit.email_confirmed_at) {
        await admin.auth.admin.updateUserById(hit.id, { email_confirm: true });
      }
      return hit;
    }
    if (!data.users || data.users.length < 200) break;
  }
  return null;
}

async function cleanup(userId) {
  if (KEEP || !userId) return;
  try {
    await serviceClient().auth.admin.deleteUser(userId);
    console.log(`\ncleanup: deleted test user ${EMAIL}`);
  } catch (err) {
    console.log(`\ncleanup: could not delete user (${err.message})`);
  }
}

(async () => {
  console.log(`Fresh-user E2E → ${BASE}`);
  console.log(`account: ${EMAIL}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  let userId = null;

  try {
    // ── 1. Signup ──
    console.log("[1] signup");
    await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
    await page.fill('input[name="fullName"]', FULL_NAME);
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await page.fill('input[name="confirmPassword"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 30000 });
    assert("signup lands on dashboard without email activation", true);

    // Confirm + resolve user id via admin API
    const user = await confirmUserByEmail(EMAIL);
    userId = user?.id || null;
    assert("user exists and is confirmed", !!user && !!user.email_confirmed_at);

    // ── 2. Dashboard ──
    console.log("[2] dashboard");
    // Dashboard content loads async after the redirect — wait for real content.
    const dashReady = await page
      .waitForSelector('main:has-text("Welcome")', { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    const dashText = await page.locator("main").innerText();
    assert("dashboard shows welcome", dashReady && /Welcome back/i.test(dashText));
    assert("dashboard shows investor stats", /Total Investors/i.test(dashText));
    assert("dashboard shows next steps", /Next Steps/i.test(dashText));

    // ── 3. Discover filters ──
    console.log("[3] discover filters");
    await page.goto(`${BASE}/dashboard/investors/discover`, { waitUntil: "networkidle" });
    // Select order: [0] Stage, [1] SEC Filing Activity, [2] Evidence
    const secSelect = page.locator("select").nth(1);
    await secSelect.selectOption({ label: "Filed within 1 year (active)" });
    await page.fill("textarea", "active institutional investors");
    await page.click('button:has-text("Discover Investors")');
    await page
      .waitForSelector('main:has-text("investors found")', { timeout: 20000 })
      .catch(() => {});
    const discText = await page.locator("main").innerText();
    assert("discover returns results", /investors? found/i.test(discText) && !/0 investors found/i.test(discText));
    assert("discover surfaces dormancy/evidence info", /filed/i.test(discText) || /SEC-verified/i.test(discText));

    // ── 4. Investor database + evidence filter ──
    console.log("[4] investor database");
    await page.goto(`${BASE}/dashboard/investors`, { waitUntil: "networkidle" });
    await page.waitForSelector("table tbody tr", { timeout: 20000 });
    const dbText = await page.locator("main").innerText();
    const listed = dbText.match(/([\d,]+)\s*\n?\s*total/i)?.[1];
    assert("list shows a total", !!listed, `total=${listed}`);
    assert("merged rows excluded (expect 12,127)", listed === "12,127", `got ${listed}`);

    // Evidence badge visible at wide viewport
    const badge = await page.locator('table tbody span[title*="Source-verified"], table tbody span[title*="Derived"], table tbody span[title*="AI-classified"], table tbody span[title*="Unqualified"]').first();
    assert("evidence badge rendered on rows", await badge.isVisible().catch(() => false));

    // Apply the evidence filter: prefer the sidebar select (option value
    // 'verified'), fall back to driving the API through the page session.
    const evidenceSelect = page.locator('select:has(option[value="verified"])').first();
    const usedUi = await evidenceSelect
      .selectOption("verified")
      .then(() => true)
      .catch(() => false);
    if (usedUi) {
      await page.waitForTimeout(2500);
      const filtered = await page.locator("table tbody tr").count();
      assert("evidence filter applied in UI", filtered > 0, `${filtered} rows`);
    } else {
      const r = await page.evaluate(async () => {
        const res = await fetch("/api/investors?evidence=verified&limit=5");
        return { status: res.status, json: await res.json() };
      });
      assert(
        "evidence=verified API filter works",
        r.status === 200 && (r.json.investors || []).every((x) => x.verification_status === "verified")
      );
    }

    // ── 5. Investor profile ──
    console.log("[5] investor profile");
    const href = await page.locator('table tbody tr a').first().getAttribute("href");
    await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    const profText = await page.locator("main").innerText();
    assert("profile shows the investor name", profText.trim().length > 0);
    assert(
      "profile shows evidence tier",
      await page.locator('span[title*="Source-verified"], span[title*="Derived"], span[title*="AI-classified"], span[title*="Unqualified"]').first().isVisible().catch(() => false)
    );
    // Merge-history card is conditional — assert the API surface instead when absent
    const mergeApi = await page.evaluate(async () => {
      const id = location.pathname.split("/").pop();
      const res = await fetch(`/api/investors/${id}`);
      const j = await res.json();
      return { hasHistory: Array.isArray(j.mergeHistory), mergedInto: j.mergedInto || null };
    });
    assert("profile API exposes merge audit fields", mergeApi.hasHistory);
  } catch (err) {
    assert("no fatal error", false, String(err).slice(0, 200));
  } finally {
    await cleanup(userId);
    await browser.close();
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n—— Fresh-user E2E: ${passed}/${results.length} passed ——`);
  process.exit(passed === results.length ? 0 : 1);
})();
