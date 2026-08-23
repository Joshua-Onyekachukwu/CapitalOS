#!/usr/bin/env npx tsx
/**
 * CockroachDB Migration Runner
 *
 * Runs the Capital-OS schema migrations against the CockroachDB cluster.
 * CockroachDB-specific: no DO $$ blocks for DDL (CREATE TYPE, DROP TRIGGER).
 *
 * Usage: npx tsx scripts/setup-cockroachdb.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });
config({ path: ".env" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found. Make sure .env.local is configured.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  connectionTimeoutMillis: 15000,
});

/**
 * Execute a single SQL statement, handling errors gracefully.
 * Returns true if successful, false if skipped (already exists).
 */
async function exec(sql: string, label?: string): Promise<boolean> {
  const trimmed = sql.trim();
  if (!trimmed || trimmed.startsWith("--")) return true;

  try {
    await pool.query(trimmed);
    if (label) process.stdout.write(".");
    return true;
  } catch (err: any) {
    const msg = err.message || "";
    // Silently skip "already exists" / "duplicate" errors
    if (
      msg.includes("already exists") ||
      msg.includes("duplicate") ||
      msg.includes("duplicate_object") ||
      msg.includes("relation") && msg.includes("does not exist") && trimmed.includes("DROP")
    ) {
      if (label) process.stdout.write("s"); // skipped
      return true;
    }
    console.error(`\n  ⚠️  Failed: ${trimmed.substring(0, 100)}...`);
    console.error(`     Error: ${msg}`);
    return false;
  }
}

async function run() {
  console.log("🚀 Capital-OS CockroachDB Setup\n");

  // Test connection
  try {
    const test = await pool.query("SELECT 1 AS ok");
    if (test.rows[0].ok === 1) {
      console.log("✅ Connected to CockroachDB!\n");
    }
  } catch (err: any) {
    console.error("❌ Cannot connect:", err.message);
    process.exit(1);
  }

  // ========================================
  // PHASE 1: Enums (no DO blocks)
  // ========================================
  console.log("📦 Phase 1: Creating enums...");

  const enums = [
    `CREATE TYPE investor_type AS ENUM (
      'angel_investor','angel_syndicate','venture_capital','corporate_venture',
      'family_office','private_equity','accelerator','incubator',
      'government_fund','university_fund','venture_studio','micro_vc',
      'impact_investor','strategic_investor','debt_investor','fund_of_funds'
    )`,
    `CREATE TYPE investment_stage AS ENUM (
      'pre_seed','seed','series_a','series_b','series_c',
      'growth','late_stage','pre_ipo'
    )`,
    `CREATE TYPE firm_type AS ENUM (
      'venture_capital','corporate_venture','family_office','accelerator',
      'incubator','angel_syndicate','micro_vc','growth_equity',
      'private_equity','fund_of_funds','sovereign_wealth','other'
    )`,
    `CREATE TYPE provider_status AS ENUM ('active','inactive','error','rate_limited')`,
    `CREATE TYPE acquisition_status AS ENUM ('pending','running','completed','partially_completed','failed','cancelled')`,
    `CREATE TYPE data_quality_level AS ENUM ('unverified','low','medium','high','verified')`,
    `CREATE TYPE outreach_readiness AS ENUM ('not_ready','needs_verification','ready','contacted','do_not_contact')`,
    `CREATE TYPE source_type AS ENUM ('provider','web_research','firm_website','manual_entry','ai_inferred','public_records')`,
    `CREATE TYPE review_status AS ENUM ('pending','approved','rejected','auto_resolved')`,
    `CREATE TYPE sequence_status AS ENUM ('draft','active','paused','completed','cancelled')`,
    `CREATE TYPE sequence_step_type AS ENUM ('initial','follow_up','breakup','custom')`,
    `CREATE TYPE step_status AS ENUM ('pending','scheduled','sent','delivered','opened','replied','bounced','skipped','cancelled')`,
  ];

  let ok = 0, skip = 0;
  for (const e of enums) {
    const succeeded = await exec(e);
    if (succeeded) { ok++; } else { skip++; }
  }
  console.log(` [${ok} created, ${skip} skipped]\n`);

  // ========================================
  // PHASE 2: Tables
  // ========================================
  console.log("📦 Phase 2: Creating tables...");

  const tables = [
    // Profiles
    `CREATE TABLE IF NOT EXISTS public.profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name TEXT NOT NULL DEFAULT '',
      avatar_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Investor Firms
    `CREATE TABLE IF NOT EXISTS public.investor_firms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      domain TEXT,
      website TEXT,
      linkedin_url TEXT,
      description TEXT,
      firm_type firm_type NOT NULL DEFAULT 'venture_capital',
      headquarters TEXT,
      country TEXT,
      region TEXT,
      investment_stages investment_stage[] DEFAULT '{}',
      investment_sectors TEXT[] DEFAULT '{}',
      investment_geographies TEXT[] DEFAULT '{}',
      min_check_size NUMERIC,
      max_check_size NUMERIC,
      currency TEXT DEFAULT 'USD',
      fund_size NUMERIC,
      active_fund TEXT,
      founded_year INTEGER,
      portfolio_count INTEGER DEFAULT 0,
      team_size INTEGER,
      is_active BOOLEAN DEFAULT true,
      source TEXT,
      source_id TEXT,
      source_provider TEXT,
      data_quality_score INTEGER DEFAULT 0,
      last_enriched_at TIMESTAMPTZ,
      normalized_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Investors
    `CREATE TABLE IF NOT EXISTS public.investors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      phone TEXT,
      linkedin_url TEXT,
      twitter_url TEXT,
      job_title TEXT,
      bio TEXT,
      location TEXT,
      country TEXT,
      city TEXT,
      investor_type investor_type NOT NULL DEFAULT 'angel_investor',
      current_firm_id UUID REFERENCES public.investor_firms(id) ON DELETE SET NULL,
      investment_stages investment_stage[] DEFAULT '{}',
      investment_sectors TEXT[] DEFAULT '{}',
      investment_geographies TEXT[] DEFAULT '{}',
      min_check_size NUMERIC,
      max_check_size NUMERIC,
      currency TEXT DEFAULT 'USD',
      investment_thesis TEXT,
      portfolio_count INTEGER DEFAULT 0,
      website_url TEXT,
      avatar_url TEXT,
      is_active BOOLEAN DEFAULT true,
      is_verified BOOLEAN DEFAULT false,
      do_not_contact BOOLEAN DEFAULT false,
      outreach_readiness outreach_readiness DEFAULT 'not_ready',
      data_quality_score INTEGER DEFAULT 0,
      fit_score INTEGER DEFAULT 0,
      last_investment_date DATE,
      recent_investment_count INTEGER DEFAULT 0,
      last_enriched_at TIMESTAMPTZ,
      source TEXT,
      source_id TEXT,
      source_provider TEXT,
      merged_into_id UUID REFERENCES public.investors(id),
      merge_history JSONB DEFAULT '[]',
      search_vector tsvector,
      fit_score_breakdown JSONB DEFAULT '{}',
      qualification_notes TEXT,
      role_normalized TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Employment History
    `CREATE TABLE IF NOT EXISTS public.investor_employment_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
      firm_id UUID REFERENCES public.investor_firms(id) ON DELETE SET NULL,
      firm_name TEXT,
      title TEXT,
      start_date DATE,
      end_date DATE,
      is_current BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Data Sources
    `CREATE TABLE IF NOT EXISTS public.investor_data_sources (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
      field_name TEXT NOT NULL,
      source_type source_type NOT NULL,
      source_url TEXT,
      source_provider TEXT,
      source_value TEXT,
      confidence NUMERIC,
      collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Data Providers
    `CREATE TABLE IF NOT EXISTS public.data_providers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      provider_type TEXT NOT NULL DEFAULT 'investor_data',
      status provider_status NOT NULL DEFAULT 'inactive',
      config JSONB DEFAULT '{}',
      api_key_hint TEXT,
      last_health_check TIMESTAMPTZ,
      health_status TEXT DEFAULT 'unknown',
      total_credits INTEGER DEFAULT 0,
      credits_used INTEGER DEFAULT 0,
      monthly_limit INTEGER DEFAULT 0,
      cost_per_credit NUMERIC DEFAULT 0,
      annual_cost NUMERIC DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Data Acquisition Jobs
    `CREATE TABLE IF NOT EXISTS public.data_acquisition_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      provider_id UUID NOT NULL REFERENCES public.data_providers(id) ON DELETE CASCADE,
      job_type TEXT NOT NULL DEFAULT 'investor_search',
      filters JSONB DEFAULT '{}',
      requested_count INTEGER DEFAULT 0,
      found_count INTEGER DEFAULT 0,
      processed_count INTEGER DEFAULT 0,
      validated_count INTEGER DEFAULT 0,
      deduplicated_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      credits_used INTEGER DEFAULT 0,
      status acquisition_status NOT NULL DEFAULT 'pending',
      error_message TEXT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Investor Profiles (Enrichment)
    `CREATE TABLE IF NOT EXISTS public.investor_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
      investment_preferences JSONB DEFAULT '{}',
      partner_interests JSONB DEFAULT '{}',
      portfolio_highlights JSONB DEFAULT '{}',
      recent_activity JSONB DEFAULT '{}',
      public_statements JSONB DEFAULT '{}',
      ai_summary TEXT,
      ai_reasoning TEXT,
      recommended_angle TEXT,
      potential_objections TEXT[],
      enrichment_data JSONB DEFAULT '{}',
      last_ai_analyzed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Investor Sectors
    `CREATE TABLE IF NOT EXISTS public.investor_sectors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      parent_id UUID REFERENCES public.investor_sectors(id),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Search History
    `CREATE TABLE IF NOT EXISTS public.investor_search_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      search_query TEXT NOT NULL,
      filters JSONB DEFAULT '{}',
      results_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Audit Log
    `CREATE TABLE IF NOT EXISTS public.admin_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id UUID,
      details JSONB DEFAULT '{}',
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Raw Records
    `CREATE TABLE IF NOT EXISTS public.raw_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      import_job_id UUID REFERENCES public.data_acquisition_jobs(id) ON DELETE SET NULL,
      source_type source_type NOT NULL,
      source_provider TEXT,
      source_url TEXT,
      raw_data JSONB NOT NULL,
      parsed_data JSONB,
      normalized_data JSONB,
      status TEXT DEFAULT 'pending',
      matched_investor_id UUID REFERENCES public.investors(id) ON DELETE SET NULL,
      match_confidence NUMERIC,
      error_message TEXT,
      processed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Duplicate Candidates
    `CREATE TABLE IF NOT EXISTS public.duplicate_candidates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      investor_a_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
      investor_b_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
      confidence NUMERIC NOT NULL,
      match_signals JSONB NOT NULL DEFAULT '{}',
      status review_status NOT NULL DEFAULT 'pending',
      reviewed_by UUID,
      reviewed_at TIMESTAMPTZ,
      merge_into_id UUID REFERENCES public.investors(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(investor_a_id, investor_b_id)
    )`,

    // Data Change Log
    `CREATE TABLE IF NOT EXISTS public.data_change_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      source_type source_type,
      source_provider TEXT,
      confidence NUMERIC,
      change_type TEXT NOT NULL DEFAULT 'update',
      detected_by TEXT DEFAULT 'system',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Firm Aliases
    `CREATE TABLE IF NOT EXISTS public.firm_aliases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      firm_id UUID NOT NULL REFERENCES public.investor_firms(id) ON DELETE CASCADE,
      alias_name TEXT NOT NULL,
      normalized TEXT NOT NULL,
      source TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(firm_id, normalized)
    )`,

    // Email Accounts
    `CREATE TABLE IF NOT EXISTS public.email_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      provider TEXT NOT NULL,
      email_address TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at TIMESTAMPTZ,
      scopes TEXT[],
      is_active BOOLEAN DEFAULT true,
      last_synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Email Messages
    `CREATE TABLE IF NOT EXISTS public.email_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      investor_id UUID REFERENCES public.investors(id) ON DELETE SET NULL,
      campaign_id UUID,
      direction TEXT NOT NULL,
      thread_id TEXT,
      message_id TEXT,
      subject TEXT,
      body_html TEXT,
      body_text TEXT,
      from_address TEXT,
      to_address TEXT,
      cc_addresses TEXT[],
      attachments JSONB DEFAULT '[]',
      status TEXT DEFAULT 'draft',
      sent_at TIMESTAMPTZ,
      opened_at TIMESTAMPTZ,
      replied_at TIMESTAMPTZ,
      ai_generated BOOLEAN DEFAULT false,
      ai_prompt TEXT,
      user_notes TEXT,
      tracking_id TEXT UNIQUE,
      open_count INTEGER DEFAULT 0,
      click_count INTEGER DEFAULT 0,
      clicked_at TIMESTAMPTZ,
      first_open_ip TEXT,
      first_click_ip TEXT,
      tracking_enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Campaign Investors
    `CREATE TABLE IF NOT EXISTS public.campaign_investors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id UUID NOT NULL REFERENCES public.data_acquisition_jobs(id) ON DELETE CASCADE,
      investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
      pipeline_stage TEXT DEFAULT 'discovered',
      added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(campaign_id, investor_id)
    )`,

    // Saved Investors
    `CREATE TABLE IF NOT EXISTS public.saved_investors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, investor_id)
    )`,

    // Company Profiles
    `CREATE TABLE IF NOT EXISTS public.company_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      company_name TEXT,
      website_url TEXT,
      industry TEXT,
      location TEXT,
      company_stage TEXT,
      business_model TEXT,
      one_liner TEXT,
      description TEXT,
      differentiator TEXT,
      target_customer TEXT,
      currently_raising BOOLEAN DEFAULT false,
      funding_amount NUMERIC,
      round_type TEXT,
      target_investor_geographies TEXT[],
      has_pitch_deck BOOLEAN DEFAULT false,
      mrr NUMERIC,
      arr NUMERIC,
      customer_count INTEGER,
      growth_rate TEXT,
      milestones TEXT[],
      employee_count INTEGER,
      onboarding_completed BOOLEAN DEFAULT false,
      onboarding_step INTEGER DEFAULT 0,
      readiness_score INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id)
    )`,

    // Company Team Members
    `CREATE TABLE IF NOT EXISTS public.company_team_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      title TEXT,
      linkedin_url TEXT,
      bio TEXT,
      is_founder BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Company Documents
    `CREATE TABLE IF NOT EXISTS public.company_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
      document_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_url TEXT,
      file_size INTEGER,
      content_extracted TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Billing Plans
    `CREATE TABLE IF NOT EXISTS public.billing_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      monthly_price NUMERIC NOT NULL DEFAULT 0,
      annual_price NUMERIC,
      included_credits INTEGER NOT NULL DEFAULT 0,
      investor_db_limit INTEGER NOT NULL DEFAULT 100,
      deep_research_limit INTEGER NOT NULL DEFAULT 3,
      pitch_deck_limit INTEGER NOT NULL DEFAULT 0,
      campaign_limit INTEGER NOT NULL DEFAULT 0,
      email_accounts_limit INTEGER NOT NULL DEFAULT 0,
      team_seats INTEGER NOT NULL DEFAULT 1,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // User Subscriptions
    `CREATE TABLE IF NOT EXISTS public.user_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      plan_id UUID NOT NULL REFERENCES public.billing_plans(id),
      status TEXT NOT NULL DEFAULT 'active',
      current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
      credits_remaining INTEGER NOT NULL DEFAULT 0,
      credits_used_this_period INTEGER NOT NULL DEFAULT 0,
      previous_plan_id UUID REFERENCES public.billing_plans(id),
      plan_changed_at TIMESTAMPTZ,
      grace_period_end TIMESTAMPTZ,
      cancel_at TIMESTAMPTZ,
      trial_end TIMESTAMPTZ,
      downgrade_at TIMESTAMPTZ,
      pending_plan_id UUID REFERENCES public.billing_plans(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id)
    )`,

    // Credit Ledger
    `CREATE TABLE IF NOT EXISTS public.credit_ledger (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      operation TEXT NOT NULL,
      operation_detail JSONB DEFAULT '{}',
      model_used TEXT,
      tokens_used INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Credit Costs
    `CREATE TABLE IF NOT EXISTS public.credit_costs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      operation TEXT NOT NULL UNIQUE,
      credit_cost INTEGER NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Email Threads
    `CREATE TABLE IF NOT EXISTS public.email_threads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      investor_id UUID REFERENCES public.investors(id) ON DELETE SET NULL,
      campaign_id UUID,
      subject TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      message_count INTEGER NOT NULL DEFAULT 0,
      last_message_at TIMESTAMPTZ,
      last_message_preview TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Background Jobs
    `CREATE TABLE IF NOT EXISTS public.background_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      job_type TEXT NOT NULL DEFAULT 'unknown',
      status TEXT NOT NULL DEFAULT 'pending',
      priority INTEGER NOT NULL DEFAULT 5,
      input JSONB DEFAULT '{}',
      output JSONB DEFAULT '{}',
      error_message TEXT,
      progress INTEGER DEFAULT 0,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Billing Events
    `CREATE TABLE IF NOT EXISTS public.billing_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      event_type TEXT NOT NULL DEFAULT 'unknown',
      event_data JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Campaign Sequences
    `CREATE TABLE IF NOT EXISTS public.campaign_sequences (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      campaign_id UUID NOT NULL REFERENCES public.data_acquisition_jobs(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      status sequence_status NOT NULL DEFAULT 'draft',
      total_steps INTEGER NOT NULL DEFAULT 0,
      total_enrolled INTEGER NOT NULL DEFAULT 0,
      total_completed INTEGER NOT NULL DEFAULT 0,
      total_replies INTEGER NOT NULL DEFAULT 0,
      send_window_start TIME,
      send_window_end TIME,
      send_days INTEGER[] DEFAULT '{1,2,3,4,5}',
      stop_on_reply BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,

    // Campaign Sequence Steps
    `CREATE TABLE IF NOT EXISTS public.campaign_sequence_steps (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      sequence_id UUID NOT NULL REFERENCES public.campaign_sequences(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL,
      step_type sequence_step_type NOT NULL DEFAULT 'follow_up',
      subject_template TEXT NOT NULL,
      body_template TEXT NOT NULL,
      delay_days INTEGER NOT NULL DEFAULT 3,
      delay_hours INTEGER NOT NULL DEFAULT 0,
      tone TEXT DEFAULT 'professional',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(sequence_id, step_number)
    )`,

    // Campaign Sequence Enrollments
    `CREATE TABLE IF NOT EXISTS public.campaign_sequence_enrollments (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      sequence_id UUID NOT NULL REFERENCES public.campaign_sequences(id) ON DELETE CASCADE,
      investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
      campaign_id UUID NOT NULL REFERENCES public.data_acquisition_jobs(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      current_step INTEGER NOT NULL DEFAULT 0,
      status step_status NOT NULL DEFAULT 'pending',
      enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      next_send_at TIMESTAMPTZ,
      last_sent_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      stopped_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(sequence_id, investor_id)
    )`,

    // Campaign Sequence Emails
    `CREATE TABLE IF NOT EXISTS public.campaign_sequence_emails (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      enrollment_id UUID NOT NULL REFERENCES public.campaign_sequence_enrollments(id) ON DELETE CASCADE,
      step_id UUID NOT NULL REFERENCES public.campaign_sequence_steps(id) ON DELETE CASCADE,
      investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      body_text TEXT,
      from_address TEXT,
      to_address TEXT,
      message_id TEXT,
      status step_status NOT NULL DEFAULT 'sent',
      sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      delivered_at TIMESTAMPTZ,
      opened_at TIMESTAMPTZ,
      replied_at TIMESTAMPTZ,
      bounced_at TIMESTAMPTZ,
      error_message TEXT,
      ai_generated BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,

    // Email Tracking Events
    `CREATE TABLE IF NOT EXISTS public.email_tracking_events (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      email_id UUID NOT NULL REFERENCES public.email_messages(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      investor_id UUID REFERENCES public.investors(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      url TEXT,
      user_agent TEXT,
      ip_address TEXT,
      country TEXT,
      device_type TEXT,
      email_client TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  ];

  let tOk = 0, tFail = 0;
  for (const t of tables) {
    const succeeded = await exec(t, "table");
    if (succeeded) tOk++; else tFail++;
  }
  console.log(` [${tOk} OK, ${tFail} failed]\n`);

  // ========================================
  // PHASE 3: Indexes
  // ========================================
  console.log("📦 Phase 3: Creating indexes...");

  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_investor_firms_name ON public.investor_firms(name)`,
    `CREATE INDEX IF NOT EXISTS idx_investor_firms_domain ON public.investor_firms(domain)`,
    `CREATE INDEX IF NOT EXISTS idx_investor_firms_firm_type ON public.investor_firms(firm_type)`,
    `CREATE INDEX IF NOT EXISTS idx_investor_firms_country ON public.investor_firms(country)`,
    `CREATE INDEX IF NOT EXISTS idx_investors_email ON public.investors(email)`,
    `CREATE INDEX IF NOT EXISTS idx_investors_linkedin ON public.investors(linkedin_url)`,
    `CREATE INDEX IF NOT EXISTS idx_investors_firm ON public.investors(current_firm_id)`,
    `CREATE INDEX IF NOT EXISTS idx_investors_type ON public.investors(investor_type)`,
    `CREATE INDEX IF NOT EXISTS idx_investors_country ON public.investors(country)`,
    `CREATE INDEX IF NOT EXISTS idx_investors_source ON public.investors(source, source_id)`,
    `CREATE INDEX IF NOT EXISTS idx_employment_investor ON public.investor_employment_history(investor_id)`,
    `CREATE INDEX IF NOT EXISTS idx_data_sources_investor ON public.investor_data_sources(investor_id)`,
    `CREATE INDEX IF NOT EXISTS idx_data_sources_field ON public.investor_data_sources(field_name)`,
    `CREATE INDEX IF NOT EXISTS idx_acquisition_provider ON public.data_acquisition_jobs(provider_id)`,
    `CREATE INDEX IF NOT EXISTS idx_acquisition_status ON public.data_acquisition_jobs(status)`,
    `CREATE INDEX IF NOT EXISTS idx_acquisition_created ON public.data_acquisition_jobs(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_search_history_user ON public.investor_search_history(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.admin_audit_log(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.admin_audit_log(action)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.admin_audit_log(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_raw_records_status ON public.raw_records(status)`,
    `CREATE INDEX IF NOT EXISTS idx_raw_records_job ON public.raw_records(import_job_id)`,
    `CREATE INDEX IF NOT EXISTS idx_raw_records_matched ON public.raw_records(matched_investor_id)`,
    `CREATE INDEX IF NOT EXISTS idx_raw_records_created ON public.raw_records(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_dup_candidates_status ON public.duplicate_candidates(status)`,
    `CREATE INDEX IF NOT EXISTS idx_dup_candidates_confidence ON public.duplicate_candidates(confidence DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_change_log_investor ON public.data_change_log(investor_id)`,
    `CREATE INDEX IF NOT EXISTS idx_change_log_field ON public.data_change_log(field_name)`,
    `CREATE INDEX IF NOT EXISTS idx_change_log_created ON public.data_change_log(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_firm_aliases_normalized ON public.firm_aliases(normalized)`,
    `CREATE INDEX IF NOT EXISTS idx_email_accounts_user ON public.email_accounts(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_email_messages_investor ON public.email_messages(investor_id)`,
    `CREATE INDEX IF NOT EXISTS idx_email_messages_user ON public.email_messages(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_email_messages_thread ON public.email_messages(thread_id)`,
    `CREATE INDEX IF NOT EXISTS idx_email_messages_status ON public.email_messages(status)`,
    `CREATE INDEX IF NOT EXISTS idx_campaign_investors_campaign ON public.campaign_investors(campaign_id)`,
    `CREATE INDEX IF NOT EXISTS idx_campaign_investors_investor ON public.campaign_investors(investor_id)`,
    `CREATE INDEX IF NOT EXISTS idx_saved_investors_user ON public.saved_investors(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_company_profiles_user ON public.company_profiles(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_team_members_company ON public.company_team_members(company_id)`,
    `CREATE INDEX IF NOT EXISTS idx_company_documents_company ON public.company_documents(company_id)`,
    `CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.user_subscriptions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_credit_ledger_user ON public.credit_ledger(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_credit_ledger_created ON public.credit_ledger(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_email_threads_user ON public.email_threads(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_email_threads_investor ON public.email_threads(investor_id)`,
    `CREATE INDEX IF NOT EXISTS idx_background_jobs_user ON public.background_jobs(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON public.background_jobs(status)`,
    `CREATE INDEX IF NOT EXISTS idx_background_jobs_type ON public.background_jobs(job_type)`,
    `CREATE INDEX IF NOT EXISTS idx_background_jobs_created ON public.background_jobs(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_billing_events_user ON public.billing_events(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_campaign_sequences_campaign ON public.campaign_sequences(campaign_id)`,
    `CREATE INDEX IF NOT EXISTS idx_campaign_sequences_user ON public.campaign_sequences(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_campaign_sequences_status ON public.campaign_sequences(status)`,
    `CREATE INDEX IF NOT EXISTS idx_sequence_steps_sequence ON public.campaign_sequence_steps(sequence_id)`,
    `CREATE INDEX IF NOT EXISTS idx_enrollments_sequence ON public.campaign_sequence_enrollments(sequence_id)`,
    `CREATE INDEX IF NOT EXISTS idx_enrollments_investor ON public.campaign_sequence_enrollments(investor_id)`,
    `CREATE INDEX IF NOT EXISTS idx_enrollments_user ON public.campaign_sequence_enrollments(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_seq_emails_enrollment ON public.campaign_sequence_emails(enrollment_id)`,
    `CREATE INDEX IF NOT EXISTS idx_seq_emails_investor ON public.campaign_sequence_emails(investor_id)`,
    `CREATE INDEX IF NOT EXISTS idx_seq_emails_status ON public.campaign_sequence_emails(status)`,
    `CREATE INDEX IF NOT EXISTS idx_tracking_events_email ON public.email_tracking_events(email_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tracking_events_user ON public.email_tracking_events(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tracking_events_type ON public.email_tracking_events(event_type)`,
    `CREATE INDEX IF NOT EXISTS idx_tracking_events_created ON public.email_tracking_events(created_at)`,
  ];

  let iOk = 0, iFail = 0;
  for (const idx of indexes) {
    const succeeded = await exec(idx, "idx");
    if (succeeded) iOk++; else iFail++;
  }
  console.log(` [${iOk} OK, ${iFail} failed]\n`);

  // ========================================
  // PHASE 4: Seed Data
  // ========================================
  console.log("📦 Phase 4: Seeding data...");

  const seeds = [
    // Investor Sectors
    `INSERT INTO public.investor_sectors (name, slug) VALUES
      ('Artificial Intelligence','ai'),('AI Infrastructure','ai-infrastructure'),
      ('Machine Learning','ml'),('Developer Tools','devtools'),('FinTech','fintech'),
      ('HealthTech','healthtech'),('ClimateTech','climatetech'),('CleanTech','cleantech'),
      ('EdTech','edtech'),('Cybersecurity','cybersecurity'),('SaaS','saas'),
      ('Enterprise Software','enterprise'),('Consumer','consumer'),
      ('Marketplace','marketplace'),('DeepTech','deeptech'),('Robotics','robotics'),
      ('SpaceTech','spacetech'),('PropTech','proptech'),('AgriTech','agritech'),
      ('Logistics','logistics'),('Mobility','mobility'),('Energy','energy'),
      ('Media','media'),('Web3','web3')
    ON CONFLICT (name) DO NOTHING`,

    // Billing Plans
    `INSERT INTO public.billing_plans (name, slug, monthly_price, included_credits, investor_db_limit, deep_research_limit, pitch_deck_limit, campaign_limit, email_accounts_limit, team_seats) VALUES
      ('Free','free',0,50,100,3,1,1,0,1),
      ('Workspace','workspace',49,500,5000,30,3,5,1,1),
      ('Workspace Pro','workspace_pro',199,2000,50000,999,999,999,3,5)
    ON CONFLICT (slug) DO NOTHING`,

    // Credit Costs
    `INSERT INTO public.credit_costs (operation, credit_cost, description) VALUES
      ('investor_research',5,'AI research summary for a single investor'),
      ('email_draft',3,'Personalized email draft generation'),
      ('fit_analysis',4,'AI investor-startup fit analysis'),
      ('pitch_deck_generate',25,'Full pitch deck generation'),
      ('pitch_deck_revision',10,'Pitch deck revision'),
      ('deep_enrichment',8,'Deep investor data enrichment'),
      ('company_intelligence',6,'Company website/document intelligence extraction'),
      ('email_sequence',5,'AI email sequence generation (3-step)')
    ON CONFLICT (operation) DO NOTHING`,
  ];

  for (const s of seeds) {
    await exec(s, "seed");
  }
  console.log("\n");

  // ========================================
  // PHASE 5: Triggers (outside DO blocks — CockroachDB limitation)
  // ========================================
  console.log("📦 Phase 5: Creating trigger function and triggers...");

  // Single shared trigger function for updated_at
  await exec(`
    CREATE OR REPLACE FUNCTION public.handle_updated_at()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$`, "func");

  // Create triggers one by one (DROP TRIGGER must be outside DO blocks for CockroachDB)
  const triggerTables = [
    "investors", "investor_firms", "data_providers",
    "company_profiles", "user_subscriptions",
    "email_accounts", "email_threads", "background_jobs",
  ];

  for (const tbl of triggerTables) {
    const trigName = `on_${tbl.replace(/s$/, "")}_updated`;
    // Try drop first (may fail if doesn't exist — that's OK)
    await exec(`DROP TRIGGER IF EXISTS ${trigName} ON public.${tbl}`);
    await exec(
      `CREATE TRIGGER ${trigName}
       BEFORE UPDATE ON public.${tbl}
       FOR EACH ROW
       EXECUTE FUNCTION public.handle_updated_at()`,
      "trig"
    );
  }
  console.log("\n");

  // ========================================
  // VERIFY
  // ========================================
  console.log("🔍 Verifying schema...\n");

  const tablesResult = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);

  console.log(`📋 Tables created (${tablesResult.rows.length}):`);
  for (const row of tablesResult.rows) {
    console.log(`   ✓ ${row.table_name}`);
  }

  const indexesResult = await pool.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
    ORDER BY indexname
  `);

  console.log(`\n📑 Indexes created (${indexesResult.rows.length}):`);
  for (const row of indexesResult.rows) {
    console.log(`   ✓ ${row.indexname}`);
  }

  await pool.end();
  console.log("\n🎉 CockroachDB setup complete! All tables and indexes are ready.");
}

run().catch((err) => {
  console.error("❌ Fatal error:", err);
  pool.end();
  process.exit(1);
});
