import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

// Direct CockroachDB connection for saved_investors (PostgREST cache issue with Supabase)
function getCockroachClient() {
  return new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
  });
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET — List saved investors
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    // Query saved_investors from CockroachDB
    const cockroach = getCockroachClient();
    await cockroach.connect();

    const { rows: saved } = await cockroach.query(
      "SELECT id, investor_id, notes, created_at FROM saved_investors WHERE user_id = $1 ORDER BY created_at DESC",
      [user.id]
    );
    await cockroach.end();

    if (saved.length === 0) {
      return NextResponse.json({ investors: [] });
    }

    // Fetch investor details from Supabase
    const sp = getSupabase();
    const investorIds = saved.map((s: any) => s.investor_id);

    const { data: investors } = await sp
      .from("investors")
      .select("id, full_name, email, job_title, investor_type, fit_score, country, city, investment_stages, investment_sectors")
      .in("id", investorIds);

    // Merge saved data with investor details
    const investorMap = new Map((investors || []).map((i: any) => [i.id, i]));
    const result = saved.map((s: any) => ({
      id: s.id,
      investor_id: s.investor_id,
      notes: s.notes,
      saved_at: s.created_at,
      ...investorMap.get(s.investor_id),
    }));

    return NextResponse.json({ investors: result });
  } catch (err) {
    console.error("Saved investors GET error:", err);
    return NextResponse.json({ investors: [] });
  }
}

// POST — Save an investor
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { investorId, notes } = body;

    if (!investorId) {
      return NextResponse.json({ error: "investorId is required" }, { status: 400 });
    }

    const cockroach = getCockroachClient();
    await cockroach.connect();

    // Check if already saved
    const { rows: existing } = await cockroach.query(
      "SELECT id FROM saved_investors WHERE user_id = $1 AND investor_id = $2",
      [user.id, investorId]
    );

    if (existing.length > 0) {
      await cockroach.end();
      return NextResponse.json({ success: true, savedId: existing[0].id, alreadySaved: true });
    }

    // Insert
    const { rows } = await cockroach.query(
      "INSERT INTO saved_investors (user_id, investor_id, notes) VALUES ($1, $2, $3) RETURNING id",
      [user.id, investorId, notes || null]
    );
    await cockroach.end();

    return NextResponse.json({ success: true, savedId: rows[0].id });
  } catch (err) {
    console.error("Saved investors POST error:", err);
    return NextResponse.json({ error: "Failed to save investor" }, { status: 500 });
  }
}

// DELETE — Remove a saved investor
export async function DELETE(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { savedId, investorId } = body;

    const cockroach = getCockroachClient();
    await cockroach.connect();

    if (savedId) {
      await cockroach.query("DELETE FROM saved_investors WHERE id = $1 AND user_id = $2", [savedId, user.id]);
    } else if (investorId) {
      await cockroach.query("DELETE FROM saved_investors WHERE investor_id = $1 AND user_id = $2", [investorId, user.id]);
    } else {
      await cockroach.end();
      return NextResponse.json({ error: "savedId or investorId required" }, { status: 400 });
    }

    await cockroach.end();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Saved investors DELETE error:", err);
    return NextResponse.json({ error: "Failed to remove saved investor" }, { status: 500 });
  }
}
