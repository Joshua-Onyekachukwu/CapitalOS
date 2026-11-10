import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = new URL(request.url).searchParams.get("type") ?? "pipeline";
  if (type !== "pipeline" && type !== "outreach") {
    return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
  }

  const sp = getServiceClient();
  let csv = "";
  let filename = "report.csv";

  if (type === "pipeline") {
    const { data, error } = await sp
      .from("user_pipeline_entries")
      .select("investor_id, investor:investors(full_name), stage, expected_amount, probability, next_action_at, lost_reason, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(5000);
    if (error) {
      // The join can fail if the relation is not exposed; fall back to raw ids
      // rather than returning a 500 the founder cannot act on.
      const fallback = await sp
        .from("user_pipeline_entries")
        .select("investor_id, stage, expected_amount, probability, next_action_at, lost_reason, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(5000);
      if (fallback.error) {
        return NextResponse.json({ error: fallback.error.message }, { status: 500 });
      }
      csv = toCsv(
        ["investor_id", "stage", "expected_amount", "probability", "next_action_at", "lost_reason", "updated_at"],
        (fallback.data ?? []).map((row) => [
          row.investor_id,
          row.stage,
          row.expected_amount,
          row.probability,
          row.next_action_at,
          row.lost_reason,
          row.updated_at,
        ])
      );
    } else {
      csv = toCsv(
        ["investor", "investor_id", "stage", "expected_amount", "probability", "next_action_at", "lost_reason", "updated_at"],
        (data ?? []).map((row) => {
          const investor = row.investor as { full_name?: string } | { full_name?: string }[] | null;
          const name = Array.isArray(investor) ? investor[0]?.full_name : investor?.full_name;
          return [
            name ?? "",
            row.investor_id,
            row.stage,
            row.expected_amount,
            row.probability,
            row.next_action_at,
            row.lost_reason,
            row.updated_at,
          ];
        })
      );
    }
    filename = "pipeline.csv";
  } else {
    const { data, error } = await sp
      .from("email_messages")
      .select("to_address, subject, status, sent_at, opened_at, replied_at, bounce_type, deliverability_status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    csv = toCsv(
      ["to_address", "subject", "status", "sent_at", "opened_at", "replied_at", "bounce_type", "deliverability_status"],
      (data ?? []).map((row) => [
        row.to_address,
        row.subject,
        row.status,
        row.sent_at,
        row.opened_at,
        row.replied_at,
        row.bounce_type,
        row.deliverability_status,
      ])
    );
    filename = "outreach.csv";
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
