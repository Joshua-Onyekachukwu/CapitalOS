/**
 * Investor embeddings — NVIDIA integrate API (OpenAI-compatible /embeddings).
 *
 * Model: nvidia/nemotron-3-embed-1b → 2048-dim vectors stored in
 * investors.thesis_embedding (halfvec(2048), HNSW halfvec_cosine_ops —
 * vector-typed columns cannot be HNSW-indexed above 2000 dims).
 *
 * The SAME text builder must be used for documents and queries so the two
 * vector spaces align; queries additionally pass input_type="query"
 * (passages use input_type="passage") per the retrieval-model contract.
 *
 * Env: NVIDIA_API_KEY, NVIDIA_BASE_URL (default https://integrate.api.nvidia.com/v1).
 */

export const EMBEDDING_MODEL = "nvidia/nemotron-3-embed-1b";
export const EMBEDDING_DIMS = 2048;

interface EmbedUsage {
  prompt_tokens: number;
  total_tokens: number;
}

/** Batch-embed texts. Returns one vector per input, input order preserved. */
export async function embedTexts(
  texts: string[],
  opts: { inputType?: "query" | "passage"; signal?: AbortSignal } = {}
): Promise<{ embeddings: number[][]; usage: EmbedUsage }> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY not configured");
  if (texts.length === 0) return { embeddings: [], usage: { prompt_tokens: 0, total_tokens: 0 } };

  const base = (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/$/, "");

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${base}/embeddings`, {
        method: "POST",
        signal: opts.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: texts,
          input_type: opts.inputType || "passage",
          truncate: "END",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(body.data)) {
        const detail = typeof body?.detail === "string" ? body.detail : res.statusText;
        throw new Error(`embeddings ${res.status}: ${detail}`);
      }
      const vectors = [...body.data]
        .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
        .map((d: { embedding: number[] }) => d.embedding);
      if (vectors.length !== texts.length || vectors.some((v: unknown) => !Array.isArray(v))) {
        throw new Error(`embeddings: expected ${texts.length} vectors, got ${vectors.length}`);
      }
      return {
        embeddings: vectors,
        usage: {
          prompt_tokens: body.usage?.prompt_tokens || 0,
          total_tokens: body.usage?.total_tokens || 0,
        },
      };
    } catch (err) {
      lastErr = err;
      const msg = (err as Error).message || "";
      const retriable = /timeout|fetch failed|ECONN|socket|429|5\d\d/i.test(msg) || (err as { cause?: { code?: string } })?.cause?.code;
      if (!retriable || attempt === 2) break;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export interface EmbeddableInvestor {
  full_name: string | null;
  investor_type: string | null;
  bio: string | null;
  investment_stages: string[] | null;
  investment_sectors: string[] | null;
  investment_geographies: string[] | null;
  country: string | null;
  city: string | null;
  edgar_sic_description?: string | null;
}

function humanizeToken(t: string): string {
  return String(t || "")
    .replace(/_/g, " ")
    .trim();
}

/**
 * Canonical text for one investor. Deliberately compact and de-duplicated:
 * the query side produces the same shape ("seed stage venture capital
 * robotics north america") so cosine similarity compares like with like.
 */
export function buildEmbeddingText(inv: EmbeddableInvestor): string {
  const parts: string[] = [];
  const push = (label: string | null, value: string | null | undefined, sep = ": ") => {
    const v = typeof value === "string" ? value.trim() : "";
    if (v) parts.push(label ? `${label}${sep}${v}` : v);
  };

  push(null, inv.full_name);
  push("type", humanizeToken(inv.investor_type || ""));
  if (inv.investment_stages?.length) {
    push("stages", inv.investment_stages.map(humanizeToken).filter(Boolean).join(", "));
  }
  if (inv.investment_sectors?.length) {
    push("sectors", inv.investment_sectors.map(humanizeToken).filter(Boolean).join(", "));
  }
  if (inv.investment_geographies?.length) {
    push("geographies", inv.investment_geographies.map(humanizeToken).filter(Boolean).join(", "));
  }
  push("location", [inv.city, inv.country].filter(Boolean).join(", ") || null);
  push("sic", humanizeToken(inv.edgar_sic_description || ""));
  push(null, inv.bio);

  const text = parts.join(". ").replace(/\s+/g, " ").trim();
  return text.slice(0, 6000);
}
