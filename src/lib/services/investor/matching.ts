// =============================================
// Entity Resolution Engine
// =============================================
// Multi-signal matching for investor deduplication.
// Uses CockroachDB for data.

import { query } from "@/lib/db";
import type { NormalizedInvestor } from "./normalization";

// =============================================
// Types
// =============================================

export interface MatchResult {
  investorId: string;
  confidence: number;
  signals: Record<string, number>;
}

interface ExistingInvestor {
  id: string;
  full_name: string;
  email: string | null;
  linkedin_url: string | null;
  first_name: string | null;
  last_name: string | null;
  current_firm_id: string | null;
  job_title: string | null;
  city: string | null;
  country: string | null;
  firm_name?: string | null;
}

// =============================================
// Similarity Functions
// =============================================

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

function nameSimilarity(a: string, b: string): number {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  const ca = clean(a);
  const cb = clean(b);

  if (ca === cb) return 1.0;
  if (!ca || !cb) return 0.0;

  const maxLen = Math.max(ca.length, cb.length);
  const dist = levenshtein(ca, cb);
  return Math.max(0, 1 - dist / maxLen);
}

function normalizeUrl(url: string | null): string {
  if (!url) return "";
  return url
    .toLowerCase()
    .replace(/\/+$/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "");
}

function normalizeEmail(email: string | null): string {
  if (!email) return "";
  return email.toLowerCase().trim();
}

function nameTokens(name: string): { first: string; last: string } {
  const parts = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/);
  return {
    first: parts[0] || "",
    last: parts[parts.length - 1] || "",
  };
}

// =============================================
// Matching Weights
// =============================================

const WEIGHTS = {
  email: 0.30,
  linkedin: 0.25,
  fullName: 0.15,
  firstLastName: 0.10,
  firm: 0.10,
  title: 0.05,
  location: 0.05,
};

// =============================================
// Single Signal Matching
// =============================================

function matchEmail(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  return normalizeEmail(a) === normalizeEmail(b) ? 1.0 : 0.0;
}

function matchLinkedIn(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  return normalizeUrl(a) === normalizeUrl(b) ? 1.0 : 0.0;
}

function matchFullName(a: string, b: string): number {
  return nameSimilarity(a, b);
}

function matchFirstLastName(
  aFirst: string | null, aLast: string | null,
  bFirst: string | null, bLast: string | null
): number {
  if (!aFirst || !aLast || !bFirst || !bLast) return 0;

  const firstMatch = nameSimilarity(aFirst, bFirst);
  const lastMatch = nameSimilarity(aLast, bLast);

  if (firstMatch < 0.5 || lastMatch < 0.5) return 0;
  return (firstMatch + lastMatch) / 2;
}

function matchTitle(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 0;
  return nameSimilarity(a, b);
}

function matchLocation(
  aCity: string | null | undefined, aCountry: string | null | undefined,
  bCity: string | null | undefined, bCountry: string | null | undefined
): number {
  const countryMatch = aCountry && bCountry ? nameSimilarity(aCountry, bCountry) : 0;
  const cityMatch = aCity && bCity ? nameSimilarity(aCity, bCity) : 0;

  if (countryMatch === 0 && cityMatch === 0) return 0;
  if (countryMatch > 0 && cityMatch > 0) return (countryMatch + cityMatch) / 2;
  return Math.max(countryMatch, cityMatch);
}

// =============================================
// Composite Score
// =============================================

function computeConfidence(
  incoming: NormalizedInvestor,
  existing: ExistingInvestor
): { confidence: number; signals: Record<string, number> } {
  const signals: Record<string, number> = {};

  signals.email = matchEmail(incoming.email ?? null, existing.email);
  signals.linkedin = matchLinkedIn(incoming.linkedinUrl ?? null, existing.linkedin_url);
  signals.fullName = matchFullName(incoming.fullName, existing.full_name);
  signals.firstLastName = matchFirstLastName(
    incoming.firstName ?? null, incoming.lastName ?? null,
    existing.first_name, existing.last_name
  );
  signals.firm = 0;
  signals.title = matchTitle(incoming.jobTitle ?? null, existing.job_title);
  signals.location = matchLocation(
    incoming.city ?? null, incoming.country ?? null,
    existing.city, existing.country
  );

  let totalWeight = 0;
  let weightedSum = 0;

  for (const [signal, weight] of Object.entries(WEIGHTS)) {
    const value = signals[signal] ?? 0;
    if (value > 0 || signal === "fullName") {
      weightedSum += value * weight;
      totalWeight += weight;
    }
  }

  const confidence = totalWeight > 0 ? weightedSum / totalWeight : 0;

  return { confidence, signals };
}

// =============================================
// Main Matching Function
// =============================================

export async function findMatchingInvestor(
  incoming: NormalizedInvestor
): Promise<MatchResult | null> {
  const candidates: ExistingInvestor[] = [];

  // Phase 1: Exact matches
  if (incoming.email) {
    const emailMatches = await query<ExistingInvestor>(
      `SELECT id, full_name, email, linkedin_url, first_name, last_name, current_firm_id, job_title, city, country
       FROM investors WHERE email = $1 AND is_active = true LIMIT 5`,
      [normalizeEmail(incoming.email)]
    );
    candidates.push(...emailMatches);
  }

  if (incoming.linkedinUrl) {
    const linkedinMatches = await query<ExistingInvestor>(
      `SELECT id, full_name, email, linkedin_url, first_name, last_name, current_firm_id, job_title, city, country
       FROM investors WHERE linkedin_url = $1 AND is_active = true LIMIT 5`,
      [incoming.linkedinUrl]
    );
    candidates.push(...linkedinMatches);
  }

  const uniqueCandidates = Array.from(
    new Map(candidates.map((c) => [c.id, c])).values()
  );

  // Phase 2: Fuzzy name match
  if (uniqueCandidates.length === 0) {
    const tokens = nameTokens(incoming.fullName);
    if (tokens.last) {
      const nameMatches = await query<ExistingInvestor>(
        `SELECT id, full_name, email, linkedin_url, first_name, last_name, current_firm_id, job_title, city, country
         FROM investors WHERE full_name ILIKE $1 AND is_active = true LIMIT 20`,
        [`%${tokens.last}%`]
      );
      uniqueCandidates.push(...nameMatches);
    }
  }

  // Phase 3: Email domain match
  if (uniqueCandidates.length === 0 && incoming.email) {
    const domain = incoming.email.split("@")[1];
    if (domain && !["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com"].includes(domain.toLowerCase())) {
      const domainMatches = await query<ExistingInvestor>(
        `SELECT id, full_name, email, linkedin_url, first_name, last_name, current_firm_id, job_title, city, country
         FROM investors WHERE email ILIKE $1 AND is_active = true LIMIT 10`,
        [`%@${domain}`]
      );
      uniqueCandidates.push(...domainMatches);
    }
  }

  // Phase 4: Firm name fuzzy match
  if (uniqueCandidates.length === 0 && incoming.currentFirmName) {
    const firmName = incoming.currentFirmName.toLowerCase().replace(/\b(ventures?|capital|fund|partners?|associates?|advisors?|llc|inc|ltd)\b/gi, "").trim();
    if (firmName.length > 2) {
      const firmMatches = await query<{ id: string }>(
        `SELECT id FROM investor_firms WHERE normalized_name ILIKE $1 LIMIT 5`,
        [`%${firmName}%`]
      );

      if (firmMatches.length > 0) {
        const firmIds = firmMatches.map((f) => f.id);
        const placeholders = firmIds.map((_, j) => `$${j + 1}`).join(", ");
        const investorsAtFirm = await query<ExistingInvestor>(
          `SELECT id, full_name, email, linkedin_url, first_name, last_name, current_firm_id, job_title, city, country
           FROM investors WHERE current_firm_id IN (${placeholders}) AND is_active = true LIMIT 20`,
          firmIds
        );
        uniqueCandidates.push(...investorsAtFirm);
      }
    }
  }

  if (uniqueCandidates.length === 0) return null;

  const finalCandidates = Array.from(
    new Map(uniqueCandidates.map((c) => [c.id, c])).values()
  );

  if (finalCandidates.length === 0) return null;

  let bestMatch: MatchResult | null = null;

  for (const candidate of finalCandidates) {
    const { confidence, signals } = computeConfidence(incoming, candidate);

    if (!bestMatch || confidence > bestMatch.confidence) {
      bestMatch = {
        investorId: candidate.id,
        confidence,
        signals,
      };
    }
  }

  if (bestMatch && bestMatch.confidence < 0.25) return null;

  return bestMatch;
}

// =============================================
// Batch Duplicate Detection
// =============================================

export async function detectDuplicates(
  limit = 100
): Promise<{ created: number }> {
  const investors = await query<any>(
    `SELECT id, full_name, email FROM investors WHERE is_active = true ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );

  let created = 0;

  for (const investor of investors) {
    if (investor.email) {
      const matches = await query<{ id: string }>(
        `SELECT id FROM investors WHERE email = $1 AND is_active = true AND id != $2 LIMIT 5`,
        [investor.email, investor.id]
      );

      for (const match of matches) {
        // Check if pair already exists
        const existing = await query<{ id: string }>(
          `SELECT id FROM duplicate_candidates
           WHERE (investor_a_id = $1 AND investor_b_id = $2)
              OR (investor_a_id = $2 AND investor_b_id = $1)
           LIMIT 1`,
          [investor.id, match.id]
        );

        if (!existing.length) {
          const a_id = investor.id < match.id ? investor.id : match.id;
          const b_id = investor.id < match.id ? match.id : investor.id;

          await query(
            `INSERT INTO duplicate_candidates (investor_a_id, investor_b_id, confidence, match_signals, status)
             VALUES ($1, $2, 0.99, $3::jsonb, 'auto_resolved')`,
            [a_id, b_id, JSON.stringify({ email: 1.0 })]
          );
          created++;
        }
      }
    }
  }

  return { created };
}
