/**
 * Backfill investors.thesis_embedding for every row (or a subset).
 *
 * Reads the embeddable fields via supabase-js, batches them through the
 * NVIDIA embedding API (src/lib/services/investor/embeddings.ts), and
 * writes halfvec(2048) values with provenance via the
 * set_investor_embeddings RPC. Idempotent: rows that already carry the
 * current model's embedding are skipped unless --reembed. Safe to re-run
 * after interruption — it resumes at the first not-yet-embedded row.
 *
 * Usage:
 *   npx tsx scripts/backfill-embeddings.ts [--limit 5000] [--reembed] [--batch 64]
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (writes go
 * through the SECURITY DEFINER RPC), NVIDIA_API_KEY.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { createClient } from "@supabase/supabase-js";
import { embedTexts, buildEmbeddingText, EMBEDDING_MODEL } from "../src/lib/services/investor/embeddings";

const args = process.argv.slice(2);
const arg = (name: string, def = ""): string => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def;
};
const flag = (name: string): boolean => args.includes(`--${name}`);

const LIMIT = parseInt(arg("limit", "") || "0", 10); // 0 = all remaining
const BATCH = Math.max(8, Math.min(128, parseInt(arg("batch", "64"), 10)));
const REEMBED = flag("reembed");

const SELECT_FIELDS =
  "id, full_name, investor_type, bio, investment_stages, investment_sectors, investment_geographies, country, city, edgar_sic_description";

interface Row {
  id: string;
  full_name: string | null;
  investor_type: string | null;
  bio: string | null;
  investment_stages: string[] | null;
  investment_sectors: string[] | null;
  investment_geographies: string[] | null;
  country: string | null;
  city: string | null;
  edgar_sic_description: string | null;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Supabase env vars missing");
    process.exit(1);
  }
  const sp = createClient(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } });

  console.log(`backfill starting (model=${EMBEDDING_MODEL}, batch=${BATCH}${REEMBED ? ", reembed" : ""})`);

  let tokens = 0;
  let written = 0;
  let failed = 0;
  let loaded = 0;
  const t0 = Date.now();

  // Supabase caps a single request at db.max_rows (1000), so page through:
  // each pass fetches the next not-yet-embedded page (stable order by id;
  // freshly written rows drop out of the filter, so offset 0 always works).
  outer: for (;;) {
    let q = sp.from("investors").select(SELECT_FIELDS).eq("is_active", true).order("id").range(0, 999);
    if (!REEMBED) q = q.is("thesis_embedding", null);
    const { data: rows, error } = await q;
    if (error) {
      console.error("\nload failed:", error.message);
      process.exit(1);
    }
    const targets = (rows || []) as Row[];
    if (targets.length === 0) break;

    for (let i = 0; i < targets.length; i += BATCH) {
      if (LIMIT > 0 && loaded >= LIMIT) break outer;
      const chunk = targets.slice(i, i + BATCH);
      loaded += chunk.length;
      const texts = chunk.map(buildEmbeddingText);
      try {
        const { embeddings, usage } = await embedTexts(texts, { inputType: "passage" });
        tokens += usage.prompt_tokens;

        const items = embeddings.map((vec, j) => ({
          id: chunk[j].id,
          vec: `[${vec.map((x) => Number(x.toFixed(6))).join(",")}]`,
        }));
        const { data: n, error: werr } = await sp.rpc("set_investor_embeddings", { p_items: items });
        if (werr) throw new Error(werr.message);
        written += (n as number) || chunk.length;
        process.stdout.write(
          `\r  ${written} embedded (${tokens} tokens, ${((Date.now() - t0) / 1000).toFixed(0)}s)   `
        );
      } catch (err) {
        failed += chunk.length;
        console.error(`\n  batch at ${loaded} failed: ${(err as Error).message}`);
      }
      // Gentle pacing — the NVIDIA integrate endpoint throttles bursts.
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  console.log(`\ndone: ${written} written, ${failed} failed, ${tokens} prompt tokens in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  if (failed > 0 && written === 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
