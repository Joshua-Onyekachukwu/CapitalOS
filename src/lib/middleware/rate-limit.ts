// =============================================
// Rate Limiting Middleware
// =============================================
// Simple in-memory rate limiter for API routes.
// For production, use Upstash Redis or similar.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
      if (now > entry.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitConfig {
  windowMs: number;     // Time window in milliseconds
  maxRequests: number;  // Max requests per window
  keyPrefix?: string;   // Optional prefix for the key
}

/**
 * Check rate limit for a given key.
 * Returns { allowed, remaining, resetAt }.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const fullKey = `${config.keyPrefix || "rl"}:${key}`;
  const entry = rateLimitStore.get(fullKey);

  if (!entry || now > entry.resetAt) {
    // New window
    rateLimitStore.set(fullKey, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Rate limit configurations for different endpoints.
 */
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

/**
 * Apply rate limit and return error response if exceeded.
 * Usage in API routes:
 *
 * const rateLimit = applyRateLimit(request, RATE_LIMITS.ai);
 * if (rateLimit) return rateLimit; // Returns NextResponse with 429
 */
export function applyRateLimit(
  request: { headers: { get: (name: string) => string | null } },
  config: RateLimitConfig
): { status: 429; headers: Record<string, string> } | null {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed, remaining, resetAt } = checkRateLimit(ip, config);

  if (!allowed) {
    return {
      status: 429,
      headers: {
        "X-RateLimit-Limit": String(config.maxRequests),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
        "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
      },
    };
  }

  return null;
}
