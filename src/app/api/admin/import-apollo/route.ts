import { NextResponse } from "next/server";
import { importCsvToSupabase } from "@/lib/services/investor/csv-import";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
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
      { error: err instanceof Error ? err.message : "Apollo import failed" },
      { status: 500 }
    );
  }
}
