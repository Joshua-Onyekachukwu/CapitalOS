-- ============================================================================
-- 020 — Wave 0 repairs: meetings table, document storage bucket
--
-- Closes two gaps found in the blueprint audit:
--
--   1. `meetings` was referenced by /dashboard/meetings but never existed, so
--      the page could only show whatever arbitrary investors the dashboard API
--      happened to return.
--
--   2. The `company-documents` storage bucket did not exist, so every document
--      upload failed at the storage step. `company_documents` grew orphan rows
--      with `file_url IS NULL` and no stored object.
--
-- Idempotent: safe to re-run.
-- ============================================================================


-- ============================================================================
-- 1. MEETINGS
--    Per-user record of an investor meeting. RLS owner-only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.meetings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investor_id      UUID REFERENCES public.investors(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  scheduled_at     TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  location         TEXT,
  status           TEXT NOT NULL DEFAULT 'scheduled',
  notes            TEXT,
  outcome          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Status is constrained so the UI never has to guess at an unknown value.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'meetings_status_check'
  ) THEN
    ALTER TABLE public.meetings
      ADD CONSTRAINT meetings_status_check
      CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_meetings_user_scheduled
  ON public.meetings(user_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_user_investor
  ON public.meetings(user_id, investor_id);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meetings_owner_all" ON public.meetings;
CREATE POLICY "meetings_owner_all" ON public.meetings
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Keep updated_at honest without requiring the app to set it.
CREATE OR REPLACE FUNCTION public.touch_meetings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_meetings_updated_at ON public.meetings;
CREATE TRIGGER trg_meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.touch_meetings_updated_at();


-- ============================================================================
-- 2. COMPANY DOCUMENTS BUCKET
--
--    Private, no public URLs. There are deliberately NO policies on
--    storage.objects for this bucket:
--
--      * Deny-by-default means an anon or authenticated client cannot list,
--        read or write an object directly, even with a guessed path.
--      * Uploads happen server-side (src/lib/actions/documents.ts) after a
--        verified session, and the object key is forced to the caller's own
--        `{user_id}/` prefix by the server — never by client input.
--      * Reads are 60-second signed URLs minted only after an ownership check
--        on the company_documents row, which is protected by its own RLS.
--
--    Do NOT "fix" the missing policies by adding a blanket authenticated
--    SELECT/INSERT policy: that would let any signed-in user read any other
--    founder's confidential fundraising material.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-documents',
  'company-documents',
  false,
  26214400, -- 25 MiB
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ============================================================================
-- 3. NOTE ON company_documents.file_url
--
--    For documents uploaded through src/lib/actions/documents.ts,
--    `file_url` holds the bucket object path (e.g. `<user_id>/docs/<ts>.pdf`),
--    not a URL. Storage is private, so there is no stable public URL to store.
--    Any value beginning with `http` is treated as a legacy absolute URL.
--
--    A NULL file_url means the row was created but the object never landed in
--    storage. The six rows that existed at the time of this migration are all
--    in that state. They are surfaced in the UI as "file missing, re-upload"
--    and can be deleted or replaced from /dashboard/documents.
-- ============================================================================

-- Report the orphaned rows so the cleanup is visible rather than silent.
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM public.company_documents
  WHERE file_url IS NULL;

  IF orphan_count > 0 THEN
    RAISE NOTICE
      '% company_documents row(s) have no stored file (file_url IS NULL). They were created before the company-documents bucket existed; users can re-upload or delete them from /dashboard/documents.',
      orphan_count;
  END IF;
END $$;
