-- The custom-SMTP path (settings UI, /api/email/smtp/save, imap-poller
-- .eq(provider,'custom_smtp')) uses 'custom_smtp' as the canonical provider
-- value, but the CHECK constraint only allowed google|microsoft|other —
-- so every custom SMTP save failed with 500 (check violation).
ALTER TABLE public.email_accounts DROP CONSTRAINT email_accounts_provider_check;

ALTER TABLE public.email_accounts ADD CONSTRAINT email_accounts_provider_check
  CHECK (provider = ANY (ARRAY['google'::text, 'microsoft'::text, 'other'::text, 'custom_smtp'::text]));
