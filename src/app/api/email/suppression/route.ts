// =============================================
// Email Suppression List API
// =============================================

import { NextRequest, NextResponse } from "next/server";
import {
  getSuppressionList,
  suppressAddress,
  unsuppressAddress,
  isSuppressed,
  filterSuppressed,
} from "@/lib/services/email/suppression";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/middleware/api-auth";

// GET — List suppressed addresses
export async function GET(request: NextRequest) {
  const authUser = await requireAuth(request);
  if (authUser instanceof NextResponse) return authUser;

  try {
    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const reason = searchParams.get("reason") || undefined;

    // Get user from first account
    const { data: accounts } = await sp
      .from("email_accounts")
      .select("user_id")
      .limit(1);

    if (!accounts?.length) {
      return NextResponse.json({ entries: [], total: 0 });
    }

    const userId = accounts[0].user_id;
    const result = await getSuppressionList(userId, { limit, offset, reason });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Suppression list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch suppression list" },
      { status: 500 }
    );
  }
}

// POST — Suppress an address
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

    await suppressAddress(userId, emailAddress, reason, {
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

// DELETE — Remove from suppression list
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
    await unsuppressAddress(userId, emailAddress);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Unsuppress address error:", error);
    return NextResponse.json(
      { error: "Failed to remove from suppression list" },
      { status: 500 }
    );
  }
}
