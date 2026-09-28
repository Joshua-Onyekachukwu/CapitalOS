#!/usr/bin/env node
/**
 * SIC → sector backfill — one-shot, evidence-backed.
 *
 * Fills `investment_sectors` for active rows that have an SEC SIC
 * description but an empty sector array. Tags come exclusively from the
 * SEC-reported industry via the shared rule file
 * src/lib/services/investor/sic-sector-map.json — nothing inferred.
 *
 * Idempotent: only touches rows with empty arrays, safe to re-run.
 * Usage: node scripts/backfill-sic-sectors.cjs [--dry-run]
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const DRY_RUN = process.argv.includes("--dry-run");

function sectorTagsForSic(description) {
  const map = require("../src/lib/services/investor/sic-sector-map.json");
  const d = (description || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!d) return [];
  for (const p of map.unmapped.patterns) if (d.includes(p)) return [];
  for (const rule of map.rules) {
    for (const p of rule.patterns) {
      if (d.includes(p)) {
        if (rule.tagsFor && rule.tagsFor[d]) return rule.tagsFor[d];
        if (rule.tags) return rule.tags;
      }
    }
  }
  return [];
}

async function main() {
  const sp = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const PAGE = 1000;
  let offset = 0;
  let touched = 0;
  let skippedNoTags = 0;
  const tagCounts = {};

  for (;;) {
    const { data, error } = await sp
      .from("investors")
      .select("id, edgar_sic_description, investment_sectors")
      .eq("is_active", true)
      .not("edgar_sic_description", "is", null)
      .order("created_at")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`fetch failed at offset ${offset}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      const current = Array.isArray(row.investment_sectors) ? row.investment_sectors : [];
      if (current.length > 0) continue; // never overwrite existing tags
      const tags = sectorTagsForSic(row.edgar_sic_description);
      if (tags.length === 0) {
        skippedNoTags++;
        continue;
      }
      for (const t of tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
      touched++;
      if (!DRY_RUN) {
        const { error: upErr } = await sp
          .from("investors")
          .update({
            investment_sectors: tags,
            source_provider: "sec_edgar",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        if (upErr) throw new Error(`update failed for ${row.id}: ${upErr.message}`);
      }
    }
    offset += PAGE;
  }

  console.log(DRY_RUN ? "DRY RUN — no writes performed" : "Backfill complete");
  console.log(`Rows tagged: ${touched}`);
  console.log(`Rows left untagged (holding shells, IP lessors, governments, unknown SICs): ${skippedNoTags}`);
  console.log("Tag distribution:", JSON.stringify(tagCounts, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
