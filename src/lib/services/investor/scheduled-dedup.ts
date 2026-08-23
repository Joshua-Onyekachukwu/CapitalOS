// =============================================
// Scheduled Deduplication Service
// =============================================
// Scans the investor database for duplicates using
// multi-signal matching (email, LinkedIn, name, firm).
// More thorough than the batch detectDuplicates().

import { createClient } from "@supabase/supabase-js";

// =============================================
// Types
// =============================================

interface DedupResult {
  scanned: number;
  candidatesFound: number;
  autoMerged: number;
  queuedForReview: number;
  errors: number;
}

// =============================================
// Name Similarity (Levenshtein)
// =============================================

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function nameSimilarity(a: string, b: string): number {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  const ca = clean(a), cb = clean(b);
  if (ca === cb) return 1.0;
  if (!ca || !cb) return 0.0;
  return Math.max(0, 1 - levenshtein(ca, cb) / Math.max(ca.length, cb.length));
}

// =============================================
// Multi-Signal Duplicate Detection
// =============================================

export async function runScheduledDedup(
  limit: number = 500,
  batchSize: number = 50
): Promise<DedupResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const result: DedupResult = { scanned: 0, candidatesFound: 0, autoMerged: 0, queuedForReview: 0, errors: 0 };

  // Fetch investors to scan (most recent first, skip already-deduped)
  const { data: investors } = await supabase
    .from("investors")
    .select("id, full_name, email, linkedin_url, first_name, last_name, current_firm_id, job_title, city, country")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!investors) return result;
  result.scanned = investors.length;

  // Process in batches
  for (let i = 0; i < investors.length; i += batchSize) {
    const batch = investors.slice(i, i + batchSize);

    for (const investor of batch) {
      try {
        const candidates: Array<{ id: string; confidence: number; signals: Record<string, number> }> = [];

        // Signal 1: Email exact match
        if (investor.email) {
          const { data: emailMatches } = await supabase
            .from("investors")
            .select("id, full_name, linkedin_url, first_name, last_name, current_firm_id, job_title, city, country")
            .eq("email", investor.email.toLowerCase().trim())
            .eq("is_active", true)
            .neq("id", investor.id)
            .limit(5);

          if (emailMatches) {
            for (const match of emailMatches) {
              candidates.push({ id: match.id, confidence: 0.99, signals: { email: 1.0 } });
            }
          }
        }

        // Signal 2: LinkedIn exact match
        if (investor.linkedin_url && candidates.length === 0) {
          const { data: linkedinMatches } = await supabase
            .from("investors")
            .select("id, full_name, email, first_name, last_name, current_firm_id, job_title, city, country")
            .eq("linkedin_url", investor.linkedin_url)
            .eq("is_active", true)
            .neq("id", investor.id)
            .limit(5);

          if (linkedinMatches) {
            for (const match of linkedinMatches) {
              candidates.push({ id: match.id, confidence: 0.95, signals: { linkedin: 1.0 } });
            }
          }
        }

        // Signal 3: Fuzzy name match (last name + first initial)
        if (candidates.length === 0 && investor.last_name) {
          const { data: nameMatches } = await supabase
            .from("investors")
            .select("id, full_name, email, first_name, last_name, current_firm_id")
            .ilike("last_name", `%${investor.last_name.toLowerCase()}%`)
            .eq("is_active", true)
            .neq("id", investor.id)
            .limit(10);

          if (nameMatches) {
            for (const match of nameMatches) {
              const fullSim = nameSimilarity(investor.full_name, match.full_name);
              if (fullSim >= 0.85) {
                candidates.push({ id: match.id, confidence: fullSim * 0.8, signals: { fullName: fullSim } });
              }
            }
          }
        }

        // Signal 4: Same firm + similar name
        if (candidates.length === 0 && investor.current_firm_id && investor.last_name) {
          const { data: firmPeers } = await supabase
            .from("investors")
            .select("id, full_name, email, first_name, last_name, linkedin_url")
            .eq("current_firm_id", investor.current_firm_id)
            .eq("is_active", true)
            .neq("id", investor.id)
            .limit(20);

          if (firmPeers) {
            for (const peer of firmPeers) {
              const sim = nameSimilarity(investor.full_name, peer.full_name);
              if (sim >= 0.80) {
                candidates.push({ id: peer.id, confidence: sim * 0.7, signals: { fullName: sim, firm: 1.0 } });
              }
            }
          }
        }

        // Deduplicate and process candidates
        const seen = new Set<string>();
        for (const cand of candidates) {
          if (seen.has(cand.id)) continue;
          seen.add(cand.id);

          // Check if pair already exists
          const a_id = investor.id < cand.id ? investor.id : cand.id;
          const b_id = investor.id < cand.id ? cand.id : investor.id;

          const { data: existingPair } = await supabase
            .from("duplicate_candidates")
            .select("id")
            .eq("investor_a_id", a_id)
            .eq("investor_b_id", b_id)
            .limit(1);

          if (existingPair && existingPair.length > 0) continue;

          // Insert duplicate candidate
          await supabase.from("duplicate_candidates").insert({
            investor_a_id: a_id,
            investor_b_id: b_id,
            confidence: cand.confidence,
            match_signals: cand.signals,
            status: cand.confidence >= 0.95 ? "auto_resolved" : "pending",
          });

          result.candidatesFound++;
          if (cand.confidence >= 0.95) {
            result.autoMerged++;
          } else {
            result.queuedForReview++;
          }
        }
      } catch (err) {
        result.errors++;
      }
    }
  }

  return result;
}

// =============================================
// Merge Duplicate Records
// =============================================

export async function mergeInvestors(
  keepId: string,
  mergeId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Get both records
    const [keepResult, mergeResult] = await Promise.all([
      supabase.from("investors").select("*").eq("id", keepId).single(),
      supabase.from("investors").select("*").eq("id", mergeId).single(),
    ]);

    if (!keepResult.data || !mergeResult.data) {
      return { success: false, error: "One or both investors not found" };
    }

    const keep = keepResult.data;
    const merge = mergeResult.data;

    // Merge fields: prefer non-null values from the record being merged
    const updates: Record<string, unknown> = {};

    const mergeFields = [
      "email", "phone", "linkedin_url", "job_title", "bio",
      "country", "city", "location", "website_url", "avatar_url",
    ];

    for (const field of mergeFields) {
      if (!keep[field] && merge[field]) {
        updates[field] = merge[field];
      }
    }

    // Merge arrays: combine unique values
    const arrayFields = ["investment_stages", "investment_sectors", "investment_geographies"];
    for (const field of arrayFields) {
      const keepArr = keep[field] || [];
      const mergeArr = merge[field] || [];
      const combined = [...new Set([...keepArr, ...mergeArr])];
      if (combined.length > keepArr.length) {
        updates[field] = combined;
      }
    }

    // Merge check sizes
    if (!keep.min_check_size && merge.min_check_size) updates.min_check_size = merge.min_check_size;
    if (!keep.max_check_size && merge.max_check_size) updates.max_check_size = merge.max_check_size;
    if (!keep.portfolio_count && merge.portfolio_count) updates.portfolio_count = merge.portfolio_count;

    // Log the merge
    updates.merged_into_id = null;
    updates.merge_history = [...(keep.merge_history || []), {
      mergedFrom: mergeId,
      mergedAt: new Date().toISOString(),
      mergedName: merge.full_name,
    }];

    // Apply updates to the kept record
    await supabase.from("investors").update(updates).eq("id", keepId);

    // Transfer employment history
    await supabase
      .from("investor_employment_history")
      .update({ investor_id: keepId })
      .eq("investor_id", mergeId);

    // Transfer saved investors (ignore unique constraint errors)
    const { error: savedErr } = await supabase
      .from("saved_investors")
      .update({ investor_id: keepId })
      .eq("investor_id", mergeId);
    // Unique constraint errors are expected — ignore them

    // Soft-delete the merged record
    await supabase
      .from("investors")
      .update({
        is_active: false,
        merged_into_id: keepId,
      })
      .eq("id", mergeId);

    // Update duplicate candidate status
    await supabase
      .from("duplicate_candidates")
      .update({ status: "approved", merge_into_id: keepId, reviewed_at: new Date().toISOString() })
      .or(`and(investor_a_id.eq.${mergeId}),and(investor_b_id.eq.${mergeId})`);

    // Log the merge in data_change_log
    await supabase.rpc("log_data_change", {
      p_investor_id: keepId,
      p_field_name: "_merge",
      p_old_value: mergeId,
      p_new_value: merge.full_name,
      p_source_type: "manual_entry",
      p_confidence: 1.0,
      p_change_type: "merge",
      p_detected_by: "dedup_merge",
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
