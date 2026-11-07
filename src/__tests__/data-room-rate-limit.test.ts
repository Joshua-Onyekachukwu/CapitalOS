// =============================================
// Data room rate limiting — pure decisions
// =============================================
// The counter lives in Postgres, so these tests cover the parts that decide
// behaviour without needing a database: how the caller is identified, that the
// credential is never stored raw, and that a limiter outage fails open loudly
// instead of taking the data room offline.

import { describe, it, expect, vi } from "vitest";
import {
  DATA_ROOM_LIMITS,
  clientIp,
  consumeRateLimit,
  hashToken,
  normalizeIp,
} from "@/lib/data-room/rate-limit";

describe("client address extraction", () => {
  it("takes the first address from x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.9, 70.41.3.18" });
    expect(clientIp(headers)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
  });

  it("returns null when the request carries no address", () => {
    expect(clientIp(new Headers())).toBeNull();
  });

  it("strips a forwarded port", () => {
    expect(normalizeIp("203.0.113.9:4711")).toBe("203.0.113.9");
  });

  it("rejects junk so unrelated callers cannot collapse into one shared bucket", () => {
    expect(normalizeIp("not an address <script>")).toBeNull();
    expect(normalizeIp("")).toBeNull();
  });
});

describe("token hashing", () => {
  it("is a stable sha256 digest", () => {
    const digest = hashToken("a".repeat(43));
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("a".repeat(43))).toBe(digest);
  });

  it("never contains the token it hashes", () => {
    const token = "secret-token-value-0000000000000000";
    expect(hashToken(token)).not.toContain(token);
  });
});

describe("consumeRateLimit", () => {
  const rule = { limit: 2, windowSeconds: 60 };
  const client = (result: { data: unknown; error: { message: string } | null }) => ({
    rpc: async () => result,
  });

  it("allows a request under the limit", async () => {
    const decision = await consumeRateLimit(
      client({ data: [{ allowed: true, hits: 1, retry_after: 59 }], error: null }),
      "ip",
      "203.0.113.9",
      rule
    );
    expect(decision).toMatchObject({ allowed: true, degraded: false, hits: 1 });
  });

  it("refuses over the limit and carries a retry hint", async () => {
    const decision = await consumeRateLimit(
      client({ data: [{ allowed: false, hits: 3, retry_after: 42 }], error: null }),
      "token",
      "hash",
      rule
    );
    expect(decision).toMatchObject({ allowed: false, retryAfter: 42, degraded: false });
  });

  it("fails open when the limiter returns an error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const decision = await consumeRateLimit(
      client({ data: null, error: { message: "boom" } }),
      "ip",
      "203.0.113.9",
      rule
    );
    expect(decision).toMatchObject({ allowed: true, degraded: true });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("fails open on a malformed response", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const decision = await consumeRateLimit(
      client({ data: { unexpected: true }, error: null }),
      "ip",
      "203.0.113.9",
      rule
    );
    expect(decision.degraded).toBe(true);
    spy.mockRestore();
  });

  it("gives each token a tighter budget than each address", () => {
    expect(DATA_ROOM_LIMITS.token.limit).toBeLessThan(DATA_ROOM_LIMITS.ip.limit);
    expect(DATA_ROOM_LIMITS.ip.windowSeconds).toBe(60);
  });
});
