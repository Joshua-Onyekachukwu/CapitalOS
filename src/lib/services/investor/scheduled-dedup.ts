// =============================================
// Scheduled Deduplication Service
// =============================================
// Uses CockroachDB for data.

import { query } from "@/lib/db";

interface DedupResult {
  scanned: number;
  candidatesFound: number;
  autoMerged: number;
  queuedForReview: number;
  errors: number;
}

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

export async function runScheduledDedup(limit: number = 500, batchSize: number = 50): Promise<DedupResult> {
  const result: DedupResult = { scanned: 0, candidatesFound: 0, autoMerged: 0, queuedForReview: 0, errors: 0 };

  const investors = await query<any>(
    `SELECT id, full_name, email, linkedin_url, first_name, last_name, current_firm_id, job_title, city, country
     FROM investors WHERE is_active = true ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );

  result.scanned = investors.length;

  for (let i = 0; i < investors.length; i += batchSize) {
    const batch = investors.slice(i, i + batchSize);

    for (const investor of batch) {
      try {
        const candidates: Array<{ id: string; confidence: number; signals: Record<string, number> }> = [];

        // Signal 1: Email exact match
        if (investor.email) {
          const emailMatches = await query<any>(
            `SELECT id FROM investors WHERE email = $1 AND is_active = true AND id != $2 LIMIT 5`,
            [investor.email.toLowerCase().trim(), investor.id]
          );
          for (const match of emailMatches) {
            candidates.push({ id: match.id, confidence: 0.99, signals: { email: 1.0 } });
          }
        }

        // Signal 2: LinkedIn exact match
        if (investor.linkedin_url && candidates.length === 0) {
          const linkedinMatches = await query<any>(
            `SELECT id FROM investors WHERE linkedin_url = $1 AND is_active = true AND id != $2 LIMIT 5`,
            [investor.linkedin_url, investor.id]
          );
          for (const match of linkedinMatches) {
            candidates.push({ id: match.id, confidence: 0.95, signals: { linkedin: 1.0 } });
          }
        }

        // Signal 3: Fuzzy name match
        if (candidates.length === 0 && investor.last_name) {
          const nameMatches = await query<any>(
            `SELECT id, full_name FROM investors WHERE last_name ILIKE $1 AND is_active = true AND id != $2 LIMIT 10`,
            [`%${investor.last_name.toLowerCase()}%`, investor.id]
          );
          for (const match of nameMatches) {
            const fullSim = nameSimilarity(investor.full_name, match.full_name);
            if (fullSim >= 0.85) {
              candidates.push({ id: match.id, confidence: fullSim * 0.8, signals: { fullName: fullSim } });
            }
          }
        }

        // Signal 4: Same firm + similar name
        if (candidates.length === 0 && investor.current_firm_id && investor.last_name) {
          const firmPeers = await query<any>(
            `SELECT id, full_name FROM investors WHERE current_firm_id = $1 AND is_active = true AND id != $2 LIMIT 20`,
            [investor.current_firm_id, investor.id]
          );
          for (const peer of firmPeers) {
            const sim = nameSimilarity(investor.full_name, peer.full_name);
            if (sim >= 0.80) {
              candidates.push({ id: peer.id, confidence: sim * 0.7, signals: { fullName: sim, firm: 1.0 } });
            }
          }
        }

        // Deduplicate and process candidates
        const seen = new Set<string>();
        for (const cand of candidates) {
          if (seen.has(cand.id)) continue;
          seen.add(cand.id);

          const a_id = investor.id < cand.id ? investor.id : cand.id;
          const b_id = investor.id < cand.id ? cand.id : investor.id;

          const existingPair = await query<any>(
            `SELECT id FROM duplicate_candidates WHERE investor_a_id = $1 AND investor_b_id = $2 LIMIT 1`,
            [a_id, b_id]
          );

          if (existingPair.length > 0) continue;

          await query(
            `INSERT INTO duplicate_candidates (investor_a_id, investor_b_id, confidence, match_signals, status)
             VALUES ($1, $2, $3, $4::jsonb, $5)`,
            [a_id, b_id, cand.confidence, JSON.stringify(cand.signals), cand.confidence >= 0.95 ? "auto_resolved" : "pending"]
          );

          result.candidatesFound++;
          if (cand.confidence >= 0.95) result.autoMerged++;
          else result.queuedForReview++;
        }
      } catch {
        result.errors++;
      }
    }
  }

  return result;
}

export async function mergeInvestors(keepId: string, mergeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const [keepResult, mergeResult] = await Promise.all([
      query<any>(`SELECT * FROM investors WHERE id = $1`, [keepId]),
      query<any>(`SELECT * FROM investors WHERE id = $1`, [mergeId]),
    ]);

    if (!keepResult.length || !mergeResult.length) {
      return { success: false, error: "One or both investors not found" };
    }

    const keep = keepResult[0];
    const merge = mergeResult[0];

    const updates: Record<string, unknown> = {};
    const mergeFields = ["email", "phone", "linkedin_url", "job_title", "bio", "country", "city", "location", "website_url", "avatar_url"];

    for (const field of mergeFields) {
      if (!keep[field] && merge[field]) updates[field] = merge[field];
    }

    const arrayFields = ["investment_stages", "investment_sectors", "investment_geographies"];
    for (const field of arrayFields) {
      const keepArr = keep[field] || [];
      const mergeArr = merge[field] || [];
      const combined = [...new Set([...keepArr, ...mergeArr])];
      if (combined.length > keepArr.length) updates[field] = combined;
    }

    if (!keep.min_check_size && merge.min_check_size) updates.min_check_size = merge.min_check_size;
    if (!keep.max_check_size && merge.max_check_size) updates.max_check_size = merge.max_check_size;
    if (!keep.portfolio_count && merge.portfolio_count) updates.portfolio_count = merge.portfolio_count;

    updates.merge_history = [...(keep.merge_history || []), { mergedFrom: mergeId, mergedAt: new Date().toISOString(), mergedName: merge.full_name }];

    // Apply updates
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;
    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = $${paramIdx++}`);
      params.push(value);
    }
    params.push(keepId);
    await query(`UPDATE investors SET ${setClauses.join(", ")} WHERE id = $${paramIdx}`, params);

    // Transfer related data
    await query(`UPDATE investor_employment_history SET investor_id = $1 WHERE investor_id = $2`, [keepId, mergeId]);
    await query(`UPDATE saved_investors SET investor_id = $1 WHERE investor_id = $2`, [keepId, mergeId]);

    // Soft-delete
    await query(`UPDATE investors SET is_active = false, merged_into_id = $1 WHERE id = $2`, [keepId, mergeId]);

    // Update duplicate candidates
    await query(
      `UPDATE duplicate_candidates SET status = 'approved', merge_into_id = $1, reviewed_at = NOW()
       WHERE investor_a_id = $2 OR investor_b_id = $2`,
      [keepId, mergeId]
    );

    // Log merge
    await query(
      `INSERT INTO data_change_log (investor_id, field_name, old_value, new_value, source_type, confidence, change_type, detected_by)
       VALUES ($1, '_merge', $2, $3, 'manual_entry', 1.0, 'merge', 'dedup_merge')`,
      [keepId, mergeId, merge.full_name]
    );

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
