// =============================================
// Email Suppression List API
// =============================================
// All operations are scoped to the authenticated user's own email_accounts.
// (Previously the handlers derived userId from "the first row in
// email_accounts" — a cross-tenant IDOR.)

import { NextRequest, NextResponse } from "next/server";
import {
  getSuppressionList,
  suppressAddress,
  unsuppressAddress,
} from "@/lib/services/email/suppression";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/middleware/api-auth";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** The caller's own account ids — the only ones they may act on. */
async function ownAccountIds(sp: any, userId: string): Promise<string[]> {
  const { data: accounts } = await sp
    .from("email_accounts")
    .select("id")
    .eq("user_id", userId);
  return (accounts || []).map((a: any) => a.id);
}

// GET — List suppressed addresses for the caller's accounts
export async function GET(request: NextRequest) {
  const authUser = await requireAuth(request);
  if (authUser instanceof NextResponse) return authUser;

  try {
    const sp = serviceClient();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "50")));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0"));
    const reason = searchParams.get("reason") || undefined;

    const ids = await ownAccountIds(sp, authUser.id);
    if (ids.length === 0) {
      return NextResponse.json({ entries: [], total: 0 });
    }

    const result = await getSuppressionList(authUser.id, { limit, offset, reason });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Suppression list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch suppression list" },
      { status: 500 }
    );
  }
}

// POST — Suppress an address (attributed to the caller, not a fetched row)
export async function POST(request: NextRequest) {
  const authUser = await requireAuth(request);
  if (authUser instanceof NextResponse) return authUser;

  try {
    const body = await request.json();
    const { emailAddress, reason, bounceType, notes } = body;

    if (!emailAddress || !reason) {
      return NextResponse.json(
        { error: "emailAddress and reason are required" },
        { status: 400 }
      );
    }

    await suppressAddress(authUser.id, emailAddress, reason, {
      bounceType,
      source: "manual",
      notes,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Suppress address error:", error);
    return NextResponse.json(
      { error: "Failed to suppress address" },
      { status: 500 }
    );
  }
}

// DELETE — Remove from the caller's suppression list
export async function DELETE(request: NextRequest) {
  const authUser = await requireAuth(request);
  if (authUser instanceof NextResponse) return authUser;

  try {
    const { searchParams } = new URL(request.url);
    const emailAddress = searchParams.get("email");

    if (!emailAddress) {
      return NextResponse.json(
        { error: "email query parameter is required" },
        { status: 400 }
      );
    }

    await unsuppressAddress(authUser.id, emailAddress);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Unsuppress address error:", error);
    return NextResponse.json(
      { error: "Failed to remove from suppression list" },
      { status: 500 }
    );
  }
}
