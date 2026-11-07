// =============================================
// Admin CSV import — confirm
// =============================================
// Writes only when the request carries a valid preview token for exactly this
// content. That makes "confirm before writing" a server rule rather than a UI
// convention: a direct POST without a preview is refused.

import { NextRequest, NextResponse } from "next/server";
import { importCsvToSupabase } from "@/lib/services/investor/csv-import";
import { requireAdmin } from "@/lib/middleware/api-auth";
import { verifyImportPreview } from "@/lib/admin/import-preview";
import { logAdminAction } from "@/lib/services/admin/audit";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  let body: { csvContent?: unknown; source?: unknown; previewToken?: unknown };
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

  if (!csvContent.trim()) {
    return NextResponse.json({ error: "csvContent is required" }, { status: 400 });
  }
  if (Buffer.byteLength(csvContent, "utf8") > MAX_BYTES) {
    return NextResponse.json(
      { error: "That file is larger than the 5 MB import limit." },
      { status: 413 }
    );
  }

  if (!verifyImportPreview(body.previewToken, csvContent, source)) {
    return NextResponse.json(
      {
        error:
          "Preview this file before importing it. A preview expires after 10 minutes and only covers the exact file it was run on.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await importCsvToSupabase(csvContent, source);

    logAdminAction({
      userId: user.id,
      action: "investor_csv_import",
      entityType: "investors",
      details: {
        source,
        totalRows: result.totalRows,
        inserted: result.inserted,
        duplicates: result.duplicates,
        failed: result.failed,
      },
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[admin-import] import failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
