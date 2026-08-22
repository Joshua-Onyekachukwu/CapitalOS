import { NextRequest, NextResponse } from "next/server";
import { searchInvestors } from "@/lib/actions/search";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      query: searchParams.get("query") || undefined,
      investorType: searchParams.get("investorType") || undefined,
      stages: searchParams.get("stages")?.split(",").filter(Boolean) || undefined,
      sectors: searchParams.get("sectors")?.split(",").filter(Boolean) || undefined,
      country: searchParams.get("country") || undefined,
      minFitScore: searchParams.get("minFitScore") ? parseInt(searchParams.get("minFitScore")!) : undefined,
      maxFitScore: searchParams.get("maxFitScore") ? parseInt(searchParams.get("maxFitScore")!) : undefined,
      outreachReadiness: searchParams.get("outreachReadiness") || undefined,
      hasEmail: searchParams.get("hasEmail") === "true",
      sortBy: searchParams.get("sortBy") || "fit_score",
      sortDirection: (searchParams.get("sortDirection") as "asc" | "desc") || "desc",
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 25,
      offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0,
    };

    const result = await searchInvestors(filters);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 }
    );
  }
}
