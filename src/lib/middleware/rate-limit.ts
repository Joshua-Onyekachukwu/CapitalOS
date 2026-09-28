// =============================================
// Rate Limiting Middleware
// =============================================
// Sliding fixed-window rate limiter with a pluggable backend.
//
// When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are configured,
// counters live in Upstash Redis via an atomic INCR — limits survive
// restarts and are shared across every serverless instance. Without Redis
// (or when Redis is unreachable) the limiter falls back to the original
// per-process in-memory Map.
//
// `checkRateLimit` and `applyRateLimit` are async: a distributed counter
// requires a round trip. All call sites await the result.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

// Clean up expired in-memory entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
      if (now > entry.resetAt) memoryStore.delete(key);
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix?: string; // Optional prefix for the key
}

/** Rate limit configurations for different endpoints. */
export const RATE_LIMITS = {
  // AI operations: 20 per minute
  ai: { windowMs: 60_000, maxRequests: 20, keyPrefix: "ai" },
  // Email sending: 10 per minute
  email: { windowMs: 60_000, maxRequests: 10, keyPrefix: "email" },
  // Import operations: 5 per minute
  import: { windowMs: 60_000, maxRequests: 5, keyPrefix: "import" },
  // General API: 100 per minute
  api: { windowMs: 60_000, maxRequests: 100, keyPrefix: "api" },
  // Auth: 10 per minute (login attempts)
  auth: { windowMs: 60_000, maxRequests: 10, keyPrefix: "auth" },
} as const;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  backend: "redis" | "memory";
}

// ── Redis backend (Upstash REST) ─────────────────────────────

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

function redisEnabled(): boolean {
  return !!(REDIS_URL && REDIS_TOKEN);
}

function redisKey(key: string, config: RateLimitConfig): string {
  return `rl:${config.keyPrefix || "rl"}:${key}`;
}

/**
 * Atomic distributed window: INCR the key and set a TTL on first hit.
 * Upstash's pipeline returns the new count — one round trip, atomic,
 * shared across all instances.
 */
async function redisIncr(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult | null> {
  try {
    const res = await fetch(`${REDIS_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(3000),
      body: JSON.stringify([
        ["INCR", redisKey(key, config)],
        ["EXPIRE", redisKey(key, config), "NX", String(Math.ceil(config.windowMs / 1000))],
      ]),
    });
    if (!res.ok) throw new Error(`upstash ${res.status}`);
    const data = (await res.json()) as Array<{ result: string | number }>;
    const count = Number(data?.[0]?.result ?? 0);
    const resetAt = Date.now() + config.windowMs;
    return {
      allowed: count <= config.maxRequests,
      remaining: Math.max(0, config.maxRequests - count),
      resetAt,
      backend: "redis",
    };
  } catch (err) {
    console.error("[rate-limit] redis unavailable, using memory:", (err as Error).message);
    return null;
  }
}

// ── In-memory backend (fallback / no-Redis) ──────────────────

function memoryIncr(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const storeKey = `${config.keyPrefix || "rl"}:${key}`;
  const entry = memoryStore.get(storeKey);
  if (!entry || now > entry.resetAt) {
    memoryStore.set(storeKey, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs, backend: "memory" };
  }
  entry.count++;
  return {
    allowed: entry.count <= config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: entry.resetAt,
    backend: "memory",
  };
}

/**
 * Check rate limit for a given key.
 * Returns { allowed, remaining, resetAt, backend }.
 *
 * Uses the shared Redis counter when configured (atomic INCR), falling
 * back to the in-memory store when Redis is not configured or unreachable.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (redisEnabled()) {
    const redisResult = await redisIncr(key, config);
    if (redisResult) return redisResult;
  }
  return memoryIncr(key, config);
}

/**
 * Apply rate limit and return error response if exceeded.
 * Usage in API routes:
 *
 * const rateLimit = await applyRateLimit(request, RATE_LIMITS.ai);
 * if (rateLimit) return rateLimit; // Returns NextResponse with 429
 */
export async function applyRateLimit(
  request: { headers: { get: (name: string) => string | null } },
  config: RateLimitConfig
): Promise<{ status: 429; headers: Record<string, string> } | null> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed, remaining, resetAt, backend } = await checkRateLimit(ip, config);

  if (!allowed) {
    return {
      status: 429,
      headers: {
        "X-RateLimit-Limit": String(config.maxRequests),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
        "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
        "X-RateLimit-Backend": backend,
      },
    };
  }

  return null;
}
