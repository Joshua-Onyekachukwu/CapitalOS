-- =============================================
-- Capital-OS: Vector Search + IAPD Linking
-- Migration 009 (idempotent)
-- =============================================
-- pgvector embeddings on investor thesis/sector text, a hybrid-search
-- match function, and the columns the IAPD pipeline needs to link its
-- records to existing EDGAR-verified investors.

-- =============================================
-- 1. EXTENSIONS
-- =============================================
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================
-- 2. EMBEDDINGS
-- =============================================
-- Model: nvidia/nemotron-3-embed-1b via NVIDIA integrate API (2048 dims).
-- Stored as halfvec: vector-typed columns cannot take an HNSW index above
-- 2000 dimensions; halfvec supports 4000 at half the storage with no
-- practical recall loss for cosine ranking.
-- Embedded text: name + bio/thesis + sector/stage vocabulary — the same
-- text the Discover route embeds for queries. NULL until backfilled.
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS thesis_embedding halfvec(2048);
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS embedding_model TEXT;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

-- Cosine-distance index. Only rows with embeddings are indexed.
-- (halfvec ops classes require a halfvec column; full-precision vector
-- cosine is compact enough at this table size.) ANALYZE runs at the end.
CREATE INDEX IF NOT EXISTS idx_investors_thesis_embedding
  ON public.investors USING hnsw (thesis_embedding halfvec_cosine_ops)
  -- m=8/ef_construction=40: leaner build fits the managed-statement
  -- window on a fully-populated table; recall is fine at this corpus size.
  WITH (m = 8, ef_construction = 40)
  WHERE thesis_embedding IS NOT NULL;

-- =============================================
-- 3. IAPD LINKING COLUMNS
-- =============================================
-- The IAPD pipeline links its records to existing EDGAR-verified investors
-- when they are the same firm. After a link, iapd_row exists (no longer
-- ingested separately), the EDGAR row's evidence streams merge, and
-- iapd_firm_id (the CRD) becomes an idempotency key.
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS iapd_firm_id TEXT;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS iapd_row BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS iapd_linked_investor_id UUID
  REFERENCES public.investors(id) ON DELETE SET NULL;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS evidence_streams JSONB
  NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.investors.iapd_firm_id IS 'IAPD/CRD firm number when this row is (or is linked to) an IAPD record';
COMMENT ON COLUMN public.investors.iapd_row IS 'TRUE when the row originated from the IAPD pipeline';
COMMENT ON COLUMN public.investors.iapd_linked_investor_id IS 'For iapd rows: the EDGAR-verified investor representing the same firm';
COMMENT ON COLUMN public.investors.evidence_streams IS 'Provenance stream list, e.g. [{"provider":"edgar","cik":"..."},{"provider":"iapd","crd":"...","linked_at":"..."}]';

-- Idempotency: one IAPD row per CRD; fast lookup by CRD.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_investors_iapd_firm_id
  ON public.investors (iapd_firm_id) WHERE iapd_firm_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_investors_iapd_linked
  ON public.investors (iapd_linked_investor_id) WHERE iapd_linked_investor_id IS NOT NULL;

-- Fuzzy name matching for the linker (trigram on normalized name).
CREATE INDEX IF NOT EXISTS idx_investors_name_trgm
  ON public.investors USING GIN (name_normalized gin_trgm_ops)
  WHERE name_normalized IS NOT NULL;

-- =============================================
-- 4. HYBRID SEARCH RPC
-- =============================================
-- Combines vector cosine distance (semantic) with the full-text search
-- vector (lexical) using Reciprocal Rank Fusion.
CREATE OR REPLACE FUNCTION public.match_investors_hybrid(
  p_query_embedding halfvec(2048),
  p_query_text text,
  p_match_count integer DEFAULT 50,
  p_rrf_k integer DEFAULT 60
)
RETURNS TABLE (
  id uuid,
  semantic_score double precision,
  fts_score double precision,
  rrf_score double precision
)
LANGUAGE sql STABLE
AS $$
  WITH semantic AS (
    SELECT id, 1.0 - distance AS semantic_score
    FROM (
      SELECT id, thesis_embedding <=> (p_query_embedding::text)::halfvec(2048) AS distance
      FROM public.investors
      WHERE thesis_embedding IS NOT NULL AND is_active
      ORDER BY distance
      LIMIT LEAST(p_match_count * 4, 400)
    ) s
  ),
  lexical AS (
    SELECT id, ts_rank_cd(search_vector, websearch_to_tsquery('english', p_query_text)) AS fts_score
    FROM public.investors
    WHERE search_vector IS NOT NULL AND is_active
      AND websearch_to_tsquery('english', p_query_text) @@ search_vector
    LIMIT LEAST(p_match_count * 4, 400)
  )
  SELECT
    COALESCE(sem.id, lex.id) AS id,
    COALESCE(sem.semantic_score, 0) AS semantic_score,
    COALESCE(lex.fts_score, 0) AS fts_score,
    (COALESCE(1.0 / (p_rrf_k + sem.rank), 0) + COALESCE(1.0 / (p_rrf_k + lex.rank), 0)) AS rrf_score
  FROM (
    SELECT id, semantic_score, ROW_NUMBER() OVER (ORDER BY semantic_score DESC) AS rank
    FROM semantic
  ) sem
  FULL OUTER JOIN (
    SELECT id, fts_score, ROW_NUMBER() OVER (ORDER BY fts_score DESC) AS rank
    FROM lexical
  ) lex ON sem.id = lex.id
  WHERE COALESCE(sem.rank, 9e9) <= p_match_count * 2
     OR COALESCE(lex.rank, 9e9) <= p_match_count * 2
  ORDER BY rrf_score DESC
  LIMIT p_match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_investors_hybrid(halfvec(2048), text, integer, integer) TO service_role;

ANALYZE public.investors;
