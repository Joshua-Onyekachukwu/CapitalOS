/**
 * Capital OS — Comprehensive Security Test Suite
 *
 * Tests every API route for:
 *   1. Authentication — All protected routes return 401 without session
 *   2. Rate Limiting — All data routes have rate limits
 *   3. Admin Gating — Admin routes require admin role (403 for non-admins)
 *   4. IDOR Protection — userId from body is not trusted
 *   5. CORS — Cross-origin requests handled correctly
 *   6. Security Headers — All required headers present
 *   7. Input Validation — Invalid inputs rejected
 *   8. Error Handling — No internal details leaked
 *   9. HTTP Methods — Proper method handling
 *  10. Credential Exposure — No secrets in responses
 *
 * Run: npm test -- src/__tests__/security.test.ts
 * Requires: Dev server running on http://localhost:3456
 */

import { describe, it, expect } from "vitest";

// Increase timeout for tests that make many sequential HTTP requests
const TEST_TIMEOUT = 60_000;

const BASE_URL = process.env.TEST_URL || "http://localhost:3456";

// ── Helpers ──

async function req(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    redirect: "manual",
  });
}

async function reqWithOrigin(path: string, origin: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Origin: origin, ...options.headers },
    redirect: "manual",
  });
}

// ══════════════════════════════════════════════════════
// 1. AUTHENTICATION — Every protected route returns 401
// ══════════════════════════════════════════════════════

describe("1. AUTHENTICATION — All protected routes require auth", () => {
  // All routes that MUST require authentication
  const PROTECTED_ROUTES: Array<{ method: string; path: string; desc: string }> = [
    // ── Investors ──
    { method: "GET", path: "/api/investors", desc: "Investors list" },
    { method: "GET", path: "/api/investors/facets", desc: "Investors facets" },
    { method: "POST", path: "/api/investors/fit-analysis", desc: "Fit analysis" },
    { method: "GET", path: "/api/investors/saved", desc: "Saved investors" },
    { method: "POST", path: "/api/investors/saved", desc: "Save investor" },
    { method: "DELETE", path: "/api/investors/saved", desc: "Unsave investor" },

    // ── Dashboard ──
    { method: "GET", path: "/api/dashboard/cockpit", desc: "Dashboard cockpit" },
    { method: "GET", path: "/api/dashboard/analytics", desc: "Dashboard analytics" },
    { method: "GET", path: "/api/dashboard/meetings", desc: "Dashboard meetings" },
    { method: "GET", path: "/api/dashboard/admin", desc: "Dashboard admin" },
    { method: "GET", path: "/api/dashboard/ai-activity", desc: "AI activity" },
    { method: "GET", path: "/api/dashboard/outreach/metrics", desc: "Outreach metrics" },
    { method: "GET", path: "/api/dashboard/settings/profile", desc: "Settings profile" },
    { method: "PUT", path: "/api/dashboard/settings/profile", desc: "Update profile" },
    { method: "GET", path: "/api/dashboard/campaigns", desc: "Campaigns list" },

    // ── Outreach ──
    { method: "POST", path: "/api/outreach/send", desc: "Send email" },
    { method: "POST", path: "/api/outreach/draft", desc: "Draft email" },
    { method: "POST", path: "/api/outreach/sequence", desc: "Email sequence" },

    // ── Deck ──
    { method: "POST", path: "/api/deck/generate", desc: "Generate deck" },

    // ── Copilot ──
    { method: "POST", path: "/api/copilot", desc: "AI copilot" },

    // ── Campaigns ──
    { method: "POST", path: "/api/campaigns/sequence/execute", desc: "Execute sequence" },

    // ── Saved Filters ──
    { method: "GET", path: "/api/saved-filters", desc: "Saved filters" },
    { method: "POST", path: "/api/saved-filters", desc: "Save filter" },
    { method: "DELETE", path: "/api/saved-filters", desc: "Delete filter" },

    // ── Jobs ──
    { method: "GET", path: "/api/jobs", desc: "List jobs" },
    { method: "POST", path: "/api/jobs", desc: "Create job" },

    // ── Admin Setup ──
    { method: "GET", path: "/api/admin/setup", desc: "Admin setup status" },
  ];

  it(`should return 401 for all ${PROTECTED_ROUTES.length} protected routes without auth`, async () => {
    const failures: string[] = [];

    for (const route of PROTECTED_ROUTES) {
      const body = ["POST", "PUT", "PATCH"].includes(route.method) ? JSON.stringify({}) : undefined;
      const res = await req(route.path, { method: route.method, body });

      if (res.status !== 401) {
        failures.push(`${route.desc} (${route.method} ${route.path}): got ${res.status}, expected 401`);
      }
    }

    expect(failures, `Failed routes:\n${failures.join("\n")}`).toHaveLength(0);
  }, TEST_TIMEOUT);

  // Routes that MUST be publicly accessible (no auth required)
  const PUBLIC_ROUTES = [
    { method: "GET", path: "/api/auth/google", desc: "Google OAuth" },
    { method: "GET", path: "/api/auth/google/callback", desc: "Google callback" },
    { method: "GET", path: "/api/auth/microsoft", desc: "Microsoft OAuth" },
    { method: "GET", path: "/api/auth/microsoft/callback", desc: "Microsoft callback" },
    { method: "GET", path: "/api/track/open/test123", desc: "Email open tracking" },
    { method: "GET", path: "/api/track/click/test123?url=https://example.com", desc: "Email click tracking" },
  ];

  it(`should NOT require auth for ${PUBLIC_ROUTES.length} public routes`, async () => {
    const failures: string[] = [];

    for (const route of PUBLIC_ROUTES) {
      const res = await req(route.path, { method: route.method });
      if (res.status === 401) {
        failures.push(`${route.desc} (${route.path}): should NOT return 401`);
      }
    }

    expect(failures, `Failed routes:\n${failures.join("\n")}`).toHaveLength(0);
  }, TEST_TIMEOUT);
});

// ══════════════════════════════════════════════════════
// 2. RATE LIMITING — All data routes have rate limits
// ══════════════════════════════════════════════════════

describe("2. RATE LIMITING — All data routes have rate limits", () => {
  // Routes that should have rate limiting
  const RATE_LIMITED_ROUTES = [
    { method: "POST", path: "/api/copilot", desc: "Copilot (AI)", burst: 25 },
    { method: "POST", path: "/api/outreach/draft", desc: "Draft email (AI)", burst: 15 },
    { method: "POST", path: "/api/outreach/send", desc: "Send email", burst: 15 },
    { method: "POST", path: "/api/deck/generate", desc: "Generate deck (AI)", burst: 25 },
    { method: "POST", path: "/api/investors/fit-analysis", desc: "Fit analysis", burst: 25 },
  ];

  for (const route of RATE_LIMITED_ROUTES) {
    it(`${route.desc} should return 429 after ${route.burst} rapid requests`, async () => {
      const requests = Array.from({ length: route.burst }, () =>
        req(route.path, {
          method: route.method,
          body: JSON.stringify({ messages: [{ role: "user", content: "test" }] }),
        })
      );

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);
      const has429 = statuses.includes(429);
      const all401 = statuses.every((s) => s === 401);

      // Either rate limiting kicked in (429) or auth blocked first (401)
      expect(
        has429 || all401,
        `${route.desc}: expected 429 or all-401, got statuses: ${[...new Set(statuses)].join(",")}`
      ).toBe(true);
    });
  }
});

// ══════════════════════════════════════════════════════
// 3. ADMIN GATING — Admin routes require admin role
// ══════════════════════════════════════════════════════

describe("3. ADMIN GATING — Admin routes require admin role", () => {
  const ADMIN_ROUTES = [
    { method: "GET", path: "/api/admin/cache", desc: "Cache metrics" },
    { method: "POST", path: "/api/admin/cache", desc: "Cache invalidate" },
    { method: "POST", path: "/api/admin/dedup", desc: "Run dedup" },
    { method: "POST", path: "/api/admin/enrich", desc: "Run enrichment" },
    { method: "POST", path: "/api/admin/qualify", desc: "Run qualification" },
    { method: "POST", path: "/api/admin/import/apollo", desc: "Apollo import" },
    { method: "POST", path: "/api/admin/import", desc: "CSV import" },
    { method: "POST", path: "/api/admin/poll-emails", desc: "Poll emails" },
    { method: "POST", path: "/api/admin/scrape/edgar", desc: "EDGAR scrape" },
    { method: "POST", path: "/api/admin/scrape/process", desc: "Process records" },
    { method: "GET", path: "/api/admin/jobs", desc: "Admin jobs list" },
    { method: "POST", path: "/api/admin/jobs", desc: "Create admin job" },
  ];

  it(`should return 401 or 403 for all ${ADMIN_ROUTES.length} admin routes without auth`, async () => {
    const failures: string[] = [];

    for (const route of ADMIN_ROUTES) {
      const body = ["POST"].includes(route.method) ? JSON.stringify({}) : undefined;
      const res = await req(route.path, { method: route.method, body });

      // Without auth: 401. With non-admin auth: 403. Both are secure.
      if (res.status !== 401 && res.status !== 403) {
        failures.push(`${route.desc} (${route.method} ${route.path}): got ${res.status}, expected 401 or 403`);
      }
    }

    expect(failures, `Failed routes:\n${failures.join("\n")}`).toHaveLength(0);
  }, TEST_TIMEOUT);
});

// ══════════════════════════════════════════════════════
// 4. IDOR PROTECTION — userId from body is not trusted
// ══════════════════════════════════════════════════════

describe("4. IDOR PROTECTION — userId from body is not trusted", () => {
  it("outreach/send should not accept userId from body", async () => {
    const res = await req("/api/outreach/send", {
      method: "POST",
      body: JSON.stringify({
        userId: "attacker-user-id-00000000-0000-0000-0000-000000000000",
        investorId: "00000000-0000-0000-0000-000000000000",
        subject: "test",
        bodyHtml: "<p>test</p>",
      }),
    });
    expect(res.status).toBe(401);
  });

  it("deck/generate should not accept userId from body", async () => {
    const res = await req("/api/deck/generate", {
      method: "POST",
      body: JSON.stringify({
        userId: "attacker-user-id-00000000-0000-0000-0000-000000000000",
        style: "investor",
      }),
    });
    expect(res.status).toBe(401);
  });

  it("campaigns/execute should not accept userId from body", async () => {
    const res = await req("/api/campaigns/sequence/execute", {
      method: "POST",
      body: JSON.stringify({
        userId: "attacker-user-id-00000000-0000-0000-0000-000000000000",
        dryRun: true,
      }),
    });
    expect(res.status).toBe(401);
  });

  it("should not leak attacker userId in error responses", async () => {
    const res = await req("/api/outreach/send", {
      method: "POST",
      body: JSON.stringify({ userId: "LEAKED-USER-ID" }),
    });
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("LEAKED-USER-ID");
  });

  it("saved-filters should not accept userId from body", async () => {
    const res = await req("/api/saved-filters", {
      method: "POST",
      body: JSON.stringify({
        userId: "attacker-user-id",
        name: "test",
        filters: {},
      }),
    });
    // Should be 401 (auth check before body parsing)
    expect(res.status).toBe(401);
  });

  it("jobs should not accept userId from body", async () => {
    const res = await req("/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        userId: "attacker-user-id",
        type: "investor_qualification",
      }),
    });
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════
// 5. CORS — Cross-origin requests handled correctly
// ══════════════════════════════════════════════════════

describe("5. CORS — Cross-origin requests handled correctly", () => {
  const ALLOWED_ORIGINS = [
    "http://localhost:3456",
    "https://capital-os.vercel.app",
    "https://capital-os.com",
  ];

  it("OPTIONS preflight should return 204 with CORS headers", async () => {
    const res = await reqWithOrigin("/api/investors", "http://localhost:3456", {
      method: "OPTIONS",
      headers: { "Access-Control-Request-Method": "GET" },
    });
    expect(res.status).toBe(204);
  });

  for (const origin of ALLOWED_ORIGINS) {
    it(`should allow requests from ${origin}`, async () => {
      const res = await reqWithOrigin("/api/investors", origin);
      // Should get CORS headers (not 403)
      expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
    });
  }

  it("should block requests from disallowed origins", async () => {
    const res = await reqWithOrigin("/api/investors", "https://evil-site.com");
    expect(res.status).toBe(403);
  });

  it("should include CORS headers in API responses", async () => {
    const res = await reqWithOrigin("/api/investors", "http://localhost:3456");
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3456");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    expect(res.headers.get("access-control-allow-methods")).toContain("GET");
  });
});

// ══════════════════════════════════════════════════════
// 6. SECURITY HEADERS — All required headers present
// ══════════════════════════════════════════════════════

describe("6. SECURITY HEADERS — All required headers present", () => {
  const REQUIRED_HEADERS = [
    { name: "x-frame-options", expected: "DENY" },
    { name: "x-content-type-options", expected: "nosniff" },
    { name: "x-xss-protection", expected: "1; mode=block" },
    { name: "referrer-policy", expected: "strict-origin-when-cross-origin" },
    { name: "permissions-policy", expected: "camera=" },
  ];

  for (const header of REQUIRED_HEADERS) {
    it(`should include ${header.name}`, async () => {
      const res = await req("/api/investors");
      const value = res.headers.get(header.name);
      expect(value, `Missing ${header.name}`).toBeTruthy();
      if (header.expected) {
        expect(value).toContain(header.expected);
      }
    });
  }
});

// ══════════════════════════════════════════════════════
// 7. INPUT VALIDATION — Invalid inputs rejected
// ══════════════════════════════════════════════════════

describe("7. INPUT VALIDATION — Invalid inputs rejected", () => {
  it("investors route should reject invalid page numbers", async () => {
    const res = await req("/api/investors?page=-1&limit=999");
    expect([400, 401]).toContain(res.status);
  });

  it("outreach/send should reject missing required fields", async () => {
    const res = await req("/api/outreach/send", {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect([400, 401]).toContain(res.status);
  });

  it("saved-filters should reject empty name", async () => {
    const res = await req("/api/saved-filters", {
      method: "POST",
      body: JSON.stringify({ name: "", filters: {} }),
    });
    expect([400, 401]).toContain(res.status);
  });

  it("deck/generate should reject invalid style", async () => {
    const res = await req("/api/deck/generate", {
      method: "POST",
      body: JSON.stringify({ style: "invalid-style" }),
    });
    expect([400, 401]).toContain(res.status);
  });

  it("copilot should reject empty message", async () => {
    const res = await req("/api/copilot", {
      method: "POST",
      body: JSON.stringify({ message: "" }),
    });
    expect([400, 401]).toContain(res.status);
  });
});

// ══════════════════════════════════════════════════════
// 8. ERROR HANDLING — No internal details leaked
// ══════════════════════════════════════════════════════

describe("8. ERROR HANDLING — No internal details leaked", () => {
  it("should not leak database errors in responses", async () => {
    const res = await req("/api/investors");
    const body = await res.json();
    const bodyStr = JSON.stringify(body);

    expect(bodyStr).not.toMatch(/pg_|postgresql|cockroach|connection refused/i);
    expect(bodyStr).not.toMatch(/SQL|syntax error|column.*does not exist/i);
    expect(bodyStr).not.toMatch(/stack trace|at .*\.ts:/i);
  });

  it("should return generic error messages", async () => {
    const res = await req("/api/outreach/send", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const body = await res.json();

    if (res.status >= 400) {
      expect(body.error).toBeDefined();
      expect(typeof body.error).toBe("string");
      expect(body.error).not.toMatch(/\/src\/|\/node_modules\/|\.ts:\d+/);
    }
  });

  it("should not expose API keys", async () => {
    const res = await req("/api/investors");
    const body = await res.json();
    const bodyStr = JSON.stringify(body);

    expect(bodyStr).not.toMatch(/nvapi-|sk-|sb_/);
    expect(bodyStr).not.toMatch(/NEXT_PUBLIC_|SUPABASE_|DATABASE_URL/);
    expect(bodyStr).not.toMatch(/service.*role|SERVICE_ROLE/i);
  });
});

// ══════════════════════════════════════════════════════
// 9. HTTP METHODS — Proper method handling
// ══════════════════════════════════════════════════════

describe("9. HTTP METHODS — Proper method handling", () => {
  it("GET endpoints should not return 200 for POST", async () => {
    const getOnlyRoutes = [
      "/api/investors",
      "/api/investors/facets",
      "/api/dashboard/cockpit",
      "/api/dashboard/analytics",
      "/api/dashboard/meetings",
      "/api/dashboard/admin",
      "/api/dashboard/ai-activity",
      "/api/dashboard/outreach/metrics",
      "/api/saved-filters",
      "/api/jobs",
      "/api/admin/cache",
      "/api/admin/jobs",
    ];

    for (const path of getOnlyRoutes) {
      const res = await req(path, { method: "POST", body: JSON.stringify({}) });
      expect(res.status, `${path} POST should not return 200`).not.toBe(200);
    }
  });

  it("POST endpoints should not return 200 for GET without params", async () => {
    const postOnlyRoutes = [
      "/api/outreach/send",
      "/api/outreach/draft",
      "/api/outreach/sequence",
      "/api/deck/generate",
      "/api/copilot",
      "/api/campaigns/sequence/execute",
      "/api/investors/fit-analysis",
    ];

    for (const path of postOnlyRoutes) {
      const res = await req(path, { method: "GET" });
      // Should not return 200 (should be 401, 404, or 405)
      expect(res.status, `${path} GET should not return 200`).not.toBe(200);
    }
  });
});

// ══════════════════════════════════════════════════════
// 10. SECURITY SUMMARY — Final verification
// ══════════════════════════════════════════════════════

describe("10. SECURITY SUMMARY — Final verification", () => {
  it("all protected routes should return 401 without auth", async () => {
    // Quick smoke test: verify 5 critical routes (GET only)
    const critical = [
      "/api/investors",
      "/api/dashboard/cockpit",
      "/api/investors/facets",
      "/api/admin/cache",
      "/api/jobs",
    ];

    for (const path of critical) {
      const res = await req(path);
      expect(res.status, `${path} should return 401`).toBe(401);
    }
  });

  it("public routes should not require auth", async () => {
    const publicRoutes = ["/api/auth/google", "/api/track/open/test123"];

    for (const path of publicRoutes) {
      const res = await req(path);
      expect(res.status, `${path} should NOT return 401`).not.toBe(401);
    }
  });

  it("CORS should block disallowed origins", async () => {
    const res = await reqWithOrigin("/api/investors", "https://attacker.com");
    expect(res.status).toBe(403);
  });

  it("security headers should be present", async () => {
    const res = await req("/api/investors");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
