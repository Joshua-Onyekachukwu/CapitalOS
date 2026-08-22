// =============================================
// Entity Resolution Engine
// =============================================
// Multi-signal matching for investor deduplication.
// Uses deterministic rules for exact matches + weighted scoring for fuzzy.

import { createClient } from "@supabase/supabase-js";
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

/** Levenshtein distance between two strings */
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

/** Normalized similarity score (0-1) based on Levenshtein */
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

/** Normalize URL for comparison */
function normalizeUrl(url: string | null): string {
  if (!url) return "";
  return url
    .toLowerCase()
    .replace(/\/+$/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "");
}

/** Normalize email for comparison */
function normalizeEmail(email: string | null): string {
  if (!email) return "";
  return email.toLowerCase().trim();
}

/** Extract first and last name tokens */
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

  // Both must match reasonably well
  if (firstMatch < 0.5 || lastMatch < 0.5) return 0;
  return (firstMatch + lastMatch) / 2;
}

function matchFirm(aFirmId: string | null | undefined, bFirmId: string | null | undefined): number {
  if (!aFirmId || !bFirmId) return 0;
  return aFirmId === bFirmId ? 1.0 : 0.0;
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
  signals.firm = 0; // Will be resolved after firm lookup in the caller
  signals.title = matchTitle(incoming.jobTitle ?? null, existing.job_title);
  signals.location = matchLocation(
    incoming.city ?? null, incoming.country ?? null,
    existing.city, existing.country
  );

  // Weighted average (only count signals where we have data)
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [signal, weight] of Object.entries(WEIGHTS)) {
    const value = signals[signal] ?? 0;
    if (value > 0 || signal === "fullName") {
      // Always count full name, only count other signals if present
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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Phase 1: Exact matches (fast, deterministic)
  const candidates: ExistingInvestor[] = [];

  // Email exact match
  if (incoming.email) {
    const { data: emailMatch } = await supabase
      .from("investors")
      .select("id, full_name, email, linkedin_url, first_name, last_name, current_firm_id, job_title, city, country")
      .eq("email", normalizeEmail(incoming.email))
      .eq("is_active", true)
      .limit(5);

    if (emailMatch) candidates.push(...emailMatch);
  }

  // LinkedIn exact match
  if (incoming.linkedinUrl) {
    const { data: linkedinMatch } = await supabase
      .from("investors")
      .select("id, full_name, email, linkedin_url, first_name, last_name, current_firm_id, job_title, city, country")
      .eq("linkedin_url", incoming.linkedinUrl)
      .eq("is_active", true)
      .limit(5);

    if (linkedinMatch) candidates.push(...linkedinMatch);
  }

  // Deduplicate candidates
  const uniqueCandidates = Array.from(
    new Map(candidates.map((c) => [c.id, c])).values()
  );

  // Phase 2: Fuzzy name match (broader search)
  if (uniqueCandidates.length === 0) {
    const name = incoming.fullName.toLowerCase();
    const tokens = nameTokens(name);

    // Last name fuzzy search
    if (tokens.last) {
      const { data: nameMatches } = await supabase
        .from("investors")
        .select("id, full_name, email, linkedin_url, first_name, last_name, current_firm_id, job_title, city, country")
        .ilike("full_name", `%${tokens.last}%`)
        .eq("is_active", true)
        .limit(20);

      if (nameMatches) uniqueCandidates.push(...nameMatches);
    }
  }

  // Phase 3: Email domain match (same domain = likely same firm)
  if (uniqueCandidates.length === 0 && incoming.email) {
    const domain = incoming.email.split("@")[1];
    if (domain && !["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com"].includes(domain.toLowerCase())) {
      const { data: domainMatches } = await supabase
        .from("investors")
        .select("id, full_name, email, linkedin_url, first_name, last_name, current_firm_id, job_title, city, country")
        .ilike("email", `%@${domain}`)
        .eq("is_active", true)
        .limit(10);

      if (domainMatches) uniqueCandidates.push(...domainMatches);
    }
  }

  // Phase 4: Firm name fuzzy match (same firm but different person names)
  if (uniqueCandidates.length === 0 && incoming.currentFirmName) {
    const firmName = incoming.currentFirmName.toLowerCase().replace(/\b(ventures?|capital|fund|partners?|associates?|advisors?|llc|inc|ltd)\b/gi, "").trim();
    if (firmName.length > 2) {
      const { data: firmMatches } = await supabase
        .from("investor_firms")
        .select("id")
        .ilike("normalized_name", `%${firmName}%`)
        .limit(5);

      if (firmMatches && firmMatches.length > 0) {
        const firmIds = firmMatches.map((f) => f.id);
        const { data: investorsAtFirm } = await supabase
          .from("investors")
          .select("id, full_name, email, linkedin_url, first_name, last_name, current_firm_id, job_title, city, country")
          .in("current_firm_id", firmIds)
          .eq("is_active", true)
          .limit(20);

        if (investorsAtFirm) uniqueCandidates.push(...investorsAtFirm);
      }
    }
  }

  if (uniqueCandidates.length === 0) return null;

  // Deduplicate candidates again after Phase 2-4
  const finalCandidates = Array.from(
    new Map(uniqueCandidates.map((c) => [c.id, c])).values()
  );

  if (finalCandidates.length === 0) return null;

  // Score each candidate
  let bestMatch: MatchResult | null = null;

  for (const candidate of finalCandidates) {
    const { confidence, signals } = computeConfidence(incoming, candidate);

    // Boost for exact email or LinkedIn match
    if (signals.email === 1.0) signals.email = 1.0;
    if (signals.linkedin === 1.0) signals.linkedin = 1.0;

    if (!bestMatch || confidence > bestMatch.confidence) {
      bestMatch = {
        investorId: candidate.id,
        confidence,
        signals,
      };
    }
  }

  // Only return if confidence is above threshold
  if (bestMatch && bestMatch.confidence < 0.25) return null;

  return bestMatch;
}

// =============================================
// Batch Duplicate Detection
// =============================================

export async function detectDuplicates(
  limit = 100
): Promise<{ created: number }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch active investors without existing duplicate candidates
  const { data: investors } = await supabase
    .from("investors")
    .select("id, full_name, email, linkedin_url, first_name, last_name, current_firm_id, job_title, city, country")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!investors) return { created: 0 };

  let created = 0;

  for (const investor of investors) {
    // Check for email match with other investors
    if (investor.email) {
      const { data: matches } = await supabase
        .from("investors")
        .select("id")
        .eq("email", investor.email)
        .eq("is_active", true)
        .neq("id", investor.id)
        .limit(5);

      if (matches) {
        for (const match of matches) {
          // Check if pair already exists
          const { data: existing } = await supabase
            .from("duplicate_candidates")
            .select("id")
            .or(
              `and(investor_a_id.eq.${investor.id},investor_b_id.eq.${match.id}),and(investor_a_id.eq.${match.id},investor_b_id.eq.${investor.id})`
            )
            .limit(1);

          if (!existing || existing.length === 0) {
            const a_id = investor.id < match.id ? investor.id : match.id;
            const b_id = investor.id < match.id ? match.id : investor.id;

            await supabase.from("duplicate_candidates").insert({
              investor_a_id: a_id,
              investor_b_id: b_id,
              confidence: 0.99,
              match_signals: { email: 1.0 },
              status: "auto_resolved",
            });
            created++;
          }
        }
      }
    }
  }

  return { created };
}
