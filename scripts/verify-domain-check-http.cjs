#!/usr/bin/env node
/**
 * HTTP-level two-account check for /api/email/domain-check (audit H3).
 *
 * The unit test in src/__tests__/tenant-scoping.test.ts mocks requireAuth, so
 * it does not prove the real cookie -> session -> user path. This script drives
 * a running Next server with real Supabase sessions:
 *
 *   1. creates two disposable confirmed users
 *   2. signs each in and builds the actual @supabase/ssr auth cookies
 *   3. seeds a cached domain-health row for the SAME domain per user, with a
 *      distinct marker in spf_record and a different overall_status
 *   4. calls GET /api/email/domain-check with each user's cookie
 *
 * If the route ever went back to picking the first email_accounts row (or any
 * shared identity), both accounts would read the same cached row and the
 * marker assertions fail.
 *
 * Usage:
 *   node scripts/verify-domain-check-http.cjs --base-url http://127.0.0.1:3100
 *
 * Exit 0 only when every check passes. All users and rows are removed.
 */

require("dotenv").config({ path: ".env.local", quiet: true });
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  require("dotenv").config({ path: ".env", quiet: true });
}

const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}

const baseArg = process.argv.indexOf("--base-url");
const BASE = (baseArg >= 0 ? process.argv[baseArg + 1] : "http://127.0.0.1:3100").replace(/\/$/, "");
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const stamp = Date.now();
const domain = `tenant-check-${stamp}.example`;
const markerA = `v=spf1 tenant=a-${stamp} ~all`;
const markerB = `v=spf1 tenant=b-${stamp} ~all`;

const results = { base_url: BASE, domain, checks: [], users: [] };

function check(name, pass, detail) {
  results.checks.push({ name, pass, detail });
}

async function makeUser(label) {
  const email = `domain-check-${label}-${stamp}@capitalos.test`;
  const password = `${crypto.randomBytes(24).toString("base64url")}aA1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Domain Check ${label}`, purpose: "domain-check identity verification" },
  });
  if (error || !data?.user) throw new Error(`create ${label}: ${error?.message || "no user"}`);
  results.users.push(data.user.id);
  return { id: data.user.id, email, password };
}

/** Sign in and turn the session into the cookie header Next will parse. */
async function sessionCookie(user) {
  const authClient = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await authClient.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error || !data?.session) throw new Error(`sign in ${user.email}: ${error?.message || "no session"}`);

  const jar = new Map();
  const ssr = createServerClient(URL, ANON, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll(list) {
        for (const c of list) {
          if (c.value === undefined) jar.delete(c.name);
          else jar.set(c.name, c.value);
        }
      },
    },
  });
  const { error: setErr } = await ssr.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (setErr) throw new Error(`set session: ${setErr.message}`);
  return {
    cookie: [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; "),
    cookieNames: [...jar.keys()],
  };
}

async function seedHealth(userId, marker, overallStatus) {
  // `email_domain_health` has no unique (user_id, domain) constraint, so the
  // app's upsert cannot persist and this script seeds with delete + insert.
  // That is reported as a separate finding; it does not affect identity here.
  await admin.from("email_domain_health").delete().eq("user_id", userId).eq("domain", domain);
  const { error } = await admin.from("email_domain_health").insert({
    user_id: userId,
    domain,
    spf_valid: true,
    spf_record: marker,
    dkim_valid: overallStatus === "good",
    dkim_record: overallStatus === "good" ? "v=DKIM1; k=rsa; p=tenant-check" : null,
    dmarc_valid: overallStatus === "good",
    dmarc_record: overallStatus === "good" ? "v=DMARC1; p=none" : null,
    mx_valid: true,
    mx_records: [`mx.${domain}`],
    overall_status: overallStatus,
    last_checked_at: new Date().toISOString(),
    details: { seeded_by: "verify-domain-check-http", marker },
  });
  if (error) throw new Error(`seed health for ${userId}: ${error.message}`);
}

async function call(path, cookie) {
  const res = await fetch(`${BASE}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-JSON (e.g. an HTML error page) is kept as text for the detail
  }
  return { status: res.status, json, text };
}

(async () => {
  try {
    // Warm the route: the first hit in `next dev` compiles it, and a compiled
    // request is what a deployed server always sees.
    await call("/api/email/domain-check");

    const a = await makeUser("a");
    const b = await makeUser("b");
    const sessionA = await sessionCookie(a);
    const sessionB = await sessionCookie(b);

    check("sign-in produced auth cookies", sessionA.cookie.length > 0 && sessionB.cookie.length > 0, {
      names: sessionA.cookieNames,
    });

    await seedHealth(a.id, markerA, "good");
    await seedHealth(b.id, markerB, "failing");

    const path = `/api/email/domain-check?domain=${encodeURIComponent(domain)}`;
    const resA = await call(path, sessionA.cookie);
    const resB = await call(path, sessionB.cookie);

    check("A gets 200 with its own cookie", resA.status === 200, { status: resA.status, body: resA.json });
    check("B gets 200 with its own cookie", resB.status === 200, { status: resB.status, body: resB.json });

    check(
      "A reads A's cached row (marker and status)",
      resA.json?.domain?.spfRecord === markerA && resA.json?.domain?.overallStatus === "good",
      { spfRecord: resA.json?.domain?.spfRecord, status: resA.json?.domain?.overallStatus }
    );
    check(
      "B reads B's cached row (marker and status)",
      resB.json?.domain?.spfRecord === markerB && resB.json?.domain?.overallStatus === "failing",
      { spfRecord: resB.json?.domain?.spfRecord, status: resB.json?.domain?.overallStatus }
    );

    check("A's response never contains B's marker", !resA.text.includes(markerB), {
      leaked: resA.text.includes(markerB),
    });
    check("B's response never contains A's marker", !resB.text.includes(markerA), {
      leaked: resB.text.includes(markerA),
    });

    // The route must not be reachable without a session.
    const anon = await call(path);
    check("unauthenticated request is 401", anon.status === 401, { status: anon.status });

    // Hostname validation still applies after the identity fix.
    const bad = await call("/api/email/domain-check?domain=https://evil.com/x", sessionA.cookie);
    check("malformed domain is 400", bad.status === 400, { status: bad.status });

    results.ok = results.checks.every((c) => c.pass);
    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    console.error("verification failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await admin.from("email_domain_health").delete().eq("domain", domain).then(
      () => {},
      () => {}
    );
    for (const id of results.users) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) console.error(`cleanup: could not delete user ${id.slice(0, 8)}…: ${error.message}`);
    }
    process.exit(results.ok ? 0 : 1);
  }
})();
