import { NextRequest, NextResponse } from "next/server";
import { importCsvToSupabase } from "@/lib/services/investor/csv-import";
import { readFileSync } from "fs";
import { join } from "path";
import { requireAdmin } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;
  try {
    // Read the bundled Apollo CSV
    const csvPath = join(process.cwd(), "test-data", "apollo-investor-export.csv");
    let csvContent: string;

    try {
      csvContent = readFileSync(csvPath, "utf-8");
    } catch {
      return NextResponse.json(
        { error: "Apollo CSV file not found at test-data/apollo-investor-export.csv" },
        { status: 404 }
      );
    }

    const result = await importCsvToSupabase(csvContent, "apollo_import");

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
