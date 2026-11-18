-- ============================================================================
-- 021 — user_pipeline_entries.owner_id should unassign, not block
--
-- 015 gave the two NOT NULL investor references ON DELETE CASCADE, which is
-- correct: an entry cannot outlive the investor it points at. It left
-- owner_id at NO ACTION, which is wrong in the opposite direction — a nullable
-- "who owns this relationship" column must never make deleting a departed
-- teammate fail.
--
-- Idempotent.
-- ============================================================================

ALTER TABLE public.user_pipeline_entries
  DROP CONSTRAINT IF EXISTS user_pipeline_entries_owner_id_fkey;

ALTER TABLE public.user_pipeline_entries
  ADD CONSTRAINT user_pipeline_entries_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
