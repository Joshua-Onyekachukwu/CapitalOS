// =============================================
// Email Domain Health Check API
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { checkDomainHealth, getStoredDomainHealth } from "@/lib/services/email/dns-checker";
import { createClient } from "@supabase/supabase-js";

// GET — Get domain health (stored or fresh)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get("domain");
    const forceRefresh = searchParams.get("refresh") === "true";

    if (!domain) {
      return NextResponse.json(
        { error: "domain query parameter is required" },
        { status: 400 }
      );
    }

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: accounts } = await sp
      .from("email_accounts")
      .select("user_id")
      .limit(1);

    if (!accounts?.length) {
      return NextResponse.json({ error: "No user found" }, { status: 404 });
    }

    const userId = accounts[0].user_id;

    if (forceRefresh) {
      const health = await checkDomainHealth(userId, domain);
      return NextResponse.json({ domain: health });
    }

    // Try stored first
    const stored = await getStoredDomainHealth(userId, domain);
    if (stored) {
      return NextResponse.json({ domain: stored });
    }

    // Check fresh
    const health = await checkDomainHealth(userId, domain);
    return NextResponse.json({ domain: health });
  } catch (error: any) {
    console.error("Domain check error:", error);
    return NextResponse.json(
      { error: "Failed to check domain health" },
      { status: 500 }
    );
  }
}

// POST — Check domain health (fresh)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain } = body;

    if (!domain) {
      return NextResponse.json(
        { error: "domain is required" },
        { status: 400 }
      );
    }

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: accounts } = await sp
      .from("email_accounts")
      .select("user_id")
      .limit(1);

    if (!accounts?.length) {
      return NextResponse.json({ error: "No user found" }, { status: 404 });
    }

    const userId = accounts[0].user_id;
    const health = await checkDomainHealth(userId, domain);

    return NextResponse.json({ domain: health });
  } catch (error: any) {
    console.error("Domain check POST error:", error);
    return NextResponse.json(
      { error: "Failed to check domain health" },
      { status: 500 }
    );
  }
}
