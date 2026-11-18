/**
 * Regression tests — tenant scoping for jobs, sequences and domain health.
 *
 * These pin the audit findings H1 (jobs IDOR), A-C1 (global pending sends) and
 * H3 (domain-check acting as the first email account). The SQL shim is mocked
 * and its statements/params are asserted, so a future change that drops the
 * ownership predicate fails here instead of leaking data in production.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  calls: [] as Array<{ sql: string; params: any[] }>,
}));

vi.mock("@/lib/db", () => ({
  query: vi.fn(async (sql: string, params: any[] = []) => {
    h.calls.push({ sql: String(sql), params });
    return [];
  }),
}));

vi.mock("@/lib/middleware/api-auth", () => ({
  requireAuth: vi.fn(async () => ({ id: "user-A", email: "a@example.com" })),
}));

vi.mock("@/lib/middleware/rate-limit", () => ({
  applyRateLimit: vi.fn(async () => null),
  RATE_LIMITS: { api: {} },
}));

const dns = vi.hoisted(() => ({
  check: vi.fn(async () => ({ domain: "acme.com", score: 90 })),
  stored: vi.fn(async () => null),
}));

vi.mock("@/lib/services/email/dns-checker", () => ({
  checkDomainHealth: dns.check,
  getStoredDomainHealth: dns.stored,
}));

import { getJob, cancelJob, retryJob, listJobs } from "@/lib/jobs/runner";
import { getPendingSends } from "@/lib/services/campaigns/sequence";
import { GET as domainCheckGET } from "@/app/api/email/domain-check/route";

beforeEach(() => {
  h.calls.length = 0;
  dns.check.mockClear();
  dns.stored.mockClear();
});

describe("jobs API ownership (H1)", () => {
  it("reads a job only when created_by matches the caller", async () => {
    await getJob("job-1", "user-A");
    const [call] = h.calls;
    expect(call.sql).toMatch(/created_by\s*=\s*\$2/);
    expect(call.params).toEqual(["job-1", "user-A"]);
  });

  it("passes the caller id, not a constant, into cancel and retry", async () => {
    await cancelJob("job-2", "user-B");
    await retryJob("job-3", "user-B");
    expect(h.calls[0].sql).toMatch(/created_by\s*=\s*\$2/);
    expect(h.calls[0].params).toEqual(["job-2", "user-B"]);
    expect(h.calls[1].sql).toMatch(/created_by\s*=\s*\$2/);
    expect(h.calls[1].params).toEqual(["job-3", "user-B"]);
  });

  it("lists only the caller's jobs", async () => {
    await listJobs(undefined, 20, "user-A");
    expect(h.calls[0].sql).toMatch(/created_by\s*=\s*\$2/);
    expect(h.calls[0].params).toEqual([20, "user-A"]);
  });
});

describe("sequence pending sends (A-C1)", () => {
  it("filters enrollments by the executing user", async () => {
    await getPendingSends("user-B", 5);
    const [call] = h.calls;
    expect(call.sql).toMatch(/e\.user_id\s*=\s*\$2/);
    expect(call.params).toEqual([5, "user-B"]);
  });
});

describe("domain-check identity (H3)", () => {
  const call = (url = "http://localhost/api/email/domain-check?domain=acme.com") =>
    domainCheckGET(new NextRequest(url));

  it("checks health as the signed-in user, never the first email account", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(dns.check).toHaveBeenCalledWith("user-A", "acme.com");
    // The route must not query email_accounts at all.
    expect(h.calls.some((c) => /email_accounts/i.test(c.sql))).toBe(false);
  });

  it("rejects a missing or malformed domain before any DNS work", async () => {
    expect((await call("http://localhost/api/email/domain-check")).status).toBe(400);
    expect((await call("http://localhost/api/email/domain-check?domain=https://evil.com/x")).status).toBe(400);
    expect(dns.check).not.toHaveBeenCalled();
  });
});
