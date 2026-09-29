/**
 * Link IAPD pipeline records to EDGAR-verified investors when they are the
 * same firm, merging the two evidence streams.
 *
 * Matching rules (conservative, in order):
 *   1. domain     — same website host AND canonical names agree (sim >= 0.4);
 *                   platform domains shared by unrelated firms fail the name check.
 *   2. exact name — canonicalized names equal AND same country.
 *   3. fuzzy      — token similarity >= 0.85 AND same country (and not blocked
 *                   by a name+region near-collision). "XX Capital Management LP"
 *                   vs "XX Capital Management LLC" resolves here.
 *
 * Effects on the EDGAR row (the surviving canonical record):
 *   - iapd_firm_id      ← CRD (idempotency + future joins back to IAPD)
 *   - iapd_linked_investor_id on the IAPD twin → EDGAR id
 *   - iapd_row          ← TRUE on the twin, so it stops appearing as a
 *                         standalone IAPD firm in Discover
 *   - evidence_streams  ← merged [{edgar…}, {iapd…}] provenance
 *   - website/city      ← filled from IAPD when the EDGAR row is missing them
 *   - data_quality_score ← nudged up to at least 85 (dual-verified firm)
 *
 * The IAPD twin keeps its own row (auditable), pointing at the canonical.
 *
 * Usage:
 *   npx tsx scripts/pipeline/link-edgar.ts [--dry-run] [--limit 20000]
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { createClient } from "@supabase/supabase-js";
import { canonicalizeName, normalizeWebsite } from "./normalize";
import { tokenSetSimilarity } from "./dedup";

const args = process.argv.slice(2);
const flag = (name: string): boolean => args.includes(`--${name}`);
const arg = (name: string, def = ""): string => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def;
};
const DRY_RUN = flag("dry-run");
const LIMIT = parseInt(arg("limit", "20000"), 10);

interface Candidate {
  id: string;
  full_name: string;
  canonical: string;
  website: string | null;
  country: string | null;
  city: string | null;
  iapd_firm_id: string | null;
}

interface EdgarRow {
  id: string;
  full_name: string;
  canonical: string;
  website: string | null;
  country: string | null;
  city: string | null;
  evidence_streams: Array<Record<string, unknown>> | null;
}

/** Canonical-name equality is stricter than token similarity for rule 2. */
function sameName(a: string, b: string): boolean {
  return a === b;
}

function countryMatches(a: string | null, b: string | null): boolean {
  if (!a || !b) return true; // absent country is not counter-evidence
  return a.toLowerCase().trim() === b.toLowerCase().trim();
}

async function main() {
  const sp = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // ── Load IAPD twins (iapd_row with no link yet, CRD present) ──
  const cands: Candidate[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sp
      .from("investors")
      .select("id, full_name, website_url, country, city, iapd_firm_id, iapd_linked_investor_id")
      .eq("source_provider", "iapd")
      .not("iapd_firm_id", "is", null)
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error) {
      console.error("load iapd failed:", error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    for (const r of data as any[]) {
      if (r.iapd_linked_investor_id) continue; // already linked
      cands.push({
        id: r.id,
        full_name: r.full_name,
        canonical: canonicalizeName(r.full_name || ""),
        website: normalizeWebsite(r.website_url),
        country: r.country,
        city: r.city,
        iapd_firm_id: r.iapd_firm_id,
      });
    }
    from += 1000;
    if (data.length < 1000 || cands.length >= LIMIT) break;
  }

  // ── Load EDGAR-verified rows (candidates for the canonical record) ──
  // Filter server-side (verified + edgar/sec source) so pages stay small;
  // retry page loads — the pooler intermittently cancels under load.
  const edgar: EdgarRow[] = [];
  from = 0;
  for (;;) {
    let data: any[] | null = null;
    let lastErr: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: d, error } = await sp
        .from("investors")
        .select("id, full_name, website_url, country, city, evidence_streams, source_provider, verification_status")
        .eq("verification_status", "verified")
        .or("source_provider.ilike.*edgar*,source_provider.ilike.*sec*")
        .order("created_at", { ascending: true })
        .range(from, from + 999);
      if (!error) {
        data = d;
        break;
      }
      lastErr = error.message;
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
    if (!data) {
      console.error("load edgar failed after retries:", lastErr);
      process.exit(1);
    }
    if (data.length === 0) break;
    for (const r of data as any[]) {
      if (!(r.source_provider || "").toLowerCase().match(/edgar|sec/)) continue;
      edgar.push({
        id: r.id,
        full_name: r.full_name,
        canonical: canonicalizeName(r.full_name || ""),
        website: normalizeWebsite(r.website_url),
        country: r.country,
        city: r.city,
        evidence_streams: r.evidence_streams || [],
      });
    }
    from += 1000;
    if (data.length < 1000) break;
  }

  // Website index for rule 1 (EDGAR rows mostly lack websites, so the name
  // index carries most of the matching weight).
  const byWebsite = new Map<string, EdgarRow[]>();
  for (const e of edgar) {
    if (!e.website) continue;
    (byWebsite.get(e.website) || byWebsite.set(e.website, []).get(e.website)!).push(e);
  }

  let linked = 0;
  const ruleCounts: Record<string, number> = {};
  const seenEdgar = new Set<string>(); // at most one IAPD twin links to one EDGAR row
  const updates: Array<{ c: Candidate; e: EdgarRow; rule: string }> = [];

  for (const c of cands) {
    if (!c.canonical || c.canonical.length < 3) continue;

    let match: { e: EdgarRow; rule: string } | null = null;

    // Rule 1: same website domain + names agree
    if (c.website) {
      for (const e of byWebsite.get(c.website) || []) {
        if (seenEdgar.has(e.id)) continue;
        if (tokenSetSimilarity(c.canonical, e.canonical) >= 0.4 && countryMatches(c.country, e.country)) {
          match = { e, rule: "domain" };
          break;
        }
      }
    }

    // Rule 2: exact canonical name + same country
    if (!match) {
      const e = edgar.find((x) => !seenEdgar.has(x.id) && sameName(c.canonical, x.canonical) && countryMatches(c.country, x.country));
      if (e) match = { e, rule: "exact_name" };
    }

    // Rule 3: strong fuzzy name + same country
    if (!match) {
      for (const e of edgar) {
        if (seenEdgar.has(e.id)) continue;
        if (!countryMatches(c.country, e.country)) continue;
        const sim = tokenSetSimilarity(c.canonical, e.canonical);
        if (sim >= 0.85) {
          match = { e, rule: `fuzzy:${sim.toFixed(2)}` };
          break;
        }
      }
    }

    if (match) {
      seenEdgar.add(match.e.id);
      updates.push({ c, e: match.e, rule: match.rule });
      ruleCounts[match.rule.split(":")[0]] = (ruleCounts[match.rule.split(":")[0]] || 0) + 1;
    }
  }

  console.log(`candidates: ${cands.length} | edgar rows: ${edgar.length} | links: ${updates.length}${DRY_RUN ? " (DRY RUN)" : ""}`);
  for (const [k, n] of Object.entries(ruleCounts)) console.log(`  ${k}: ${n}`);

  if (DRY_RUN) {
    for (const u of updates.slice(0, 15)) {
      console.log(`  [${u.rule}] "${u.c.full_name}" (${u.c.country || "?"}) → "${u.e.full_name}" (${u.e.country || "?"})`);
    }
    return;
  }

  for (const { c, e, rule } of updates) {
    // Atomic swap via RPC: the twin releases its CRD and the EDGAR row
    // claims it inside ONE transaction (two plain updates would collide on
    // the uniq_investors_iapd_firm_id index mid-flight).
    const streams = [...(e.evidence_streams || [])];
    if (!streams.some((s) => s.provider === "iapd")) {
      streams.push({ provider: "iapd", crd: c.iapd_firm_id, linked_at: new Date().toISOString(), via: rule });
    }
    const { data: ok, error: rpcErr } = await sp.rpc("link_investor_iapd", {
      p_twin: c.id,
      p_edgar: e.id,
      p_crd: c.iapd_firm_id,
      p_streams: streams,
      p_website: e.website ? null : c.website ? `https://${c.website}` : null,
      p_city: e.city ? null : c.city,
    });
    if (rpcErr) {
      console.error(`  link failed (${c.full_name} → ${e.id}): ${rpcErr.message}`);
      continue;
    }
    if (ok === false) {
      console.error(`  twin no longer holds CRD ${c.iapd_firm_id} — skipped`);
      continue;
    }
    linked++;
  }

  console.log(`✓ linked ${linked} IAPD records to EDGAR-verified firms`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
