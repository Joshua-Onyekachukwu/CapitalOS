// =============================================
// Settings Profile API Route
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(_request: NextRequest) {
  try {
    const user = await requireUser();

    // Get profile from CockroachDB
    const profiles = await query<any>(
      `SELECT full_name FROM profiles WHERE id = $1`,
      [user.id]
    );

    return NextResponse.json({
      full_name: profiles[0]?.full_name ?? user.user_metadata?.full_name ?? "",
      email: user.email ?? "",
    });
  } catch (err) {
    console.error("Profile load error:", err);
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser();
    const { full_name } = await request.json();

    // Upsert profile in CockroachDB
    await query(
      `INSERT INTO profiles (id, full_name, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET full_name = $2, updated_at = NOW()`,
      [user.id, full_name]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Profile update error:", err);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
