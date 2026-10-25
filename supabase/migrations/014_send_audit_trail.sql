-- Migration 014: Send audit trail + per-send credit cost (2026-10-25)
-- Completion of task 2.3: every outbound email must reference the campaign /
-- sequence that produced it (approved_draft_id is nullable until a drafts
-- table exists; drafts are currently approved through the campaign UI), and a
-- pre-send credit deduction must be visible in credit_ledger.

ALTER TABLE public.email_messages
  ADD COLUMN IF NOT EXISTS sequence_id uuid,
  ADD COLUMN IF NOT EXISTS approved_draft_id uuid;

CREATE INDEX IF NOT EXISTS idx_email_messages_sequence
  ON public.email_messages(sequence_id);

-- Per-send credit cost (plans: Free 50 / Workspace 500 / Pro 2000 credits/mo).
INSERT INTO public.credit_costs (operation, credit_cost, description)
VALUES ('email_send', 1, 'One outbound outreach email send')
ON CONFLICT (operation) DO NOTHING;
