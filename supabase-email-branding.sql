-- Add email branding settings to company_profiles
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_brand_name TEXT;
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_tagline TEXT DEFAULT 'AI-Powered Fundraising';
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_accent_color TEXT DEFAULT '#84cc16';
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_logo_url TEXT;
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_website TEXT;
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_footer_text TEXT;
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_cta_text TEXT DEFAULT 'Let''s Connect';
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_cta_url TEXT;
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_signature TEXT;

SELECT 'Email branding columns added' as result;
