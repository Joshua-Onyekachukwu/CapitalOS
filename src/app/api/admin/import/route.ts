import { NextRequest, NextResponse } from "next/server";
import { importCsvToSupabase } from "@/lib/services/investor/csv-import";
import { requireAuth } from "@/lib/middleware/api-auth";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { csvContent, source } = body;

    if (!csvContent) {
      return NextResponse.json({ error: "csvContent is required" }, { status: 400 });
    }

    const result = await importCsvToSupabase(csvContent, source || "csv_import");

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    );
  }
}
