/**
 * Anti-pause heartbeat for the Supabase project (see docs/audit/
 * INFRASTRUCTURE_AND_SCALABILITY.md — the Sept 2026 outage was the free-tier
 * project auto-pausing while production was idle).
 *
 * Checks, in order:
 *   1. The project URL resolves over DNS (a paused/removed project may NXDOMAIN).
 *   2. GoTrue answers /auth/v1/health with the anon key.
 *   3. PostgREST answers /rest/v1/… the project's REST layer is live. A 401/403
 *      (RLS blocks anon) still proves the platform is UP; only network/5xx
 *      failures count as down.
 *
 * Needs only NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (the same
 * two repo secrets the auth-smtp watchdog already uses).
 *
 * Exit 0 = heartbeat pass; exit 1 = outage. Mirrored usage:
 *   node scripts/prod-heartbeat.cjs          # local / CI
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
if (!url || !anon) { console.error("missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"); process.exit(1); }

const dns = require("dns").promises;

async function main() {
  const ref = url.match(/([a-z0-9]{20})\.supabase\.([a-z.]+)/);
  if (!ref) { console.error("URL does not look like a supabase project:", url); process.exit(1); }
  const host = `${ref[1]}.supabase.${ref[2]}`;

  // 1. DNS
  try { await dns.resolve4(host); console.log("dns: ok", host); }
  catch (e) { console.error("dns: FAILED (project likely paused/removed):", e.message); process.exit(1); }

  // 2. GoTrue health
  const goTrue = async () => {
    try {
      const r = await fetch(`${url}/auth/v1/health`, { headers: { apikey: anon }, signal: AbortSignal.timeout(15000) });
      console.log("auth health:", r.status);
      if (r.status >= 500) throw new Error(`HTTP ${r.status}`);
    } catch (e) { console.error("auth health FAILED:", e.message); process.exit(1); }
  };

  // 3. REST layer reachable (RLS response is fine — proves the platform is up)
  const rest = async () => {
    try {
      const r = await fetch(`${url}/rest/v1/investors?select=id&limit=1`, {
        headers: { apikey: anon, Authorization: `Bearer ${anon}` },
        signal: AbortSignal.timeout(20000),
      });
      console.log("rest probe:", r.status, r.status >= 500 ? "FAILING" : "platform up");
      if (r.status >= 500) throw new Error(`HTTP ${r.status}`);
    } catch (e) { console.error("rest probe FAILED:", e.message); process.exit(1); }
  };

  await goTrue();
  await rest();
  console.log("HEARTBEAT PASS", new Date().toISOString());
}

main();
