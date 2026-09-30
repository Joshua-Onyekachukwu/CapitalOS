#!/usr/bin/env node
/**
 * Production smoke test — runnable on demand.
 *
 * Exercises the full critical path against a live deployment:
 *
 *   1. Preflight        server is up and answering
 *   2. Signup           unique account created, duplicate rejected (409)
 *   3. Session          password grant → sb-* cookie that authenticates
 *   4. Founder journey  cockpit, investors, outreach metrics, suppression
 *                       add/remove, outreach send/draft validation gates
 *   5. Role guards      admin routes 401 without session, 403 as founder
 *   6. Admin control    admin session passes the gate (users, audit-logs
 *                       incl. the new action/actor filters)
 *   7. IDOR spot-checks foreign accountId → 404 on warmup GET/POST
 *
 * The signup account is kept (auditability — same convention as the
 * authflow suite); everything else this script creates is cleaned up.
 *
 * Usage:
 *   node scripts/smoke-prod.cjs [--base-url https://capital-os-nine.vercel.app] [--keep] [--verbose]
 *
 * Env (loaded from .env.local, or already in the environment):
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY   session minting
 *   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD                     positive control
 *   TEST_IDOR_VICTIM_ACCOUNT_ID                                IDOR check (optional)
 *
 * Exit code 0 = all assertions passed; 1 = at least one failed.
 * Signup is rate-limited 10/min per IP — space out repeated runs.
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
};

const BASE_URL = (opt("base-url") || process.env.TEST_URL || "https://capital-os-nine.vercel.app").replace(/\/$/, "");
const VERBOSE = flag("verbose") || flag("v");
const KEEP = flag("keep");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "";
const VICTIM_ACCOUNT_ID = process.env.TEST_IDOR_VICTIM_ACCOUNT_ID || "";

const TIMEOUT_MS = 20_000;
const results = [];

function log(msg) {
  console.log(msg);
}
function vlog(msg) {
  if (VERBOSE) console.log(`    ${msg}`);
}

async function timedFetch(url, options = {}, attempts = 3) {
  let res;
  const started = Date.now();
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      res = await Promise.race([
        fetch(url, options),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)),
      ]);
      vlog(`${options.method || "GET"} ${url.replace(BASE_URL, "")} → ${res.status} (${Date.now() - started}ms)`);
      return res;
    } catch (err) {
      lastErr = err;
      if (i < attempts) {
        vlog(`network error (${err.message}), retry ${i}/${attempts - 1}`);
        await new Promise((r) => setTimeout(r, 2000 * i));
      }
    }
  }
  throw new Error(`${url} → ${lastErr.message}`);
}

/** Run one named assertion step; record pass/fail, never throw. */
async function step(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    log(`  ✔ ${name}`);
  } catch (err) {
    results.push({ name, ok: false, error: err.message });
    log(`  ✘ ${name}\n      ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Mint an app session cookie via @supabase/ssr (the exact format the
 *  app's createServerClient parses — the raw grant sets no cookies). */
async function signIn(email, password) {
  const store = new Map();
  const { createServerClient } = await import("@supabase/ssr");
  const sb = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => Array.from(store.entries()).map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => store.set(name, value)),
    },
  });
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (!error) break;
    lastErr = error;
    if (attempt < 4) {
      vlog(`signIn network error (${error.message}), retry ${attempt}/3`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    } else {
      throw new Error(`signIn(${email}) failed: ${error.message}`);
    }
  }
  return Array.from(store.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

(async () => {
  log(`\nCapital OS smoke test → ${BASE_URL}`);
  log(`signup identity kept for audit; suppression probe ${KEEP ? "kept (--keep)" : "cleaned up"}\n`);

  // ── 1. Preflight ────────────────────────────────────────────────
  await step("preflight: server responds", async () => {
    const res = await timedFetch(`${BASE_URL}/api/dashboard/admin`);
    assert(res.status > 0, "no response at all");
  });

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    log("\n✖ FATAL: NEXT_PUBLIC_SUPABASE_URL / ANON_KEY missing — cannot mint sessions.\n");
    process.exit(1);
  }

  // ── 2. Signup ───────────────────────────────────────────────────
  const stamp = Date.now();
  const email = `buffy.qa+smoke-${stamp}@gmail.com`;
  const password = "Smoke!2026xE2e";
  let founderCookie = null;

  await step("signup: account created confirmed", async () => {
    const res = await timedFetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "Smoke Test", email, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 429) throw new Error("signup rate-limited (10/min per IP) — wait a minute and rerun");
    // 409 on a retry means an earlier attempt was lost after the server
    // created the account — the account exists, so this step succeeded.
    assert(
      [200, 201, 409].includes(res.status),
      `expected 200/201 (or 409 from a lost prior attempt), got ${res.status}: ${JSON.stringify(body).slice(0, 200)}`
    );
    assert(
      body.success === true || /already/i.test(body.error || ""),
      `success not true: ${JSON.stringify(body).slice(0, 200)}`
    );
    if (body.confirmed === false) throw new Error("account not auto-confirmed — signup journey would dead-end");
  });

  await step("signup: duplicate email rejected with 409", async () => {
    const res = await timedFetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "Smoke Test", email, password }),
    });
    assert(res.status === 409, `expected 409, got ${res.status}`);
  });

  // ── 3. Session ──────────────────────────────────────────────────
  await step("session: password grant mints authenticating cookie", async () => {
    founderCookie = await signIn(email, password);
    const res = await timedFetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: founderCookie } });
    assert(res.status === 200, `expected 200 with session, got ${res.status}`);
  });

  if (!founderCookie) {
    log("\n✖ FATAL: could not mint a session — skipping journey sections.\n");
    finish();
  }

  const authed = (path, options = {}) =>
    timedFetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Cookie: founderCookie, ...(options.headers || {}) },
    });

  // ── 4. Founder journey ─────────────────────────────────────────
  await step("journey: dashboard cockpit loads", async () => {
    const res = await authed("/api/dashboard/cockpit");
    assert(res.status === 200, `expected 200, got ${res.status}`);
  });

  await step("journey: investor list loads", async () => {
    const res = await authed("/api/investors");
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const body = await res.json().catch(() => ({}));
    assert(Array.isArray(body.investors) || Array.isArray(body) || body.data, "no investor collection in response");
  });

  await step("journey: outreach metrics load", async () => {
    const res = await authed("/api/dashboard/outreach/metrics");
    assert(res.status === 200, `expected 200, got ${res.status}`);
  });

  await step("journey: suppression add → remove round-trip", async () => {
    const probe = `smoke-suppress-${stamp}@example.invalid`;
    const post = await authed("/api/email/suppression", {
      method: "POST",
      body: JSON.stringify({ emailAddress: probe, reason: "smoke-test" }),
    });
    assert(post.status === 200, `add expected 200, got ${post.status}`);
    if (!KEEP) {
      const del = await authed(`/api/email/suppression?email=${encodeURIComponent(probe)}`, { method: "DELETE" });
      assert(del.status === 200, `remove expected 200, got ${del.status}`);
    }
  });

  await step("journey: outreach send rejects invalid investor (validation gate)", async () => {
    // No email is actually sent: an invalid investorId must be refused
    // by validation (400) or investor lookup (404) before any send.
    const res = await authed("/api/outreach/send", {
      method: "POST",
      body: JSON.stringify({
        investorId: `00000000-0000-0000-0000-000000000000`,
        subject: "smoke test — must not send",
        bodyHtml: "<p>smoke</p>",
        bodyText: "smoke",
      }),
    });
    assert([400, 404].includes(res.status), `expected 400/404 gate, got ${res.status}`);
  });

  await step("journey: outreach draft requires investorName (400 before any AI call)", async () => {
    const res = await authed("/api/outreach/draft", { method: "POST", body: JSON.stringify({}) });
    assert(res.status === 400, `expected 400, got ${res.status}`);
  });

  // ── 5. Role guards ─────────────────────────────────────────────
  await step("role guard: admin routes 401 without any session", async () => {
    const res = await timedFetch(`${BASE_URL}/api/admin/users`);
    assert([401, 403].includes(res.status), `expected 401/403, got ${res.status}`);
  });

  await step("role guard: /api/admin/users 403 as non-admin", async () => {
    const res = await authed("/api/admin/users");
    assert(res.status === 403, `expected 403, got ${res.status}`);
  });

  await step("role guard: /api/admin/audit-logs 403 as non-admin", async () => {
    const res = await authed("/api/admin/audit-logs");
    assert(res.status === 403, `expected 403, got ${res.status}`);
  });

  // ── 6. Admin positive control ──────────────────────────────────
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    await step("admin control: admin session passes users gate", async () => {
      const adminCookie = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
      const res = await timedFetch(`${BASE_URL}/api/admin/users`, { headers: { Cookie: adminCookie } });
      assert(res.status === 200, `expected 200, got ${res.status}`);
      const body = await res.json().catch(() => ({}));
      assert(Array.isArray(body.users), "users array missing");
    });

    await step("admin control: audit-logs endpoint + action filter", async () => {
      const adminCookie = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
      const base = await timedFetch(`${BASE_URL}/api/admin/audit-logs?limit=10`, { headers: { Cookie: adminCookie } });
      assert(base.status === 200, `expected 200, got ${base.status}`);
      const data = await base.json().catch(() => ({}));
      assert(Array.isArray(data.logs), "logs array missing");
      assert("nextBefore" in data, "nextBefore cursor missing from response shape");
      // Server-side filter: an action that matches nothing returns no rows.
      const filtered = await timedFetch(
        `${BASE_URL}/api/admin/audit-logs?limit=10&action=__no_such_action__`,
        { headers: { Cookie: adminCookie } }
      );
      assert(filtered.status === 200, `filter request failed: ${filtered.status}`);
      const fdata = await filtered.json().catch(() => ({}));
      assert(Array.isArray(fdata.logs) && fdata.logs.length === 0, "action filter did not narrow results");
    });
  } else {
    log("  ⚠ admin control skipped (TEST_ADMIN_EMAIL/PASSWORD not set)");
  }

  // ── 7. IDOR spot-checks ────────────────────────────────────────
  if (VICTIM_ACCOUNT_ID) {
    await step("idor: foreign email account 404 on warmup GET", async () => {
      const res = await authed(`/api/email/warmup?accountId=${VICTIM_ACCOUNT_ID}`);
      assert(res.status === 404, `expected 404, got ${res.status}`);
    });
    await step("idor: foreign email account 404 on warmup POST", async () => {
      const res = await authed("/api/email/warmup", {
        method: "POST",
        body: JSON.stringify({ action: "pause", accountId: VICTIM_ACCOUNT_ID }),
      });
      assert(res.status === 404, `expected 404, got ${res.status}`);
    });
  } else {
    log("  ⚠ IDOR spot-checks skipped (TEST_IDOR_VICTIM_ACCOUNT_ID not set)");
  }

  finish();
})().catch((err) => {
  console.error(`\n✖ smoke test crashed: ${err.message}\n`);
  process.exit(1);
});

function finish() {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  log(`\n${"─".repeat(56)}`);
  log(`Result: ${passed}/${results.length} passed${failed.length ? ` — ${failed.length} FAILED` : " — all green"}`);
  for (const f of failed) log(`  ✘ ${f.name}: ${f.error}`);
  log("");
  process.exit(failed.length ? 1 : 0);
}
