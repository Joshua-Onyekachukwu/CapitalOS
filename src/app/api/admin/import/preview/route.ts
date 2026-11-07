// =============================================
// Admin CSV import — preview (dry run)
// =============================================
// Parses, normalises and dedupes against the live table, then stops. Nothing is
// written; the response carries a short-lived token the confirm route requires.

import { NextRequest, NextResponse } from "next/server";
import { importCsvToSupabase } from "@/lib/services/investor/csv-import";
import { requireAdmin } from "@/lib/middleware/api-auth";
import { signImportPreview } from "@/lib/admin/import-preview";

const MAX_BYTES = 5 * 1024 * 1024;
const TARGETS = new Set(["investors", "investors_import_staging"]);

export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  let body: { csvContent?: unknown; source?: unknown; target?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const csvContent = typeof body.csvContent === "string" ? body.csvContent : "";
  const source =
    typeof body.source === "string" && body.source.trim()
      ? body.source.trim().slice(0, 60)
      : "csv_import";

  const target = typeof body.target === "string" ? body.target : "investors";
  if (!TARGETS.has(target)) {
    return NextResponse.json({ error: "Unknown import target" }, { status: 400 });
  }

  if (!csvContent.trim()) {
    return NextResponse.json({ error: "csvContent is required" }, { status: 400 });
  }
  if (Buffer.byteLength(csvContent, "utf8") > MAX_BYTES) {
    return NextResponse.json(
      { error: "That file is larger than the 5 MB import limit." },
      { status: 413 }
    );
  }

  try {
    const preview = await importCsvToSupabase(csvContent, source, {
      dryRun: true,
      table: target === "investors" ? "investors" : "investors_import_staging",
    });
    return NextResponse.json({
      ...preview,
      mode: "preview",
      target,
      previewToken: signImportPreview(csvContent, source),
    });
  } catch (err) {
    console.error("[admin-import] preview failed:", err);
    return NextResponse.json({ error: "Could not preview that file." }, { status: 500 });
  }
}
