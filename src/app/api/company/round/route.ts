// =============================================
// Company round parameters
// =============================================
// GET  /api/company/round  → the founder's current round targets
// POST /api/company/round  → set target raise, valuation, instrument, cheque range
//
// The round targets are the denominator for every pipeline percentage, so they
// are validated rather than trusted: a negative raise, a cheque range that runs
// backwards, or a non-numeric value is rejected with a reason instead of being
// coerced into the profile.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";

const FIELDS = "funding_amount, target_valuation, round_type, target_cheque_min, target_cheque_max";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type NumericInput = { ok: true; value: number | null } | { ok: false; error: string };

function parseMoney(raw: unknown, label: string): NumericInput {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { ok: false, error: `${label} must be a number` };
  if (n < 0) return { ok: false, error: `${label} cannot be negative` };
  return { ok: true, value: n };
}

function toTargets(row: Record<string, any> | null) {
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    targetAmount: num(row?.funding_amount),
    targetValuation: num(row?.target_valuation),
    instrument: (row?.round_type as string | null) ?? null,
    chequeMin: num(row?.target_cheque_min),
    chequeMax: num(row?.target_cheque_max),
  };
}

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const sp = getSp();
  const { data, error } = await sp
    .from("company_profiles")
    .select(FIELDS)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[company/round] read failed:", error);
    return NextResponse.json({ error: "Failed to load round targets" }, { status: 500 });
  }

  return NextResponse.json({ targets: toTargets(data) });
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const amount = parseMoney(body.targetAmount, "Target raise");
  if (!amount.ok) return NextResponse.json({ error: amount.error }, { status: 400 });
  const valuation = parseMoney(body.targetValuation, "Target valuation");
  if (!valuation.ok) return NextResponse.json({ error: valuation.error }, { status: 400 });
  const chequeMin = parseMoney(body.chequeMin, "Minimum cheque");
  if (!chequeMin.ok) return NextResponse.json({ error: chequeMin.error }, { status: 400 });
  const chequeMax = parseMoney(body.chequeMax, "Maximum cheque");
  if (!chequeMax.ok) return NextResponse.json({ error: chequeMax.error }, { status: 400 });

  if (
    chequeMin.value !== null &&
    chequeMax.value !== null &&
    chequeMin.value > chequeMax.value
  ) {
    return NextResponse.json(
      { error: "Minimum cheque cannot be greater than maximum cheque" },
      { status: 400 }
    );
  }

  const instrument = typeof body.instrument === "string" ? body.instrument.trim() : "";
  if (instrument.length > 60) {
    return NextResponse.json({ error: "Instrument is too long" }, { status: 400 });
  }

  const sp = getSp();
  const { data, error } = await sp
    .from("company_profiles")
    .upsert(
      {
        user_id: user.id,
        funding_amount: amount.value,
        target_valuation: valuation.value,
        round_type: instrument || null,
        target_cheque_min: chequeMin.value,
        target_cheque_max: chequeMax.value,
      },
      { onConflict: "user_id" }
    )
    .select(FIELDS)
    .single();

  if (error) {
    console.error("[company/round] write failed:", error);
    return NextResponse.json({ error: "Failed to save round targets" }, { status: 500 });
  }

  return NextResponse.json({ success: true, targets: toTargets(data) });
}
