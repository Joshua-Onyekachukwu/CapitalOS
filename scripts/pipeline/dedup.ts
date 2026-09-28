/**
 * Multi-stage deduplication.
 *
 * Stage 1 (exact, deterministic, free):
 *   normalized website domain, email, or canonical name + region collide
 *   → "exact duplicate" (same real-world entity).
 * Stage 2 (fuzzy):
 *   token-set similarity on canonical names above threshold →
 *   "probable duplicate" candidate. Geographic qualifiers (Sequoia Capital
 *   vs Sequoia Capital India) are DISTINCT entities when the extra token
 *   is a geography — different funds with different mandates.
 *
 * Nothing is ever auto-merged: verdicts are emitted for review tooling.
 * The existing merge RPC (merge_investors) remains the only merge path.
 */

import { canonicalizeName } from "./normalize";
import type { InvestorRecord } from "./types";

export type DupVerdict = "exact_duplicate" | "probable_duplicate" | "distinct" | "requires_review";

export interface DupCandidate {
  verdict: DupVerdict;
  matched_on: string;
  other_id: string;
  other_name: string;
}

const GEO_QUALIFIERS = new Set([
  "india","europe","asia","africa","china","japan","uk","us","usa","global","international",
  "southeast","north","south","east","west","london","paris","berlin","singapore","israel",
  "brazil","mexico","canada","germany","france","nigeria","kenya","australia","latam","mena",
]);

function tokens(canonical: string): string[] {
  return canonical.split(/\s+/).filter(Boolean);
}

export function tokenSetSimilarity(a: string, b: string): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * Compare a record against an existing canonical record.
 * `existing` has { id, canonical_name, website, email, region, country }.
 */
export function compareRecords(
  rec: InvestorRecord,
  existing: {
    id: string;
    canonical_name: string;
    website: string | null;
    email: string | null;
    region: string | null;
    country: string | null;
  }
): DupCandidate | null {
  // 1. website domain
  if (rec.website && existing.website && rec.website === existing.website) {
    return { verdict: "exact_duplicate", matched_on: "website", other_id: existing.id, other_name: existing.canonical_name };
  }
  // 2. email domain (institutional domains only)
  if (rec.email && existing.email) {
    const d1 = rec.email.split("@")[1];
    const d2 = existing.email.split("@")[1];
    if (d1 && d1 === d2 && !/gmail|yahoo|hotmail|outlook/.test(d1)) {
      return { verdict: "exact_duplicate", matched_on: "email_domain", other_id: existing.id, other_name: existing.canonical_name };
    }
  }
  // 3. canonical name + region
  const sim = tokenSetSimilarity(rec.canonical_name, existing.canonical_name);
  if (sim === 1) {
    const sameRegion =
      (!rec.region && !existing.region) || rec.region === existing.region;
    if (sameRegion) {
      return { verdict: "exact_duplicate", matched_on: "name+region", other_id: existing.id, other_name: existing.canonical_name };
    }
    // Same name, different region → likely distinct funds of one family
    // (Sequoia vs Sequoia India). Requires human/review decision.
    return { verdict: "requires_review", matched_on: "name-only", other_id: existing.id, other_name: existing.canonical_name };
  }
  // 4. fuzzy: high similarity but not identical
  if (sim >= 0.5) {
    const a = new Set(tokens(rec.canonical_name));
    const b = new Set(tokens(existing.canonical_name));
    const extra = [...(a.size > b.size ? a : b)].filter((t) => !(a.has(t) && b.has(t)));
    // Distinct if the difference is exactly a geographic qualifier
    // (Sequoia Capital vs Sequoia Capital India)
    if (extra.length === 1 && GEO_QUALIFIERS.has(extra[0])) {
      return { verdict: "distinct", matched_on: "geo_qualifier", other_id: existing.id, other_name: existing.canonical_name };
    }
    // Subset names ("sequoia" ⊂ "sequoia capital") are likely the same
    // entity with more detail — requires review, never auto-merged.
    if (extra.length === 0 && a.size !== b.size) {
      return { verdict: "requires_review", matched_on: `subset:${sim.toFixed(2)}`, other_id: existing.id, other_name: existing.canonical_name };
    }
    if (sim >= 0.8) {
      return { verdict: "probable_duplicate", matched_on: `fuzzy:${sim.toFixed(2)}`, other_id: existing.id, other_name: existing.canonical_name };
    }
  }
  return null;
}

/**
 * In-memory index for a batch run. At 1M+ this becomes a Postgres trigram
 * index / pg_trgm + website uniqueness — see architecture doc.
 */
export class DedupIndex {
  private byWebsite = new Map<string, { id: string; canonical_name: string; website: string | null; email: string | null; region: string | null; country: string | null }>();
  private byEmailDomain = new Map<string, string>();
  private byNameRegion = new Map<string, { id: string; canonical_name: string; website: string | null; email: string | null; region: string | null; country: string | null }>();
  private names: Array<{ id: string; canonical_name: string; website: string | null; email: string | null; region: string | null; country: string | null }> = [];

  add(rec: InvestorRecord): void {
    const entry = {
      id: rec.id,
      canonical_name: rec.canonical_name,
      website: rec.website,
      email: rec.email,
      region: rec.region,
      country: rec.country,
    };
    if (rec.website) this.byWebsite.set(rec.website, entry);
    if (rec.email) {
      const d = rec.email.split("@")[1];
      if (d && !/gmail|yahoo|hotmail|outlook/.test(d)) this.byEmailDomain.set(d, rec.id);
    }
    const key = `${rec.canonical_name}|${rec.region || ""}`;
    this.byNameRegion.set(key, entry);
    this.names.push(entry);
  }

  /** Seed from previously ingested records (id, canonical_name, website, email, region, country). */
  seed(rows: Array<{ id: string; canonical_name: string; website: string | null; email: string | null; region: string | null; country: string | null }>): void {
    for (const r of rows) {
      const entry = {
        id: r.id,
        canonical_name: canonicalizeName(r.canonical_name || ""),
        website: r.website,
        email: r.email,
        region: r.region,
        country: r.country,
      };
      if (entry.website) this.byWebsite.set(entry.website, entry);
      if (entry.email) {
        const d = entry.email.split("@")[1];
        if (d && !/gmail|yahoo|hotmail|outlook/.test(d)) this.byEmailDomain.set(d, entry.id);
      }
      this.names.push(entry);
    }
  }

  /** O(1) name+region existence probe (for pre-AI cheap dedup). */
  hasNameRegion(canonicalName: string, region: string | null): boolean {
    return this.byNameRegion.has(`${canonicalName}|${region || ""}`);
  }

  check(rec: InvestorRecord): DupCandidate | null {
    // exact checks (O(1))
    if (rec.website && this.byWebsite.has(rec.website)) {
      const e = this.byWebsite.get(rec.website)!;
      return { verdict: "exact_duplicate", matched_on: "website", other_id: e.id, other_name: e.canonical_name };
    }
    if (rec.email) {
      const d = rec.email.split("@")[1];
      if (d && this.byEmailDomain.has(d)) {
        const otherId = this.byEmailDomain.get(d)!;
        const e = this.names.find((n) => n.id === otherId);
        return { verdict: "exact_duplicate", matched_on: "email_domain", other_id: otherId, other_name: e?.canonical_name || otherId };
      }
    }
    const key = `${rec.canonical_name}|${rec.region || ""}`;
    if (this.byNameRegion.has(key)) {
      const e = this.byNameRegion.get(key)!;
      return { verdict: "exact_duplicate", matched_on: "name+region", other_id: e.id, other_name: e.canonical_name };
    }
    // fuzzy scan (O(n) within batch — fine for controlled batches; see doc for 1M plan)
    for (const e of this.names) {
      const cand = compareRecords(rec, e);
      if (cand && cand.verdict !== "exact_duplicate") return cand;
    }
    return null;
  }
}
