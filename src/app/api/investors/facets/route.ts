// =============================================
// Investors Facets API Route (Supabase)
// =============================================
// Served from the precomputed `investor_facets` rollup (migration 030) rather
// than scanning a 5,000-row sample. Two indexed reads, independent of corpus
// size, and the counts describe the whole corpus instead of a slice of it.
//
// The rollup is refreshed when it is missing or older than six hours, so the
// numbers cannot silently rot after an import. The response keeps the old
// field names (types/sectors/stages/countries/readiness/evidence) and adds the
// sparse-field availability block the UI uses for its "limited data" labels.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";
import { cache, userCacheKey, CACHE_TTL } from "@/lib/cache";

const ROLLUP_TTL_MS = 6 * 60 * 60 * 1000;

interface FacetRow {
  dimension: string;
  value: string;
  count: number;
}

interface FacetMeta {
  total: number | null;
  with_email: number | null;
  with_linkedin: number | null;
  verified: number | null;
  ready: number | null;
  needs_verification: number | null;
  with_thesis: number | null;
  with_cheque: number | null;
  with_lead_pref: number | null;
  firms_linked: number | null;
  refreshed_at: string | null;
}

const EVIDENCE_LABELS: Record<string, string> = {
  verified: "Source-verified",
  derived: "Derived",
  ai_classified: "AI-classified",
  unknown: "Unqualified",
};

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const cached = await cache.getOrSet(
      userCacheKey(user.id, "facets:v2"),
      () => computeFacets(),
      { ttlMs: CACHE_TTL.medium }
    );
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (err) {
    console.error("Facets error:", err);
    return NextResponse.json({ error: "Failed to load facets" }, { status: 500 });
  }
}

async function computeFacets() {
  const supabase = getSp();

  let meta: FacetMeta | null = null;
  {
    const { data } = await supabase
      .from("investor_facet_meta")
      .select("*")
      .maybeSingle();
    meta = (data as FacetMeta | null) ?? null;
  }

  const isStale =
    !meta?.refreshed_at ||
    Date.now() - new Date(meta.refreshed_at).getTime() > ROLLUP_TTL_MS;

  if (isStale) {
    const { error } = await supabase.rpc("refresh_investor_facets");
    if (error) {
      // A refresh failure must not blank the UI: fall through to whatever the
      // table already holds (possibly empty) and say so via _rollup.
      console.error("Facet rollup refresh failed:", error.message);
    } else {
      const { data } = await supabase
        .from("investor_facet_meta")
        .select("*")
        .maybeSingle();
      meta = (data as FacetMeta | null) ?? meta;
    }
  }

  const { data: rows, error: rowsError } = await supabase
    .from("investor_facets")
    .select("dimension, value, count");

  if (rowsError) throw new Error(rowsError.message);

  const byDimension = new Map<string, FacetRow[]>();
  for (const row of (rows ?? []) as FacetRow[]) {
    const list = byDimension.get(row.dimension) ?? [];
    list.push(row);
    byDimension.set(row.dimension, list);
  }

  const sorted = (dimension: string) =>
    (byDimension.get(dimension) ?? [])
      .slice()
      .sort((a, b) => b.count - a.count)
      .map((r) => ({ value: r.value, count: r.count }));

  const total = meta?.total ?? 0;
  const withEmail = meta?.with_email ?? 0;
  const withLinkedin = meta?.with_linkedin ?? 0;
  const verified = meta?.verified ?? 0;
  const evidenceRows = sorted("evidence");
  const evidence = evidenceRows.map((r) => ({
    value: r.value,
    label: EVIDENCE_LABELS[r.value] ?? r.value,
    count: r.count,
  }));

  return {
    total,
    types: sorted("type"),
    sectors: sorted("sector"),
    stages: sorted("stage"),
    countries: sorted("country"),
    readiness: sorted("readiness"),
    evidence,
    // Sparse dimensions. `unknown` is a real bucket, not an omission: a null
    // cheque size means "not recorded", never "invests nothing".
    cheque: sorted("cheque"),
    thesis: sorted("thesis"),
    leadPreference: sorted("lead"),
    emailStats: { with: withEmail, without: Math.max(0, total - withEmail) },
    linkedinStats: { with: withLinkedin, without: Math.max(0, total - withLinkedin) },
    verifiedStats: { yes: verified, no: Math.max(0, total - verified) },
    readyToOutreach: meta?.ready ?? 0,
    needsVerification: meta?.needs_verification ?? 0,
    // How much of the corpus actually carries each filterable field. The UI
    // renders these next to the filters so "0 results" is explainable.
    dataAvailability: {
      total,
      cheque: meta?.with_cheque ?? 0,
      thesis: meta?.with_thesis ?? 0,
      leadPreference: meta?.with_lead_pref ?? 0,
      firmsLinked: meta?.firms_linked ?? 0,
      refreshedAt: meta?.refreshed_at ?? null,
    },
    _rollup: true,
    _refreshedAt: meta?.refreshed_at ?? null,
  };
}
