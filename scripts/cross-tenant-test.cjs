#!/usr/bin/env node
/**
 * Cross-tenant isolation test — two isolated tenants attack each other.
 *
 * Layers tested (every cross-tenant attempt must fail):
 *   RLS  — supabase-js with each tenant's own JWT against the anon key
 *   API  — Next.js API routes with each tenant's session cookie
 *   Anon — no auth at all
 *
 * Coverage:
 *   - read/update/delete other tenant's rows (saved filters, email accounts,
 *     warmup, suppression list, notes in data_change_log)
 *   - insert rows under the other tenant's user_id (ownership forgery)
 *   - notes privacy: B must not see A's notes on the SHARED investor dataset
 *     (regression guard for the 010 migration)
 *   - anonymous JWT: zero visibility into any tenant's private tables
 *   - positive controls: same operations on OWN rows must succeed
 *
 * A = existing QA founder account (from .env.local).
 * B = freshly signed-up tenant (unique buffy.qa+ address, kept for audit).
 *
 * Usage: node scripts/cross-tenant-test.cjs [--base-url URL] [--verbose]
 * Env:   NEXT_PUBLIC_SUPABASE_URL/_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
 *        TEST_FOUNDER_EMAIL, TEST_FOUNDER_PASSWORD, TEST_URL
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const A_EMAIL = process.env.TEST_FOUNDER_EMAIL || "buffy.qa+prod-e2e-20260927@gmail.com";
const A_PASSWORD = process.env.TEST_FOUNDER_PASSWORD || "E2eTest!2026x";

const results = [];
let passCount = 0;
let failCount = 0;

function log(msg) { console.log(msg); }
function vlog(msg) { if (VERBOSE) console.log(`      ${msg}`); }

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  if (ok) { passCount++; log(`  ✔ ${name}`); }
  else { failCount++; log(`  ✘ ${name}\n      ${detail}`); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

/** Local machine has frequent outbound network flakes — retry idempotent network ops. */
async function withRetry(fn, label, attempts = 4) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts) {
        vlog(`retry ${i}/${attempts - 1} for ${label}: ${err.message}`);
        await new Promise((r) => setTimeout(r, 2000 * i));
      }
    }
  }
  throw lastErr;
}

const { createClient } = require("@supabase/supabase-js");
const service = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Mint a session (JWT access token) for a tenant. */
async function signIn(email, password) {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await withRetry(
    () => sb.auth.signInWithPassword({ email, password }),
    `signIn(${email})`
  );
  if (error) throw new Error(`signIn(${email}): ${error.message}`);
  return { sb, jwt: data.session.access_token, userId: data.user.id };
}

/** supabase-js client speaking as a tenant's JWT (RLS layer). */
function asUser(jwt) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Mint the app's sb-* session cookie for API-layer calls. */
async function signInCookie(email, password) {
  const store = new Map();
  const { createServerClient } = await import("@supabase/ssr");
  const sb = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => Array.from(store.entries()).map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => store.set(name, value)),
    },
  });
  const { error } = await withRetry(
    () => sb.auth.signInWithPassword({ email, password }),
    `cookie signIn(${email})`
  );
  if (error) throw new Error(`cookie signIn(${email}): ${error.message}`);
  return Array.from(store.entries()).map(([n, v]) => `${n}=${v}`).join("; ");
}

async function api(cookie, path, init = {}) {
  const headers = { "Content-Type": "application/json", ...(init.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  // Retry only network-level failures (never HTTP error responses)
  const res = await withRetry(
    () => fetch(`${BASE_URL}${path}`, { ...init, headers }),
    `api ${path}`
  );
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body };
}

async function main() {
  log(`\nCross-tenant isolation test → ${BASE_URL}\n`);

  // ── setup: two isolated tenants ──────────────────────────────────
  log("  setup: creating two isolated tenants");
  const stamp = Date.now();
  const B_EMAIL = `buffy.qa+tenant-b-${stamp}@gmail.com`;
  const B_PASSWORD = "TenantB!2026xE2e";

  const signup = await api(null, "/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ fullName: "Tenant B QA", email: B_EMAIL, password: B_PASSWORD }),
  });
  assert(signup.status === 200 || signup.status === 201, `tenant B signup failed: ${signup.status} ${JSON.stringify(signup.body)}`);
  const B_USER_ID = signup.body.userId;
  assert(!!B_USER_ID, "signup response missing userId");
  log(`    A (existing): ${A_EMAIL}`);
  log(`    B (new):      ${B_EMAIL} (${B_USER_ID})`);

  const A = await signIn(A_EMAIL, A_PASSWORD);
  const B = await signIn(B_EMAIL, B_PASSWORD);
  const A_JWT = A.jwt, B_JWT = B.jwt, A_ID = A.userId, B_ID = B.userId;
  assert(A_ID !== B_ID, "tenant identity collision — aborting");
  const A_COOKIE = await signInCookie(A_EMAIL, A_PASSWORD);
  const B_COOKIE = await signInCookie(B_EMAIL, B_PASSWORD);

  const meA = await api(A_COOKIE, "/api/auth/me");
  const meB = await api(B_COOKIE, "/api/auth/me");
  assert(meA.status === 200 && meA.body.id === A_ID, `A cookie invalid: ${meA.status}`);
  assert(meB.status === 200 && meB.body.id === B_ID, `B cookie invalid: ${meB.status}`);
  log("    both sessions valid ✓\n");

  // ── seed private data in each tenant ─────────────────────────────
  log("  setup: seeding tenant-private data");
  const markerA = `tenant-a-private-${stamp}`;
  const markerB = `tenant-b-private-${stamp}`;

  // owner-scoped service-role seeds (bypasses RLS, same as app internals)
  const sfA = await service.from("saved_filters").insert({
    user_id: A_ID, name: markerA, filter_key: JSON.stringify({ q: markerA }),
    filters: JSON.stringify({ q: markerA }), page_name: "investors",
  }).select("id").single();
  const sfB = await service.from("saved_filters").insert({
    user_id: B_ID, name: markerB, filter_key: JSON.stringify({ q: markerB }),
    filters: JSON.stringify({ q: markerB }), page_name: "investors",
  }).select("id").single();
  assert(!sfA.error && !sfB.error, `saved_filters seed failed: ${JSON.stringify(sfA.error || sfB.error)}`);
  const A_SF_ID = sfA.data.id, B_SF_ID = sfB.data.id;

  // NOTE: provider CHECK constraint allows google|microsoft|other only
  const accA = await service.from("email_accounts").insert({
    user_id: A_ID, provider: "other", email_address: `a-${stamp}@example.com`,
    display_name: "Tenant A Account", smtp_host: "smtp.example.com", smtp_port: 587,
    smtp_user: "a", smtp_pass_encrypted: "x", smtp_secure: true,
  }).select("id").single();
  const accB = await service.from("email_accounts").insert({
    user_id: B_ID, provider: "other", email_address: `b-${stamp}@example.com`,
    display_name: "Tenant B Account", smtp_host: "smtp.example.com", smtp_port: 587,
    smtp_user: "b", smtp_pass_encrypted: "x", smtp_secure: true,
  }).select("id").single();
  assert(!accA.error && !accB.error, `email_accounts seed failed: ${JSON.stringify(accA.error || accB.error)}`);
  const A_ACC_ID = accA.data.id, B_ACC_ID = accB.data.id;

  const wuA = await service.from("email_warmup").insert({
    user_id: A_ID, account_id: A_ACC_ID, status: "active", current_stage: 1, day_number: 1,
  }).select("id").single();
  const wuB = await service.from("email_warmup").insert({
    user_id: B_ID, account_id: B_ACC_ID, status: "active", current_stage: 1, day_number: 1,
  }).select("id").single();
  assert(!wuA.error && !wuB.error, `email_warmup seed failed: ${JSON.stringify(wuA.error || wuB.error)}`);
  const A_WU_ID = wuA.data.id, B_WU_ID = wuB.data.id;

  const supA = await service.from("email_suppression_list").insert({
    user_id: A_ID, email_address: `a-victim-${stamp}@example.com`, reason: "manual", source: "manual",
  }).select("id").single();
  const supB = await service.from("email_suppression_list").insert({
    user_id: B_ID, email_address: `b-victim-${stamp}@example.com`, reason: "manual", source: "manual",
  }).select("id").single();
  assert(!supA.error && !supB.error, `suppression seed failed: ${JSON.stringify(supA.error || supB.error)}`);
  const A_SUP_ID = supA.data.id, B_SUP_ID = supB.data.id;

  // private notes on the SHARED investor dataset (post-010 privacy model)
  const { data: investors } = await service.from("investors").select("id").limit(1);
  assert(investors && investors.length === 1, "investors dataset empty — cannot test notes");
  const SHARED_INVESTOR = investors[0].id;

  const noteA = await service.from("data_change_log").insert({
    investor_id: SHARED_INVESTOR, field_name: "note", new_value: markerA,
    change_type: "update", source_type: "manual_entry", detected_by: A_ID,
  }).select("id").single();
  const noteB = await service.from("data_change_log").insert({
    investor_id: SHARED_INVESTOR, field_name: "note", new_value: markerB,
    change_type: "update", source_type: "manual_entry", detected_by: B_ID,
  }).select("id").single();
  assert(!noteA.error && !noteB.error, `notes seed failed: ${JSON.stringify(noteA.error || noteB.error)}`);
  const A_NOTE_ID = noteA.data.id, B_NOTE_ID = noteB.data.id;
  log(`    A: filter ${A_SF_ID.slice(0, 8)}… account ${A_ACC_ID.slice(0, 8)}… warmup ${A_WU_ID.slice(0, 8)}… suppression ${A_SUP_ID.slice(0, 8)}… note ${A_NOTE_ID.slice(0, 8)}…`);
  log(`    B: filter ${B_SF_ID.slice(0, 8)}… account ${B_ACC_ID.slice(0, 8)}… warmup ${B_WU_ID.slice(0, 8)}… suppression ${B_SUP_ID.slice(0, 8)}… note ${B_NOTE_ID.slice(0, 8)}…\n`);

  // ── 1. RLS layer: cross-tenant attempts must all fail ────────────
  log("  RLS layer — B (JWT) attacking A's rows");
  {
    const b = asUser(B_JWT);
    let r = await b.from("saved_filters").select("*").eq("id", A_SF_ID);
    record("RLS: B read A's saved filter → empty", (r.data || []).length === 0 && !r.error, JSON.stringify(r.data || r.error));
    r = await b.from("saved_filters").update({ name: "hijacked" }).eq("id", A_SF_ID);
    record("RLS: B update A's saved filter → 0 rows", (r.data || []).length === 0 && !r.error, JSON.stringify(r.data || r.error));
    r = await b.from("saved_filters").delete().eq("id", A_SF_ID);
    record("RLS: B delete A's saved filter → 0 rows", (r.data || []).length === 0 && !r.error, JSON.stringify(r.data || r.error));
    r = await b.from("email_accounts").select("*").eq("id", A_ACC_ID);
    record("RLS: B read A's email account → empty", (r.data || []).length === 0 && !r.error, JSON.stringify(r.data || r.error));
    r = await b.from("email_accounts").update({ smtp_pass_encrypted: "stolen" }).eq("id", A_ACC_ID);
    record("RLS: B update A's email account → 0 rows", (r.data || []).length === 0 && !r.error, JSON.stringify(r.data || r.error));
    r = await b.from("email_warmup").update({ status: "paused" }).eq("id", A_WU_ID);
    record("RLS: B update A's warmup → 0 rows", (r.data || []).length === 0 && !r.error, JSON.stringify(r.data || r.error));
    r = await b.from("email_suppression_list").select("*").eq("id", A_SUP_ID);
    record("RLS: B read A's suppression entry → empty", (r.data || []).length === 0 && !r.error, JSON.stringify(r.data || r.error));
    r = await b.from("email_suppression_list").delete().eq("id", A_SUP_ID);
    // authenticated has SELECT-only grants on this table: 42501 = blocked
    record("RLS: B delete A's suppression entry → blocked", !!r.error || (r.data || []).length === 0, JSON.stringify(r.error || r.data));
    r = await b.from("data_change_log").select("*").eq("id", A_NOTE_ID);
    record("RLS: B read A's private note → empty", (r.data || []).length === 0 && !r.error, JSON.stringify(r.data || r.error));
    r = await b.from("data_change_log").select("*").eq("investor_id", SHARED_INVESTOR).eq("field_name", "note");
    const sawOther = (r.data || []).some((x) => x.new_value === markerA);
    record("RLS: B sees no A notes on shared investor", !sawOther, JSON.stringify((r.data || []).slice(0, 3)));
    r = await b.from("data_change_log").update({ new_value: "forged" }).eq("id", A_NOTE_ID);
    // SELECT-only grants for authenticated: 42501 = blocked
    record("RLS: B update A's note → blocked", !!r.error || (r.data || []).length === 0, JSON.stringify(r.error || r.data));
    r = await b.from("data_change_log").delete().eq("id", A_NOTE_ID);
    record("RLS: B delete A's note → blocked", !!r.error || (r.data || []).length === 0, JSON.stringify(r.error || r.data));
    r = await b.from("profiles").select("*").eq("id", A_ID);
    record("RLS: B read A's profile → empty", (r.data || []).length === 0 && !r.error, JSON.stringify(r.data || r.error));
  }

  log("  RLS layer — A (JWT) attacking B's rows");
  {
    const a = asUser(A_JWT);
    let r = await a.from("saved_filters").select("*").eq("id", B_SF_ID);
    record("RLS: A read B's saved filter → empty", (r.data || []).length === 0 && !r.error, JSON.stringify(r.data || r.error));
    r = await a.from("saved_filters").delete().eq("id", B_SF_ID);
    record("RLS: A delete B's saved filter → 0 rows", (r.data || []).length === 0 && !r.error, JSON.stringify(r.data || r.error));
    r = await a.from("email_accounts").select("*").eq("id", B_ACC_ID);
    record("RLS: A read B's email account → empty", (r.data || []).length === 0 && !r.error, JSON.stringify(r.data || r.error));
    r = await a.from("email_warmup").update({ status: "paused" }).eq("id", B_WU_ID);
    record("RLS: A update B's warmup → 0 rows", (r.data || []).length === 0 && !r.error, JSON.stringify(r.data || r.error));
    r = await a.from("email_suppression_list").delete().eq("id", B_SUP_ID);
    record("RLS: A delete B's suppression entry → blocked", !!r.error || (r.data || []).length === 0, JSON.stringify(r.error || r.data));
    r = await a.from("data_change_log").select("*").eq("id", B_NOTE_ID);
    record("RLS: A read B's private note → empty", (r.data || []).length === 0 && !r.error, JSON.stringify(r.data || r.error));
    r = await a.from("data_change_log").select("*").eq("investor_id", SHARED_INVESTOR).eq("field_name", "note");
    const sawOther = (r.data || []).some((x) => x.new_value === markerB);
    record("RLS: A sees no B notes on shared investor", !sawOther, JSON.stringify((r.data || []).slice(0, 3)));
    r = await a.from("profiles").select("*").eq("id", B_ID);
    record("RLS: A read B's profile → empty", (r.data || []).length === 0 && !r.error, JSON.stringify(r.data || r.error));
  }

  log("  RLS layer — anonymous JWT sees nothing private");
  {
    const r1 = await asUser(undefined).from("saved_filters").select("count");
    const anonOk1 = !!r1.error || (r1.data || []).length === 0;
    record("RLS: anon read saved_filters → denied/empty", anonOk1, JSON.stringify(r1.error || r1.data));
    const r2 = await asUser(undefined).from("email_messages").select("id").limit(5);
    const anonOk2 = !!r2.error || (r2.data || []).length === 0;
    record("RLS: anon read email_messages → denied/empty", anonOk2, JSON.stringify(r2.error || r2.data));
    const r3 = await asUser(undefined).from("data_change_log").select("id").eq("field_name", "note");
    const anonOk3 = !!r3.error || (r3.data || []).length === 0;
    record("RLS: anon read notes → denied/empty", anonOk3, JSON.stringify(r3.error || r3.data));
  }

  // ── 2. RLS layer: ownership forgery (insert with foreign user_id) ─
  log("  RLS layer — ownership forgery");
  {
    const b = asUser(B_JWT);
    const forge = await b.from("email_accounts").insert({
      user_id: A_ID, provider: "other", email_address: `forged-${stamp}@example.com`,
      smtp_host: "evil.example.com", smtp_port: 25, smtp_user: "x", smtp_pass_encrypted: "x",
    }).select("id").single();
    const blocked = !!forge.error || !forge.data;
    record("RLS: B insert email_account owned by A → blocked", blocked, JSON.stringify(forge.error || forge.data));
    if (!blocked && forge.data?.id) await service.from("email_accounts").delete().eq("id", forge.data.id);
  }

  // ── 3. API layer: cross-tenant + tampering must all fail ─────────
  log("  API layer — B (cookie) attacking A");
  {
    let r = await api(B_COOKIE, `/api/email/suppression?email=${encodeURIComponent(`a-victim-${stamp}@example.com`)}`, { method: "DELETE" });
    const { data: stillThere } = await service.from("email_suppression_list").select("id").eq("id", A_SUP_ID).single();
    record("API: B DELETE A's suppression entry → not deleted", stillThere, `status ${r.status}, row gone=${!stillThere}`);

    r = await api(B_COOKIE, `/api/saved-filters?id=${A_SF_ID}`, { method: "DELETE" });
    const sf = await service.from("saved_filters").select("id").eq("id", A_SF_ID).single();
    record("API: B DELETE A's saved filter → survives", !!sf.data, `status ${r.status}, row gone=${!sf.data}`);

    r = await api(B_COOKIE, `/api/saved-filters?page=investors`);
    const leaked = JSON.stringify(r.body || {}).includes(markerA);
    record("API: B saved-filters list leaks no A marker", !leaked, `status ${r.status} leaked=${leaked}`);

    r = await api(B_COOKIE, `/api/email/warmup`, { method: "POST", body: JSON.stringify({ action: "pause", accountId: A_ACC_ID }) });
    const wu = await service.from("email_warmup").select("status").eq("id", A_WU_ID).single();
    record("API: B warmup-pause A's account → refused/404", (r.status === 404 || r.status === 403) && wu.data?.status === "active", `status ${r.status}, warmup=${wu.data?.status}`);

    r = await api(B_COOKIE, `/api/email/smtp/save`, { method: "POST", body: JSON.stringify({ host: "evil.example.com", user: "x", pass: "y", fromEmail: A_ID, provider: "custom_smtp" }) });
    const accStill = await service.from("email_accounts").select("smtp_host").eq("id", A_ACC_ID).single();
    record("API: B SMTP-save cannot overwrite A's account host", accStill.data?.smtp_host === "smtp.example.com", `status ${r.status}, host=${accStill.data?.smtp_host}`);

    r = await api(B_COOKIE, `/api/admin/users`, { method: "GET" });
    record("API: B admin users → 403/401", r.status === 403 || r.status === 401, `status ${r.status}`);

    r = await api(B_COOKIE, "/api/admin/users/role", { method: "POST", body: JSON.stringify({ userId: A_ID, action: "demote", confirmToken: A_ID }) });
    record("API: B demote A → 403/401", r.status === 403 || r.status === 401, `status ${r.status}`);

    // notes attribution probe
    r = await api(B_COOKIE, "/api/investors/notes", { method: "POST", body: JSON.stringify({ investorId: SHARED_INVESTOR, note: `xtenant-probe-b-${stamp}` }) });
    const noteOk = r.status === 201 && r.body?.note?.id;
    record("API: B note on shared investor → 201 attributed to B", noteOk, `status ${r.status}`);
    if (noteOk) {
      const row = await service.from("data_change_log").select("detected_by").eq("id", r.body.note.id).single();
      record("API: B note detected_by = B (never A)", row.data?.detected_by === B_ID, `detected_by=${row.data?.detected_by}`);
      await service.from("data_change_log").delete().eq("id", r.body.note.id);
    }
  }

  log("  API layer — unauthenticated attacks");
  {
    let r = await api(null, "/api/saved-filters?page=investors");
    record("API: anon saved-filters → 401", r.status === 401, `status ${r.status}`);
    r = await api(null, "/api/email/suppression");
    record("API: anon suppression list → 401", r.status === 401, `status ${r.status}`);
    r = await api(null, "/api/email/warmup", { method: "POST", body: JSON.stringify({ action: "pause", accountId: A_ACC_ID }) });
    record("API: anon warmup pause → 401", r.status === 401, `status ${r.status}`);
    r = await api(null, "/api/admin/users");
    record("API: anon admin users → 401", r.status === 401, `status ${r.status}`);
  }

  // ── 4. positive controls: legitimate flows still work ────────────
  log("  Positive controls — own data, both tenants");
  {
    const b = asUser(B_JWT);
    let r = await b.from("saved_filters").select("*").eq("id", B_SF_ID);
    record("RLS ctrl: B reads own filter", (r.data || []).length === 1 && !r.error, JSON.stringify(r.error || r.data?.[0]?.id));
    r = await b.from("data_change_log").select("*").eq("id", B_NOTE_ID);
    record("RLS ctrl: B reads own note", (r.data || []).length === 1 && !r.error, JSON.stringify(r.error || r.data?.[0]?.id));
    r = await b.from("data_change_log").select("*").eq("investor_id", SHARED_INVESTOR).neq("field_name", "note").limit(1);
    record("RLS ctrl: system provenance rows still visible", !r.error, JSON.stringify(r.error));

    let apiR = await api(B_COOKIE, "/api/saved-filters?page=investors");
    const seesOwn = JSON.stringify(apiR.body || {}).includes(markerB);
    record("API ctrl: B lists own filter via API", apiR.status === 200 && seesOwn, `status ${apiR.status} seesOwn=${seesOwn}`);

    apiR = await api(B_COOKIE, "/api/email/suppression");
    record("API ctrl: B suppression list OK", apiR.status === 200, `status ${apiR.status}`);

    apiR = await api(A_COOKIE, "/api/auth/me");
    record("API ctrl: A session still valid", apiR.status === 200 && apiR.body?.id === A_ID, `status ${apiR.status}`);
  }

  // ── cleanup (service role) — keep tenant accounts for audit ──────
  log("\n  cleanup: seeded rows removed (tenant accounts kept for audit)");
  await service.from("saved_filters").delete().in("id", [A_SF_ID, B_SF_ID]);
  await service.from("email_warmup").delete().in("id", [A_WU_ID, B_WU_ID]);
  await service.from("email_suppression_list").delete().in("id", [A_SUP_ID, B_SUP_ID]);
  await service.from("data_change_log").delete().in("id", [A_NOTE_ID, B_NOTE_ID]);
  await service.from("email_accounts").delete().in("id", [A_ACC_ID, B_ACC_ID]);
  // junk account created by the smtp/save tampering probe (B-owned)
  await service.from("email_accounts").delete().eq("user_id", B_ID).eq("smtp_host", "evil.example.com");

  // ── summary ──────────────────────────────────────────────────────
  const failed = results.filter((r) => !r.ok);
  log("\n" + "═".repeat(60));
  log(`  Cross-tenant isolation: ${passCount} passed, ${failCount} failed`);
  log("═".repeat(60));
  if (failed.length) {
    log("\nFailures:");
    failed.forEach((f) => log(`  ✘ ${f.name}\n      ${f.detail}`));
    process.exit(1);
  }
  log("\n  All cross-tenant attempts failed. Isolation holds.\n");
}

main().catch((err) => {
  console.error("\nFATAL:", err.message);
  process.exit(2);
});
