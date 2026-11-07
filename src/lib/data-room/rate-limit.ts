// =============================================
// Data room rate limiting — shared decisions
// =============================================
// The counter itself lives in Postgres (see migration 033) because serverless
// instances do not share memory. This module holds the policy and the pure
// parts, so the numbers can be tested without a database.

import { createHash } from "crypto";

export interface RateLimitRule {
  /** Requests allowed inside one window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export const DATA_ROOM_LIMITS = {
  /**
   * One page open makes one request, so 30/minute per address leaves room for
   * an office behind a single NAT while still stopping enumeration.
   */
  ip: { limit: 30, windowSeconds: 60 } satisfies RateLimitRule,
  /** A token belongs to one invitee; 20/minute is generous for a person. */
  token: { limit: 20, windowSeconds: 60 } satisfies RateLimitRule,
} as const;

/** Tokens are credentials, so the limiter and the audit log only see a hash. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Best-effort client address. Proxy headers are attacker-controlled in
 * general, but on this deployment the platform sets them and the alternative —
 * having no address at all — removes the only per-client budget there is.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }
  const real = headers.get("x-real-ip")?.trim();
  if (real) return normalizeIp(real);
  return null;
}

export function normalizeIp(value: string): string | null {
  let ip = value.trim().toLowerCase();
  // IPv4 with a port (some proxies forward "1.2.3.4:5678").
  const withPort = ip.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (withPort) ip = withPort[1];
  if (!ip || ip.length > 64) return null;
  // Keep the key space clean: anything that is not an address or hostname
  // would become a shared bucket for everyone.
  if (!/^[0-9a-f.:\-_a-z]+$/.test(ip)) return null;
  return ip;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfter: number;
  hits: number;
  /** True when the limiter itself could not be consulted. */
  degraded: boolean;
}

export interface RpcClient {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

/**
 * Consume one unit from a bucket.
 *
 * Fails open on purpose: if the limiter is unreachable, taking the data room
 * offline would hurt the founder more than the missing limit does. The failure
 * is logged and surfaced as `degraded` so a caller can record it.
 */
export async function consumeRateLimit(
  client: RpcClient,
  bucket: "ip" | "token",
  identifier: string,
  rule: RateLimitRule
): Promise<RateLimitDecision> {
  try {
    const { data, error } = await client.rpc("consume_data_room_rate_limit", {
      p_bucket: bucket,
      p_identifier: identifier,
      p_window_seconds: rule.windowSeconds,
      p_limit: rule.limit,
    });
    if (error) throw new Error(error.message);

    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed?: boolean; hits?: number; retry_after?: number }
      | null
      | undefined;

    if (!row || typeof row.allowed !== "boolean") {
      throw new Error("unexpected rate limit response");
    }

    return {
      allowed: row.allowed,
      hits: Number(row.hits) || 0,
      retryAfter: Number(row.retry_after) || rule.windowSeconds,
      degraded: false,
    };
  } catch (err) {
    console.error(
      "[data-room] rate limiter unavailable:",
      err instanceof Error ? err.message : err
    );
    return { allowed: true, hits: 0, retryAfter: 0, degraded: true };
  }
}
