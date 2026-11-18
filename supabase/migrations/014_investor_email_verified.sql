-- Evidence columns for email deliverability (SMTP RCPT evidence, ZeroBounce, etc.)
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS email_verify_source TEXT;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_investors_email_verified ON public.investors(email_verified) WHERE email_verified = true;
