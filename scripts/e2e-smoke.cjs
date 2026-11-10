// =============================================
// Signed-in smoke check (repeatable, self-cleaning)
// =============================================
// What it proves, against a running dev server:
//   1. A real account can sign in through /login.
//   2. A CRM task can be created and appears in the board.
//   3. A pipeline card can be dragged from one stage tile to another.
//   4. Two investors can be selected and compared.
//
// It creates a disposable Supabase user (admin API, service role), seeds one
// saved investor and one pipeline entry for it, runs the browser flow with
// Playwright, then deletes the user — which cascades their rows.
//
// Usage:
//   npm run dev                # in another terminal
//   node scripts/e2e-smoke.cjs
//   BASE_URL=http://localhost:3000 node scripts/e2e-smoke.cjs
//
// Exit codes: 0 all steps passed · 1 a check failed · 2 setup/environment.

require("dotenv").config({ path: ".env.local", quiet: true });
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stamp = Date.now();
const EMAIL = `e2e+${stamp}@capital-os.test`;
const PASSWORD = `e2e-${stamp}-Aa1!`;
const TASK_TITLE = `E2E smoke task ${stamp}`;

const results = [];
let failures = 0;

function step(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

function rest(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
}

async function admin(path, init = {}) {
  return fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function waitForServer(timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(BASE_URL, { redirect: "manual" });
      if (res.status > 0) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

async function createUser() {
  const res = await admin("users", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`createUser ${res.status}: ${await res.text()}`);
  const user = await res.json();
  return user.id;
}

async function pickInvestors() {
  const res = await rest(
    "investors?select=id,full_name&is_active=eq.true&order=fit_score.desc&limit=2"
  );
  if (!res.ok) throw new Error(`pickInvestors ${res.status}: ${await res.text()}`);
  return res.json();
}

async function seed(userId, investors) {
  const saved = await rest("saved_investors", {
    method: "POST",
    body: JSON.stringify(investors.map((i) => ({ user_id: userId, investor_id: i.id }))),
  });
  if (!saved.ok) throw new Error(`seed saved_investors ${saved.status}: ${await saved.text()}`);

  const entry = await rest("user_pipeline_entries", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      investor_id: investors[0].id,
      stage: "discovered",
    }),
  });
  if (!entry.ok) throw new Error(`seed pipeline ${entry.status}: ${await entry.text()}`);
}

async function cleanup(userId, page) {
  try {
    if (page) await page.close();
  } catch {
    /* ignore */
  }
  if (!userId) return;
  // Explicit row cleanup first: the smoke run must leave nothing behind even if
  // a foreign key is not cascading in this environment.
  await rest(`crm_tasks?user_id=eq.${userId}`, { method: "DELETE" }).catch(() => {});
  await rest(`user_pipeline_entries?user_id=eq.${userId}`, { method: "DELETE" }).catch(() => {});
  await rest(`saved_investors?user_id=eq.${userId}`, { method: "DELETE" }).catch(() => {});
  await rest(`pipeline_events?user_id=eq.${userId}`, { method: "DELETE" }).catch(() => {});
  await admin(`users/${userId}`, { method: "DELETE" }).catch(() => {});
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(2);
  }
  if (!(await waitForServer())) {
    console.error(`No server at ${BASE_URL}. Start it with "npm run dev" and re-run.`);
    process.exit(2);
  }

  let userId = null;
  let browser = null;
  let page = null;

  try {
    userId = await createUser();
    const investors = await pickInvestors();
    if (investors.length < 2) {
      throw new Error(`Need at least 2 investors in the corpus, found ${investors.length}`);
    }
    await seed(userId, investors);

    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    // ── 1. Sign in ──
    // networkidle matters here: clicking before hydration submits the form
    // natively (a GET with the password in the query string) and never signs in.
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Log In" }).click();

    let signedIn = true;
    let landedOn = "";
    try {
      await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    } catch {
      signedIn = false;
      landedOn = page.url();
    }
    step("sign in with a real account", signedIn, signedIn ? "" : landedOn);
    if (!signedIn) throw new Error("cannot continue without a session");

    // ── 2. CRM task creation ──
    await page.goto(`${BASE_URL}/dashboard/crm`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /New task/i }).click();
    await page.getByPlaceholder("Follow up with Sequoia about the data room").fill(TASK_TITLE);
    await page.getByRole("button", { name: "Save task" }).click();
    let taskVisible = true;
    try {
      await page.getByText(TASK_TITLE, { exact: false }).first().waitFor({ timeout: 15_000 });
    } catch {
      taskVisible = false;
    }
    step("create a CRM task and see it on the board", taskVisible);

    // ── 3. Pipeline drag-and-drop ──
    await page.goto(`${BASE_URL}/dashboard/pipeline`, { waitUntil: "domcontentloaded" });
    await page
      .getByRole("button", { name: /Discovered/ })
      .first()
      .click();
    const card = page
      .locator('[draggable="true"]')
      .filter({ hasText: investors[0].full_name })
      .first();
    let cardVisible = true;
    try {
      await card.waitFor({ timeout: 15_000 });
    } catch {
      cardVisible = false;
    }

    let moved = false;
    if (cardVisible) {
      const target = page.getByRole("button", { name: /^Researching/ }).first();
      // Playwright's dragTo is mouse-only here and Chromium's headless shell
      // never raises HTML5 drag events from it. Dispatching the real events
      // with a DataTransfer exercises the same handlers a human drag does.
      const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
      await card.dispatchEvent("dragstart", { dataTransfer });
      await target.dispatchEvent("dragover", { dataTransfer });
      await target.dispatchEvent("drop", { dataTransfer });
      await card.dispatchEvent("dragend", { dataTransfer });
      try {
        await page
          .getByText(/Moved to Researching/i)
          .first()
          .waitFor({ timeout: 15_000 });
        moved = true;
      } catch {
        // Fall back to the database: the UI toast may be gone but the move is
        // what matters, and this keeps the check honest either way.
        const res = await rest(
          `user_pipeline_entries?user_id=eq.${userId}&investor_id=eq.${investors[0].id}&select=stage`
        );
        const rows = res.ok ? await res.json() : [];
        moved = rows[0]?.stage === "researching";
      }
    }
    step(
      "drag a pipeline card from Discovered to Researching",
      cardVisible && moved,
      cardVisible ? "" : "seeded card not rendered"
    );

    // ── 4. Compare two investors ──
    await page.goto(`${BASE_URL}/dashboard/investors`, { waitUntil: "domcontentloaded" });
    const boxes = page.locator("tbody input[type=checkbox]");
    await boxes.nth(0).waitFor({ timeout: 20_000 });
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    await page.getByRole("button", { name: /Compare 2/ }).click();
    let compareOk = true;
    let compareDetail = "";
    try {
      await page.waitForURL(/\/dashboard\/investors\/compare/, { timeout: 20_000 });
      await page.getByText(investors[0].full_name).first().waitFor({ timeout: 20_000 });
      await page.getByText(investors[1].full_name).first().waitFor({ timeout: 20_000 });
    } catch {
      compareOk = false;
      compareDetail = page.url();
    }
    step("compare two selected investors", compareOk, compareDetail);

    // ── 5. Investor relations drafter ──
    await page.goto(`${BASE_URL}/dashboard/ir`, { waitUntil: "networkidle" });
    let irOk = true;
    try {
      await page.getByText("Monthly update drafter").first().waitFor({ timeout: 20_000 });
    } catch {
      irOk = false;
    }
    step("open the investor relations update drafter", irOk);

    // ── 6. Saved-search alert panel ──
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
    let alertsOk = true;
    try {
      await page.getByRole("button", { name: "Saved-search alerts" }).click();
      await page.getByRole("heading", { name: "Alerts" }).waitFor({ timeout: 15_000 });
    } catch {
      alertsOk = false;
    }
    step("open the saved-search alerts panel", alertsOk);
  } catch (err) {
    step("run completed", false, err instanceof Error ? err.message : String(err));
  } finally {
    await cleanup(userId, page);
    if (browser) await browser.close().catch(() => {});
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
