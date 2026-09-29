/**
 * Security Middleware Stack
 *
 * Provides defense-in-depth security for all API routes:
 *   1. CORS — Restrict cross-origin requests to same-origin only
 *   2. Security Headers — CSP, X-Frame-Options, HSTS, etc.
 *   3. CSRF Protection — Validate same-origin requests for state-changing methods
 *   4. Request Logging — Audit trail for all API access
 *
 * Usage:
 *   import { securityMiddleware } from "@/lib/middleware/security";
 *   const response = securityMiddleware(request);
 *   if (response) return response; // CORS preflight or blocked
 */

import { NextRequest, NextResponse } from "next/server";

// ── Configuration ──

// Build allowed origins from environment + known deployments
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || "3456"}`,
  // Vercel preview deployments
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  // Production domains
  "https://capital-os.vercel.app",
  "https://www.capital-os.com",
  "https://capital-os.com",
].filter(Boolean) as string[];

// In development, allow any localhost origin
const isDev = process.env.NODE_ENV !== "production";

const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization, X-CSRF-Token, X-Requested-With";
const MAX_AGE = "86400"; // 24 hours

// Paths that are intentionally public (no CSRF, no auth required)
const PUBLIC_PATHS = [
  "/api/auth/",
  "/api/track/",
  "/api/health",
];

// Paths that skip CSRF (GET requests never need CSRF)
const CSRF_EXEMPT_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// ── CORS ──

function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Max-Age": MAX_AGE,
  };

  // Check if origin is allowed
  const isOriginAllowed = origin && (
    ALLOWED_ORIGINS.includes(origin) ||
    (isDev && origin.startsWith("http://localhost"))
  );
  if (origin && isOriginAllowed) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Vary"] = "Origin";
  } else if (!origin) {
    // Same-origin requests (no Origin header) — allow
    headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGINS[0];
  }
  // If origin not in allowed list, don't set the header (browser blocks)

  return headers;
}

// ── Security Headers ──

function getSecurityHeaders(): Record<string, string> {
  return {
    // Prevent clickjacking
    "X-Frame-Options": "DENY",
    // Prevent MIME sniffing
    "X-Content-Type-Options": "nosniff",
    // XSS protection (legacy but still useful)
    "X-XSS-Protection": "1; mode=block",
    // Referrer policy
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Permissions policy (restrict browser features)
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    // HSTS (enable in production)
    "Strict-Transport-Security": process.env.NODE_ENV === "production"
      ? "max-age=31536000; includeSubDomains; preload"
      : "max-age=0",
  };
}

// ── CSRF Protection ──

/**
 * Host-aware origin validation. An origin is trusted when it is the same
 * as the host that received the request (x-forwarded-host/host) — true for
 * any deployment URL, custom domain, or preview — or when it appears in the
 * explicit allowlist. This is the correct CSRF primitive: an attacker's
 * page lives on the attacker's host, so its Origin can never match ours.
 */
export function isOriginAllowed(request: NextRequest, originStr: string | null): boolean {
  if (!originStr) return false;
  let originUrl: URL;
  try {
    originUrl = new URL(originStr);
  } catch {
    return false;
  }
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (host && originUrl.host === host.trim()) return true;
  if (ALLOWED_ORIGINS.some((allowed) => originStr.startsWith(allowed))) return true;
  if (isDev && originUrl.hostname === "localhost") return true;
  return false;
}

function checkCsrf(request: NextRequest): boolean {
  const method = request.method;

  // GET/HEAD/OPTIONS never need CSRF
  if (CSRF_EXEMPT_METHODS.has(method)) return true;

  // Check if path is public (auth callbacks, tracking)
  const pathname = request.nextUrl.pathname;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return true;

  // Verify same-origin via Origin/Referer header. Browsers attach Origin
  // to every cross-site POST, so a forged request always carries the
  // attacker's origin here and is rejected. Requests without Origin or
  // Referer are non-browser clients (server-to-server) — they hold no
  // ambient cookies to abuse, so they are allowed through.
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (origin) {
    return isOriginAllowed(request, origin);
  }

  if (referer) {
    try {
      return isOriginAllowed(request, new URL(referer).origin);
    } catch {
      return false;
    }
  }

  // No Origin or Referer — direct API call (non-browser, credential-less)
  return true;
}

// ── Request Logging ──

interface RequestLog {
  timestamp: string;
  method: string;
  pathname: string;
  origin: string | null;
  userAgent: string | null;
  ip: string | null;
  status?: number;
}

const requestLogs: RequestLog[] = [];
const MAX_LOGS = 1000;

export function logRequest(request: NextRequest, status: number): void {
  const log: RequestLog = {
    timestamp: new Date().toISOString(),
    method: request.method,
    pathname: request.nextUrl.pathname,
    origin: request.headers.get("origin"),
    userAgent: request.headers.get("user-agent")?.slice(0, 200) || null,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    status,
  };

  requestLogs.push(log);
  if (requestLogs.length > MAX_LOGS) {
    requestLogs.shift();
  }

  // Log suspicious activity
  if (status === 401 || status === 403 || status === 429) {
    console.warn(
      `[security] ${log.method} ${log.pathname} → ${status} | ` +
      `ip=${log.ip} origin=${log.origin}`
    );
  }
}

export function getRequestLogs(limit = 100): RequestLog[] {
  return requestLogs.slice(-limit);
}

// ── Main Middleware ──

/**
 * Apply security middleware to a request.
 * Returns NextResponse if request should be blocked (CORS, CSRF).
 * Returns NextResponse with CORS headers for preflight.
 * Returns null if request should proceed (CORS headers added later).
 */
export function securityMiddleware(
  request: NextRequest
): NextResponse | null {
  const origin = request.headers.get("origin");
  const pathname = request.nextUrl.pathname;

  // 1. Handle CORS preflight — return immediately with headers
  if (request.method === "OPTIONS") {
    const corsHeaders = getCorsHeaders(origin);
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  // 2. CSRF check for state-changing methods
  if (!checkCsrf(request)) {
    console.warn(
      `[security] CSRF blocked: ${request.method} ${pathname} from ${origin}`
    );
    return NextResponse.json(
      { error: "CSRF validation failed" },
      { status: 403 }
    );
  }

  // 3. Block disallowed origins on API routes
  if (pathname.startsWith("/api/") && origin) {
    const isAllowed = isOriginAllowed(request, origin);
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

    if (!isAllowed && !isPublic) {
      console.warn(
        `[security] CORS blocked: ${request.method} ${pathname} from ${origin}`
      );
      return NextResponse.json(
        { error: "Origin not allowed" },
        { status: 403 }
      );
    }
  }

  // 4. Proceed — CORS headers will be added to the response
  return null;
}

/**
 * Get CORS headers for a given origin.
 * Used to add CORS headers to the final response.
 */
export function getCorsHeadersForResponse(origin: string | null): Record<string, string> {
  return getCorsHeaders(origin);
}

/**
 * Apply security headers to a response.
 * Call this after generating the response.
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  const headers = getSecurityHeaders();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}
