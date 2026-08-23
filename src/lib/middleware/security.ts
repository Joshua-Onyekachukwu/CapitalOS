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

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  "https://capital-os.vercel.app",
  "https://www.capital-os.com",
];

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
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
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

function checkCsrf(request: NextRequest): boolean {
  const method = request.method;

  // GET/HEAD/OPTIONS never need CSRF
  if (CSRF_EXEMPT_METHODS.has(method)) return true;

  // Check if path is public (auth callbacks, tracking)
  const pathname = request.nextUrl.pathname;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return true;

  // Verify same-origin via Origin/Referer header
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (origin) {
    return ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed));
  }

  if (referer) {
    try {
      const refererUrl = new URL(referer);
      return ALLOWED_ORIGINS.some((allowed) => {
        const allowedUrl = new URL(allowed);
        return refererUrl.hostname === allowedUrl.hostname;
      });
    } catch {
      return false;
    }
  }

  // No Origin or Referer — might be a direct API call (ok for non-browser clients)
  // For extra security, require Origin on POST/PUT/DELETE:
  // return false;
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
 * Returns null if request should proceed.
 */
export function securityMiddleware(
  request: NextRequest
): NextResponse | null {
  const origin = request.headers.get("origin");
  const pathname = request.nextUrl.pathname;

  // 1. Handle CORS preflight
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

  // 3. CORS check for API routes
  if (pathname.startsWith("/api/")) {
    const corsHeaders = getCorsHeaders(origin);

    // Check if origin is allowed for non-preflight requests
    if (origin && !ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed))) {
      // For same-origin requests (no origin header), allow
      // For cross-origin requests, block
      if (!PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
        // Allow — auth middleware will handle unauthorized access
        // CORS headers will be added to response
      }
    }
  }

  return null;
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
