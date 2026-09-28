/**
 * SEC SIC description → sector tag mapping (evidence-backed).
 *
 * Maps `edgar_sic_description` values to honest sector tags using the shared
 * rule file `sic-sector-map.json`. First matching rule wins; rules are
 * ordered most-specific first so "Security Brokers, Dealers & Flotation
 * Companies" maps to capital_markets before a generic "broker" rule.
 *
 * Holding shells, IP lessors and government issuers intentionally map to NO
 * tags — they are not sectors and inventing one would violate the
 * evidence-backed pipeline contract (unknown stays unknown).
 */

import mapFile from "./sic-sector-map.json";

interface SectorRule {
  patterns: string[];
  tags?: string[];
  tagsFor?: Record<string, string[]>;
}

const RULES: SectorRule[] = (mapFile as { rules: SectorRule[] }).rules;
const UNMAPPED = (mapFile as { unmapped: { patterns: string[] } }).unmapped.patterns;

/** Normalize a SIC description the way the rules expect (lowercase, single-spaced). */
export function normalizeSicDescription(description: string): string {
  return (description || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Map an SEC SIC description to sector tags. First-match-wins.
 * Returns [] when nothing matches — the caller must write nothing.
 */
export function sectorTagsForSic(description: string): string[] {
  const d = normalizeSicDescription(description);
  if (!d) return [];

  for (const p of UNMAPPED) {
    if (d.includes(p)) return [];
  }

  for (const rule of RULES) {
    for (const p of rule.patterns) {
      if (d.includes(p)) {
        if (rule.tagsFor && rule.tagsFor[d]) return rule.tagsFor[d];
        if (rule.tags) return rule.tags;
      }
    }
  }
  return [];
}

/**
 * Sector-array stamp to include in EDGAR verification writes: existing
 * AI/imported sector tags are never overwritten — SEC evidence only fills
 * empty arrays (rule 4 of the evidence-backed pipeline contract).
 */
export function sectorsStampFor(existing: string[] | null, description: string): { investment_sectors?: string[] } {
  const current = Array.isArray(existing) ? existing : [];
  if (current.length > 0) return {};
  const tags = sectorTagsForSic(description);
  return tags.length > 0 ? { investment_sectors: tags } : {};
}
