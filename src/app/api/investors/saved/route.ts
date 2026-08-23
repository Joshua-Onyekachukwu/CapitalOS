// =============================================
// Saved Investors API Route
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.api);
    if (rateLimitResponse) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
    }
    // Get saved investor records
    const saved = await query<any>(
      `SELECT id, investor_id, created_at
       FROM saved_investors WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user.id]
    );

    if (!saved.length) {
      return NextResponse.json({ investors: [] });
    }

    // Get investor details
    const investorIds = saved.map((s) => s.investor_id);
    const placeholders = investorIds.map((_, i) => `$${i + 1}`).join(", ");
    const investorData = await query<any>(
      `SELECT id, full_name, email, job_title, investor_type, fit_score, country, city, investment_stages
       FROM investors WHERE id IN (${placeholders})`,
      investorIds
    );

    // Merge saved data with investor data
    const merged = saved
      .map((s) => {
        const inv = investorData.find((i) => i.id === s.investor_id);
        if (!inv) return null;
        return {
          id: s.id,
          investor_id: s.investor_id,
          full_name: inv.full_name,
          email: inv.email,
          job_title: inv.job_title,
          investor_type: inv.investor_type,
          fit_score: inv.fit_score,
          country: inv.country,
          city: inv.city,
          investment_stages: inv.investment_stages,
          saved_at: s.created_at,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ investors: merged });
  } catch (err) {
    console.error("Saved investors error:", err);
    return NextResponse.json(
      { error: "Failed to load saved investors" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.api);
    if (rateLimitResponse) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
    }

    const { investorId, notes } = await request.json();

    if (!investorId) {
      return NextResponse.json({ error: "investorId required" }, { status: 400 });
    }

    await query(
      `INSERT INTO saved_investors (user_id, investor_id, notes)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, investor_id) DO NOTHING`,
      [user.id, investorId, notes || null]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Save investor error:", err);
    return NextResponse.json(
      { error: "Failed to save investor" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.api);
    if (rateLimitResponse) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
    }

    const { savedId } = await request.json();

    if (!savedId) {
      return NextResponse.json({ error: "savedId required" }, { status: 400 });
    }

    await query(
      `DELETE FROM saved_investors WHERE id = $1 AND user_id = $2`,
      [savedId, user.id]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Unsave investor error:", err);
    return NextResponse.json(
      { error: "Failed to unsave investor" },
      { status: 500 }
    );
  }
}
