// =============================================
// Email Domain Health Check API
// =============================================
// Health is scoped to the signed-in user. Previously the route picked the
// first row in `email_accounts` — any tenant's — as the acting user, so one
// founder could read and write another founder's domain health.

import { NextRequest, NextResponse } from "next/server";
import { checkDomainHealth, getStoredDomainHealth } from "@/lib/services/email/dns-checker";
import { requireAuth } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";

/** Hostname only: labels of a-z0-9-, at least one dot, no scheme or path. */
const HOSTNAME = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

function readDomain(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const domain = value.trim().toLowerCase();
  if (domain.length > 253 || !HOSTNAME.test(domain)) return null;
  return domain;
}

export async function GET(request: NextRequest) {
  const authUser = await requireAuth(request);
  if (authUser instanceof NextResponse) return authUser;

  const limited = await applyRateLimit(request, RATE_LIMITS.api);
  if (limited) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: limited.status, headers: limited.headers }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const domain = readDomain(searchParams.get("domain"));
    const forceRefresh = searchParams.get("refresh") === "true";

    if (!domain) {
      return NextResponse.json(
        { error: "A valid domain (for example acme.com) is required" },
        { status: 400 }
      );
    }

    if (forceRefresh) {
      const health = await checkDomainHealth(authUser.id, domain);
      return NextResponse.json({ domain: health });
    }

    const stored = await getStoredDomainHealth(authUser.id, domain);
    if (stored) {
      return NextResponse.json({ domain: stored });
    }

    const health = await checkDomainHealth(authUser.id, domain);
    return NextResponse.json({ domain: health });
  } catch (error) {
    console.error("Domain check error:", error);
    return NextResponse.json({ error: "Failed to check domain health" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authUser = await requireAuth(request);
  if (authUser instanceof NextResponse) return authUser;

  const limited = await applyRateLimit(request, RATE_LIMITS.api);
  if (limited) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: limited.status, headers: limited.headers }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const domain = readDomain(body?.domain);

    if (!domain) {
      return NextResponse.json(
        { error: "A valid domain (for example acme.com) is required" },
        { status: 400 }
      );
    }

    const health = await checkDomainHealth(authUser.id, domain);
    return NextResponse.json({ domain: health });
  } catch (error) {
    console.error("Domain check POST error:", error);
    return NextResponse.json({ error: "Failed to check domain health" }, { status: 500 });
  }
}
