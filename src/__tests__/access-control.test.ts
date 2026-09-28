/**
 * Capital OS — Access Control Test Suite
 *
 * Verifies the authorization model end to end:
 *   A. STATIC  — every handler in src/app/api/admin/** guards with
 *               requireAdmin as its first statement (source scan).
 *   B. LIVE    — every admin route returns 401 without a session and
 *               403 with a non-admin session.
 *   C. LIVE    — an admin session actually passes the gate (positive control).
 *   D. IDOR    — cross-tenant access is refused on the routes that were
 *               historically vulnerable:
 *                 /api/email/suppression  (user derived from fetched row)
 *                 /api/email/warmup       (accountId trusted from input)
 *                 /api/dashboard/admin    (userId param unverified)
 *
 * The static scan always runs. Live sections self-skip when no server is
 * reachable at TEST_URL (default http://localhost:3456) — same convention
 * as security.test.ts.
 *
 * Required env (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   TEST_FOUNDER_EMAIL / TEST_FOUNDER_PASSWORD   (non-admin account)
 *   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD       (admin account)
 *   TEST_IDOR_VICTIM_ACCOUNT_ID / TEST_IDOR_VICTIM_USER_ID
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const TEST_TIMEOUT = 120_000;
const BASE_URL = process.env.TEST_URL || "http://localhost:3456";

// ── Server availability gate (integration sections skip when absent) ──
const serverAvailable = await fetch(`${BASE_URL}/api/auth/google`, {
  signal: AbortSignal.timeout(3000),
})
  .then(() => true)
  .catch(() => false);

// ════════════════════════════════════════════════════════
// A. STATIC SCAN — requireAdmin must be the first statement
// ════════════════════════════════════════════════════════

function* walkRouteFiles(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkRouteFiles(full);
    else if (entry.name === "route.ts") yield full;
  }
}

function extractHandlerBody(src: string, handler: string): string | null {
  const re = new RegExp(`export\\s+async\\s+function\\s+${handler}\\s*\\(`);
  const m = re.exec(src);
  if (!m) return null;
  const open = src.indexOf("{", m.index + m[0].length - 1);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

/** true when requireAdmin is the first meaningful statement of the body.
 *  Accepts both `await requireAdmin(...)` and the assignment form
 *  `const user = await requireAdmin(...)` — optionally wrapped in try { */
function guardsFirst(body: string, guard = "requireAdmin"): boolean {
  const inner = body.slice(body.indexOf("{") + 1);
  const guardIdx = inner.search(new RegExp(`await\\s+${guard}\\s*\\(`));
  if (guardIdx === -1) return false;
  const pre = inner
    .slice(0, guardIdx)
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/try\s*\{/g, "")
    .trim();
  // empty, or the tail of an assignment (`const user =`)
  return pre.length === 0 || /(?:const|let|var)\s+[\w$]+\s*=$/.test(pre);
}

describe("A. STATIC — admin route guard placement", () => {
  it("every admin handler's first statement is requireAdmin", () => {
    const adminDir = path.resolve(__dirname, "../app/api/admin");
    const violations: string[] = [];
    const handlers = ["GET", "POST", "PUT", "PATCH", "DELETE"];

    for (const file of walkRouteFiles(adminDir)) {
      const src = fs.readFileSync(file, "utf8");
      // The bootstrap endpoint is the one intentional exception: it must be
      // callable before ANY admin exists, so it guards with requireAuth and
      // fails closed via adminAlreadyConfigured() (never requireAdmin).
      const isBootstrap = file.includes(`${path.sep}setup${path.sep}`);
      for (const h of handlers) {
        const body = extractHandlerBody(src, h);
        if (!body) continue;
        if (isBootstrap) {
          // GET is read-only status; POST mutates and MUST fails-close.
          const ok =
            guardsFirst(body, "requireAuth") &&
            (h !== "POST" || body.includes("adminAlreadyConfigured"));
          if (!ok) {
            violations.push(`${path.relative(process.cwd(), file)} ${h} (bootstrap: requireAuth + fails-closed)`);
          }
        } else if (!guardsFirst(body, "requireAdmin")) {
          violations.push(`${path.relative(process.cwd(), file)} ${h}`);
        }
      }
    }

    expect(
      violations,
      `Handlers without requireAdmin as first statement:\n${violations.join("\n")}`
    ).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════
// LIVE SECTIONS — integration against a running server
// ════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const VICTIM_ACCOUNT_ID = process.env.TEST_IDOR_VICTIM_ACCOUNT_ID || "";
const VICTIM_USER_ID = process.env.TEST_IDOR_VICTIM_USER_ID || "";
const FOUNDER_EMAIL = process.env.TEST_FOUNDER_EMAIL || "";
const FOUNDER_PASSWORD = process.env.TEST_FOUNDER_PASSWORD || "";
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "";

/** Sign in via Supabase and return the session cookie string. */
async function signIn(email: string, password: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const jar = res.headers.getSetCookie?.() ?? [];
  const sbCookies = jar
    .filter((c) => c.startsWith("sb-"))
    .map((c) => c.split(";")[0]);
  return sbCookies.length ? sbCookies.join("; ") : null;
}

async function req(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
}

/** Enumerate every (method, path) admin route from the source tree. */
function adminRouteMatrix(): Array<{ method: string; path: string }> {
  const adminDir = path.resolve(__dirname, "../app/api/admin");
  const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  const routes: Array<{ method: string; path: string }> = [];
  for (const file of walkRouteFiles(adminDir)) {
    const src = fs.readFileSync(file, "utf8");
    const rel = path
      .relative(path.resolve(adminDir, "../.."), file)
      .replace(/\\/g, "/")
      .replace(/\/route\.ts$/, "");
    for (const m of methods) {
      if (new RegExp(`export\\s+async\\s+function\\s+${m}\\b`).test(src)) {
        routes.push({ method: m, path: `/${rel}` });
      }
    }
  }
  return routes;
}

const liveCredsReady = !!(
  serverAvailable &&
  FOUNDER_EMAIL &&
  FOUNDER_PASSWORD &&
  ADMIN_EMAIL &&
  ADMIN_PASSWORD &&
  SUPABASE_URL &&
  SUPABASE_ANON_KEY
);

describe.skipIf(!liveCredsReady)(
  "B/C. ADMIN GATING — live 401/403 matrix + positive control",
  () => {
    let adminCookie: string | null;
    let founderCookie: string | null;

    beforeAll(async () => {
      [adminCookie, founderCookie] = await Promise.all([
        signIn(ADMIN_EMAIL, ADMIN_PASSWORD),
        signIn(FOUNDER_EMAIL, FOUNDER_PASSWORD),
      ]);
    }, TEST_TIMEOUT);

    it(
      "all admin routes return 401/403 without a session",
      async () => {
        const routes = adminRouteMatrix();
        expect(routes.length).toBeGreaterThan(15);
        const failures: string[] = [];
        for (const r of routes) {
          const res = await req(r.path, {
            method: r.method,
            body: r.method === "GET" ? undefined : JSON.stringify({}),
          });
          if (res.status !== 401 && res.status !== 403) {
            failures.push(`${r.method} ${r.path} → ${res.status}`);
          }
        }
        expect(failures, failures.join("\n")).toHaveLength(0);
      },
      TEST_TIMEOUT
    );

    it(
      "all admin routes return 403 for a non-admin session",
      async () => {
        expect(founderCookie).toBeTruthy();
        const routes = adminRouteMatrix();
        const failures: string[] = [];
        for (const r of routes) {
          const res = await req(r.path, {
            method: r.method,
            headers: { Cookie: founderCookie! },
            body: r.method === "GET" ? undefined : JSON.stringify({}),
          });
          if (res.status !== 403) {
            failures.push(`${r.method} ${r.path} → ${res.status} (expected 403)`);
          }
        }
        expect(failures, failures.join("\n")).toHaveLength(0);
      },
      TEST_TIMEOUT
    );

    it(
      "positive control: admin session passes the gate",
      async () => {
        expect(adminCookie).toBeTruthy();
        const res = await req("/api/admin/users", {
          headers: { Cookie: adminCookie! },
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.users)).toBe(true);
        // users listing exposes signup source + confirmation state
        for (const u of data.users) {
          expect("signup_source" in u).toBe(true);
          expect(typeof u.confirmed).toBe("boolean");
        }
      },
      TEST_TIMEOUT
    );
  }
);

describe.skipIf(
  !liveCredsReady || !SERVICE_KEY || !VICTIM_ACCOUNT_ID || !VICTIM_USER_ID
)(
  "D. IDOR — cross-tenant access is refused",
  () => {
    let adminCookie: string | null;
    let founderCookie: string | null;
    let service: SupabaseClient;

    beforeAll(async () => {
      [adminCookie, founderCookie] = await Promise.all([
        signIn(ADMIN_EMAIL, ADMIN_PASSWORD),
        signIn(FOUNDER_EMAIL, FOUNDER_PASSWORD),
      ]);
      service = createClient(SUPABASE_URL, SERVICE_KEY);
    }, TEST_TIMEOUT);

    it(
      "suppression: POST is attributed to the caller, never to a victim row",
      async () => {
        expect(founderCookie).toBeTruthy();

        const probeEmail = `idor-probe-${Date.now()}@example.invalid`;
        const post = await req("/api/email/suppression", {
          method: "POST",
          headers: { Cookie: founderCookie! },
          body: JSON.stringify({
            emailAddress: probeEmail,
            reason: "access-control-test",
          }),
        });
        expect(post.status).toBe(200);

        // Ground truth: the row is attributed to the CALLER (founder), not
        // to the victim whose row sits in email_accounts — the old IDOR
        // derived the user from the first email_accounts row (the victim's).
        const { data: probeRows } = await service
          .from("email_suppression_list")
          .select("user_id")
          .eq("email_address", probeEmail);
        expect(probeRows ?? []).toHaveLength(1);
        expect(probeRows![0].user_id).not.toBe(VICTIM_USER_ID);

        const { data: victimRows } = await service
          .from("email_suppression_list")
          .select("id")
          .eq("user_id", VICTIM_USER_ID);
        expect(victimRows ?? []).toHaveLength(0);

        // cleanup of the exact probe address
        const del = await req(
          `/api/email/suppression?email=${encodeURIComponent(probeEmail)}`,
          { method: "DELETE", headers: { Cookie: founderCookie! } }
        );
        expect(del.status).toBe(200);
      },
      TEST_TIMEOUT
    );

    it(
      "warmup: non-owner gets 404 on GET and POST of a foreign account",
      async () => {
        expect(founderCookie).toBeTruthy();

        const get = await req(
          `/api/email/warmup?accountId=${VICTIM_ACCOUNT_ID}`,
          { headers: { Cookie: founderCookie! } }
        );
        expect(get.status).toBe(404);
        expect((await get.json()).warmup).toBeUndefined();

        const post = await req("/api/email/warmup", {
          method: "POST",
          headers: { Cookie: founderCookie! },
          body: JSON.stringify({
            action: "pause",
            accountId: VICTIM_ACCOUNT_ID,
          }),
        });
        expect(post.status).toBe(404);
        const body = await post.json();
        expect(body.warmup).toBeUndefined();
        expect(body.success).toBeUndefined();
      },
      TEST_TIMEOUT
    );

    it(
      "warmup: the owner can still read their own account status",
      async () => {
        expect(adminCookie).toBeTruthy();
        const res = await req(
          `/api/email/warmup?accountId=${VICTIM_ACCOUNT_ID}`,
          { headers: { Cookie: adminCookie! } }
        );
        expect(res.status).toBe(200);
        expect((await res.json()).warmup).toBeDefined();
      },
      TEST_TIMEOUT
    );

    it(
      "dashboard/admin: non-admin cannot enumerate another user's stats",
      async () => {
        expect(founderCookie).toBeTruthy();
        const res = await req(
          `/api/dashboard/admin?userId=${VICTIM_USER_ID}`,
          { headers: { Cookie: founderCookie! } }
        );
        expect(res.status).toBe(403);
      },
      TEST_TIMEOUT
    );

    it(
      "dashboard/admin: aggregate request without userId is allowed",
      async () => {
        expect(founderCookie).toBeTruthy();
        const res = await req("/api/dashboard/admin", {
          headers: { Cookie: founderCookie! },
        });
        expect(res.status).toBe(200);
      },
      TEST_TIMEOUT
    );
  }
);
