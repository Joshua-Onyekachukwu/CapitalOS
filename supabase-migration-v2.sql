◇ injected env (21) from .env.local // tip: ⌘ suppress logs { quiet: true }
-- Capital OS — Add Investor Intelligence Fields
-- Generated: 2026-08-24T14:17:28.815Z
-- Adds 73 new columns across 10 sections

-- ═══ IDENTITY ═══
ALTER TABLE investors ADD COLUMN IF NOT EXISTS management_level TEXT;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS investor_subtype TEXT;

-- ═══ CONTACT ═══
ALTER TABLE investors ADD COLUMN IF NOT EXISTS company_linkedin_url TEXT;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS email_verification_status TEXT DEFAULT 'unknown';
ALTER TABLE investors ADD COLUMN IF NOT EXISTS email_verification_date TIMESTAMPTZ;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS email_source TEXT;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS secondary_email TEXT;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS contact_form_url TEXT;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS twitter_url TEXT;

-- ═══ CAPACITY ═══
ALTER TABLE investors ADD COLUMN IF NOT EXISTS typical_check_size NUMERIC;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS average_check_size NUMERIC;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS total_capital_invested NUMERIC;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS number_of_portfolio_companies INTEGER DEFAULT 0;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS available_fund_stage TEXT;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS latest_fund_size NUMERIC;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS lead_investor BOOLEAN;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS follow_on_investment BOOLEAN;

-- ═══ FOCUS ═══
ALTER TABLE investors ADD COLUMN IF NOT EXISTS primary_industry TEXT;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS secondary_industries TEXT[] DEFAULT '{}';
ALTER TABLE investors ADD COLUMN IF NOT EXISTS preferred_business_model TEXT[] DEFAULT '{}';
ALTER TABLE investors ADD COLUMN IF NOT EXISTS technology_focus TEXT;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS preferred_founder_profile TEXT;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS investment_thesis_keywords TEXT[] DEFAULT '{}';
ALTER TABLE investors ADD COLUMN IF NOT EXISTS africa_focus BOOLEAN DEFAULT false;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS nigeria_focus BOOLEAN DEFAULT false;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS international_focus BOOLEAN DEFAULT false;

-- ═══ HISTORY ═══
ALTER TABLE investors ADD COLUMN IF NOT EXISTS number_of_lead_investments INTEGER DEFAULT 0;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS portfolio_companies TEXT[] DEFAULT '{}';
ALTER TABLE investors ADD COLUMN IF NOT EXISTS recent_investments TEXT[] DEFAULT '{}';
ALTER TABLE investors ADD COLUMN IF NOT EXISTS successful_exits INTEGER DEFAULT 0;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS ipos INTEGER DEFAULT 0;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS acquisitions INTEGER DEFAULT 0;

-- ═══ ACTIVITY ═══
ALTER TABLE investors ADD COLUMN IF NOT EXISTS currently_active BOOLEAN DEFAULT true;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS investments_last_12_months INTEGER DEFAULT 0;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS investments_last_24_months INTEGER DEFAULT 0;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS recently_raised_fund BOOLEAN DEFAULT false;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS fundraising_status TEXT;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS currently_deploying_capital BOOLEAN DEFAULT true;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS investment_frequency TEXT;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS avg_investments_per_year NUMERIC;

-- ═══ BACKGROUND ═══
ALTER TABLE investors ADD COLUMN IF NOT EXISTS years_investment_experience INTEGER;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS founder_experience BOOLEAN DEFAULT false;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS previous_exits INTEGER DEFAULT 0;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS ceo_experience BOOLEAN DEFAULT false;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS board_positions INTEGER DEFAULT 0;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS advisory_positions INTEGER DEFAULT 0;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS previous_companies TEXT[] DEFAULT '{}';
ALTER TABLE investors ADD COLUMN IF NOT EXISTS investor_bio TEXT;

-- ═══ FUND ═══
ALTER TABLE investors ADD COLUMN IF NOT EXISTS firm_linkedin_url TEXT;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS founded_year INTEGER;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS headquarters TEXT;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS number_of_employees INTEGER;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS fund_type TEXT;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS current_fund TEXT;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS number_of_partners INTEGER;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS sector_focus TEXT[] DEFAULT '{}';
ALTER TABLE investors ADD COLUMN IF NOT EXISTS latest_fund_close_date DATE;

-- ═══ SCORES ═══
ALTER TABLE investors ADD COLUMN IF NOT EXISTS investor_rating TEXT;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS investment_activity_score INTEGER DEFAULT 0;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS industry_match_score INTEGER DEFAULT 0;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS stage_match_score INTEGER DEFAULT 0;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS geography_match_score INTEGER DEFAULT 0;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS funding_capacity_score INTEGER DEFAULT 0;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS contactability_score INTEGER DEFAULT 0;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS overall_lead_score INTEGER DEFAULT 0;

-- ═══ SOURCE ═══
ALTER TABLE investors ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS source_name TEXT;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS date_scraped TIMESTAMPTZ;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS date_verified TIMESTAMPTZ;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS data_verification_status TEXT DEFAULT 'unverified';
ALTER TABLE investors ADD COLUMN IF NOT EXISTS source_reliability INTEGER DEFAULT 50;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS duplicate_status TEXT DEFAULT 'unique';

-- ═══ INDEXES ═══
CREATE INDEX IF NOT EXISTS idx_investors_active ON investors(currently_active);
CREATE INDEX IF NOT EXISTS idx_investors_lead ON investors(lead_investor);
CREATE INDEX IF NOT EXISTS idx_investors_primary_industry ON investors(primary_industry);
CREATE INDEX IF NOT EXISTS idx_investors_overall_score ON investors(overall_lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_investors_activity_score ON investors(investment_activity_score DESC);
CREATE INDEX IF NOT EXISTS idx_investors_capacity_score ON investors(funding_capacity_score DESC);
CREATE INDEX IF NOT EXISTS idx_investors_contactability ON investors(contactability_score DESC);
CREATE INDEX IF NOT EXISTS idx_investors_email_verified ON investors(email_verified);
CREATE INDEX IF NOT EXISTS idx_investors_africa ON investors(africa_focus) WHERE africa_focus = true;
CREATE INDEX IF NOT EXISTS idx_investors_nigeria ON investors(nigeria_focus) WHERE nigeria_focus = true;

