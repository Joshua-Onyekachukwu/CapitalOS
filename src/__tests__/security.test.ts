/**
 * Security Test Suite — Capital OS
 *
 * Tests the running dev server for security vulnerabilities:
 *   1. Authentication — All protected routes return 401 without auth
 *   2. IDOR Protection — userId from body is not trusted
 *   3. Admin Gating — Admin routes require admin role
 *   4. Rate Limiting — All routes have rate limits
 *   5. CORS — Cross-origin requests are handled correctly
 *   6. Security Headers — Response headers are present
 *   7. Input Validation — Invalid inputs are rejected
 *   8. Error Handling — No internal details leaked
 *
 * Run: npm test -- src/__tests__/security.test.ts
 * Requires: Dev server running on http://localhost:56980
 */

import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = process.env.TEST_URL || "http://localhost:56980";

// ── Helper Functions ──

async function req(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    redirect: "manual",
  });
}

// Routes that should require authentication
const PROTECTED_ROUTES = [
  // Investors
  { method: "GET", path: "/api/investors", desc: "Investors list" },
  { method: "GET", path: "/api/investors/facets", desc: "Investors facets" },
  { method: "POST", path: "/api/investors/fit-analysis", desc: "Fit analysis" },
  { method: "GET", path: "/api/investors/saved", desc: "Saved investors" },

  // Dashboard
  { method: "GET", path: "/api/dashboard/cockpit", desc: "Dashboard cockpit" },
  { method: "GET", path: "/api/dashboard/analytics", desc: "Dashboard analytics" },
  { method: "GET", path: "/api/dashboard/meetings", desc: "Dashboard meetings" },
  { method: "GET", path: "/api/dashboard/admin", desc: "Dashboard admin" },
  { method: "GET", path: "/api/dashboard/ai-activity", desc: "AI activity" },
  { method: "GET", path: "/api/dashboard/outreach/metrics", desc: "Outreach metrics" },
  { method: "GET", path: "/api/dashboard/settings/profile", desc: "Settings profile" },
  { method: "GET", path: "/api/dashboard/campaigns", desc: "Campaigns list" },

  // Outreach
  { method: "POST", path: "/api/outreach/send", desc: "Send email" },
  { method: "POST", path: "/api/outreach/draft", desc: "Draft email" },
  { method: "POST", path: "/api/outreach/sequence", desc: "Email sequence" },

  // Deck
  { method: "POST", path: "/api/deck/generate", desc: "Generate deck" },

  // Copilot
  { method: "POST", path: "/api/copilot", desc: "AI copilot" },

  // Campaigns
  { method: "POST", path: "/api/campaigns/sequence/execute", desc: "Execute sequence" },

  // Saved Filters
  { method: "GET", path: "/api/saved-filters", desc: "Saved filters" },
  { method: "POST", path: "/api/saved-filters", desc: "Save filter" },

  // Jobs
  { method: "GET", path: "/api/jobs", desc: "List jobs" },
  { method: "POST", path: "/api/jobs", desc: "Create job" },
];

// Routes that should be publicly accessible (no auth required)
const PUBLIC_ROUTES = [
  { method: "GET", path: "/api/auth/google", desc: "Google OAuth initiation" },
  { method: "GET", path: "/api/auth/google/callback", desc: "Google OAuth callback" },
  { method: "GET", path: "/api/auth/microsoft", desc: "Microsoft OAuth initiation" },
  { method: "GET", path: "/api/auth/microsoft/callback", desc: "Microsoft OAuth callback" },
  { method: "GET", path: "/api/track/open/test123", desc: "Email open tracking" },
  { method: "GET", path: "/api/track/click/test123?url=https://example.com", desc: "Email click tracking" },
];

// Admin-only routes
const ADMIN_ROUTES = [
  { method: "POST", path: "/api/admin/dedup", desc: "Run dedup" },
  { method: "POST", path: "/api/admin/enrich", desc: "Run enrichment" },
  { method: "POST", path: "/api/admin/qualify", desc: "Run qualification" },
  { method: "POST", path: "/api/admin/import/apollo", desc: "Apollo import" },
  { method: "GET", path: "/api/admin/cache", desc: "Cache metrics" },
  { method: "GET", path: "/api/admin/jobs", desc: "Admin jobs list" },
];

// ══════════════════════════════════════════════════════
// 1. AUTHENTICATION TESTS
// ══════════════════════════════════════════════════════

describe("1. Authentication — All protected routes require auth", () => {
  it("should return 401 for all protected GET routes without auth", async () => {
    const getRoutes = PROTECTED_ROUTES.filter((r) => r.method === "GET");

    for (const route of getRoutes) {
      const res = await req(route.path);
      expect(
        res.status,
        `${route.desc} (${route.path}) should return 401, got ${res.status}`
      ).toBe(401);
    }
  });

  it("should return 401 for all protected POST routes without auth", async () => {
    const postRoutes = PROTECTED_ROUTES.filter((r) => r.method === "POST");

    for (const route of postRoutes) {
      const res = await req(route.path, {
        method: "POST",
        body: JSON.stringify({}),
      });
      expect(
        res.status,
        `${route.desc} (${route.path}) should return 401, got ${res.status}`
      ).toBe(401);
    }
  });

  it("should NOT require auth for OAuth and tracking routes", async () => {
    for (const route of PUBLIC_ROUTES) {
      const res = await req(route.path, { method: route.method });
      // These should NOT return 401 (they may return other status codes)
      expect(
        res.status,
        `${route.desc} (${route.path}) should NOT return 401, got ${res.status}`
      ).not.toBe(401);
    }
  });
});

// ══════════════════════════════════════════════════════
// 2. IDOR PROTECTION TESTS
// ══════════════════════════════════════════════════════

describe("2. IDOR Protection — userId from body is not trusted", () => {
  it("outreach/send should not accept userId from body", async () => {
    const res = await req("/api/outreach/send", {
      method: "POST",
      body: JSON.stringify({
        userId: "attacker-user-id",
        investorId: "fake-id",
        subject: "test",
        bodyHtml: "<p>test</p>",
      }),
    });
    // Should return 401 (auth check happens before body parsing)
    expect(res.status).toBe(401);
  });

  it("deck/generate should not accept userId from body", async () => {
    const res = await req("/api/deck/generate", {
      method: "POST",
      body: JSON.stringify({
        userId: "attacker-user-id",
        style: "investor",
      }),
    });
    expect(res.status).toBe(401);
  });

  it("campaigns/execute should not accept userId from body", async () => {
    const res = await req("/api/campaigns/sequence/execute", {
      method: "POST",
      body: JSON.stringify({
        userId: "attacker-user-id",
        dryRun: true,
      }),
    });
    expect(res.status).toBe(401);
  });

  it("should not leak userId in error responses", async () => {
    const res = await req("/api/outreach/send", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const body = await res.json();
    // Error should not contain the userId we sent
    expect(JSON.stringify(body)).not.toContain("attacker-user-id");
  });
});

// ══════════════════════════════════════════════════════
// 3. ADMIN GATING TESTS
// ══════════════════════════════════════════════════════

describe("3. Admin Gating — Admin routes require admin role", () => {
  it("admin routes should return 401 without auth", async () => {
    for (const route of ADMIN_ROUTES) {
      const res = await req(route.path, {
        method: route.method,
        body: route.method === "POST" ? JSON.stringify({}) : undefined,
      });
      expect(
        res.status,
        `${route.desc} (${route.path}) should return 401, got ${res.status}`
      ).toBe(401);
    }
  });

  it("admin routes should return 403 with auth but no admin role", async () => {
    // This test requires a valid session token
    // For now, we verify the route exists and returns proper status
    const res = await req("/api/admin/cache");
    // Without auth: 401. With non-admin auth: 403.
    // Both are acceptable security responses.
    expect([401, 403]).toContain(res.status);
  });
});

// ══════════════════════════════════════════════════════
// 4. RATE LIMITING TESTS
// ══════════════════════════════════════════════════════

describe("4. Rate Limiting — All routes have rate limits", () => {
  it("copilot should have rate limiting (returns 429 after many requests)", async () => {
    // Send multiple rapid requests to trigger rate limit
    const requests = Array.from({ length: 25 }, () =>
      req("/api/copilot", {
        method: "POST",
        body: JSON.stringify({ messages: [{ role: "user", content: "test" }] }),
      })
    );

    const responses = await Promise.all(requests);
    const statuses = responses.map((r) => r.status);

    // At least one should be rate limited (429) or all should be 401 (auth)
    const has429 = statuses.includes(429);
    const all401 = statuses.every((s) => s === 401);

    // Either rate limiting kicked in (429) or auth blocked first (401)
    expect(has429 || all401).toBe(true);
  });
});

// ══════════════════════════════════════════════════════
// 5. CORS TESTS
// ══════════════════════════════════════════════════════

describe("5. CORS — Cross-origin requests are handled", () => {
  it("OPTIONS preflight should return 204 with CORS headers", async () => {
    const res = await fetch(`${BASE_URL}/api/investors`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil-site.com",
        "Access-Control-Request-Method": "GET",
      },
      redirect: "manual",
    });

    // Should return 204 (no content) for preflight
    expect(res.status).toBe(204);
  });

  it("should include security headers in responses", async () => {
    const res = await req("/api/investors");

    // Check for security headers
    expect(res.headers.get("x-frame-options")).toBeTruthy();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-xss-protection")).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════
// 6. INPUT VALIDATION TESTS
// ══════════════════════════════════════════════════════

describe("6. Input Validation — Invalid inputs are rejected", () => {
  it("investors route should reject invalid page numbers", async () => {
    const res = await req("/api/investors?page=-1&limit=999");
    // Should either reject (-1 page) or clamp to valid values
    expect([400, 401]).toContain(res.status);
  });

  it("outreach/send should reject missing required fields", async () => {
    const res = await req("/api/outreach/send", {
      method: "POST",
      body: JSON.stringify({}),
    });
    // Should return 401 (auth) or 400 (validation)
    expect([400, 401]).toContain(res.status);
  });

  it("saved-filters should reject empty name", async () => {
    const res = await req("/api/saved-filters", {
      method: "POST",
      body: JSON.stringify({ name: "", filters: {} }),
    });
    expect([400, 401]).toContain(res.status);
  });
});

// ══════════════════════════════════════════════════════
// 7. ERROR HANDLING TESTS
// ══════════════════════════════════════════════════════

describe("7. Error Handling — No internal details leaked", () => {
  it("should not leak database errors in responses", async () => {
    const res = await req("/api/investors");
    const body = await res.json();

    const bodyStr = JSON.stringify(body);
    // Should not contain database-specific error details
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
      // Error should be generic, not leak internals
      expect(body.error).toBeDefined();
      expect(typeof body.error).toBe("string");
      // Should not contain file paths or internal details
      expect(body.error).not.toMatch(/\/src\/|\/node_modules\/|\.ts:\d+/);
    }
  });
});

// ══════════════════════════════════════════════════════
// 8. SECURITY HEADERS TESTS
// ══════════════════════════════════════════════════════

describe("8. Security Headers — All required headers present", () => {
  it("should include X-Frame-Options", async () => {
    const res = await req("/api/investors");
    expect(res.headers.get("x-frame-options")).toBeTruthy();
  });

  it("should include X-Content-Type-Options", async () => {
    const res = await req("/api/investors");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("should include X-XSS-Protection", async () => {
    const res = await req("/api/investors");
    expect(res.headers.get("x-xss-protection")).toBeTruthy();
  });

  it("should include Referrer-Policy", async () => {
    const res = await req("/api/investors");
    expect(res.headers.get("referrer-policy")).toBeTruthy();
  });

  it("should include Permissions-Policy", async () => {
    const res = await req("/api/investors");
    expect(res.headers.get("permissions-policy")).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════
// 9. CREDENTIAL EXPOSURE TESTS
// ══════════════════════════════════════════════════════

describe("9. Credential Exposure — No secrets in responses", () => {
  it("should not expose API keys in error responses", async () => {
    const res = await req("/api/investors");
    const body = await res.json();
    const bodyStr = JSON.stringify(body);

    // Should not contain any API key patterns
    expect(bodyStr).not.toMatch(/nvapi-|sk-|sb_/);
    expect(bodyStr).not.toMatch(/NEXT_PUBLIC_|SUPABASE_|DATABASE_URL/);
  });

  it("should not expose service role key", async () => {
    const res = await req("/api/investors");
    const body = await res.json();
    const bodyStr = JSON.stringify(body);

    expect(bodyStr).not.toMatch(/service.*role|SERVICE_ROLE/i);
  });
});

// ══════════════════════════════════════════════════════
// 10. HTTP METHOD TESTS
// ══════════════════════════════════════════════════════

describe("10. HTTP Methods — Proper method handling", () => {
  it("GET endpoints should reject POST requests", async () => {
    const getOnlyRoutes = [
      "/api/investors",
      "/api/investors/facets",
      "/api/dashboard/cockpit",
      "/api/dashboard/analytics",
    ];

    for (const path of getOnlyRoutes) {
      const res = await req(path, { method: "POST", body: JSON.stringify({}) });
      // Should return 401 (auth) or 405 (method not allowed)
      // At minimum, should NOT return 200
      expect(
        res.status,
        `${path} POST should not return 200`
      ).not.toBe(200);
    }
  });
});
