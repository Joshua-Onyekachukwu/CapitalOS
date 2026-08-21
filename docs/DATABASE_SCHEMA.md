# Database Schema — Capital-OS

## Overview

Capital-OS uses Supabase (PostgreSQL) as the system of record. All AI-generated data is stored here. pgvector enables semantic search via vector embeddings.

**Migration Tool:** Supabase CLI
**Migration Location:** `supabase/migrations/`
**RLS:** Enabled on all tables

---

## Entity Relationship

```
profiles
  └── startups
        ├── startup_documents
        │     └── startup_document_chunks (pgvector)
        ├── startup_preferences
        ├── campaigns
        │     ├── campaign_investors
        │     │     └── emails
        │     │           └── email_events
        │     └── pipeline_stages
        ├── interactions
        ├── meetings
        │     └── meeting_notes
        ├── agent_tasks
        ├── feedback_logs
        ├── notifications
        └── audit_logs

investor_firms
  └── investors
        ├── investor_sources
        ├── investor_portfolios
        ├── investor_activity
        ├── investor_embeddings (pgvector)
        └── investor_research

ai_model_config
ai_usage

suppression_list
rate_limits
processed_events
```

---

## Tables

### profiles

Extends Supabase `auth.users` with application-specific data.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

### startups

Core entity representing a founder's startup.

```sql
CREATE TABLE startups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  website TEXT,
  logo_url TEXT,

  -- Investment Profile
  problem TEXT,
  solution TEXT,
  product TEXT,
  category TEXT,
  industry TEXT,
  sub_industry TEXT,
  target_market TEXT,
  geography TEXT,
  business_model TEXT,
  revenue_model TEXT,
  traction TEXT,
  revenue TEXT,
  growth TEXT,
  users_count TEXT,
  customers TEXT,
  team_size INTEGER,
  founders JSONB DEFAULT '[]',
  competitive_landscape TEXT,
  competitive_advantage TEXT,
  moat TEXT,
  technology TEXT,
  market_size TEXT,
  tam TEXT,
  sam TEXT,
  som TEXT,

  -- Fundraising
  fundraising_stage TEXT,
  amount_raising NUMERIC,
  valuation NUMERIC,
  use_of_funds TEXT,
  current_investors JSONB DEFAULT '[]',
  existing_funding NUMERIC,
  lead_investor_requirement TEXT,
  geographic_preferences TEXT,
  investor_preferences TEXT,
  investment_thesis TEXT,

  -- Status
  profile_status TEXT DEFAULT 'draft'
    CHECK (profile_status IN ('draft', 'ai_processing', 'needs_input', 'finalized')),
  profile_completeness NUMERIC DEFAULT 0 CHECK (profile_completeness >= 0 AND profile_completeness <= 100),

  -- Embeddings
  embedding VECTOR(1536),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_startups_user_id ON startups(user_id);
CREATE INDEX idx_startups_embedding ON startups USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- RLS
ALTER TABLE startups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own startups"
  ON startups FOR ALL
  USING (auth.uid() = user_id);
```

### startup_documents

Files uploaded by the founder (pitch decks, business plans, etc.).

```sql
CREATE TABLE startup_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'pitch_deck', 'one_pager', 'business_plan', 'financial_model',
    'product_doc', 'website', 'other'
  )),
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  extracted_text TEXT,
  extraction_status TEXT DEFAULT 'pending'
    CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  ai_extracted_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_startup_documents_startup_id ON startup_documents(startup_id);

-- RLS
ALTER TABLE startup_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own documents"
  ON startup_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM startups
      WHERE startups.id = startup_documents.startup_id
        AND startups.user_id = auth.uid()
    )
  );
```

### startup_document_chunks

Text chunks with vector embeddings for semantic search.

```sql
CREATE TABLE startup_document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES startup_documents(id) ON DELETE CASCADE,
  startup_id UUID NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_document_chunks_startup_id ON startup_document_chunks(startup_id);
CREATE INDEX idx_document_chunks_embedding ON startup_document_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- RLS
ALTER TABLE startup_document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own document chunks"
  ON startup_document_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM startups
      WHERE startups.id = startup_document_chunks.startup_id
        AND startups.user_id = auth.uid()
    )
  );
```

### startup_preferences

Founder's communication and outreach preferences.

```sql
CREATE TABLE startup_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startups(id) ON DELETE CASCADE UNIQUE,
  email_tone TEXT DEFAULT 'professional',
  email_length TEXT DEFAULT 'concise',
  personalization_level TEXT DEFAULT 'high',
  preferred_sign_off TEXT,
  custom_notes TEXT,
  founder_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE startup_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own startup preferences"
  ON startup_preferences FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM startups
      WHERE startups.id = startup_preferences.startup_id
        AND startups.user_id = auth.uid()
    )
  );
```

---

### investor_firms

VC firms, angel groups, family offices, etc.

```sql
CREATE TABLE investor_firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  website TEXT,
  linkedin_url TEXT,
  description TEXT,
  thesis TEXT,
  stage_focus TEXT[] DEFAULT '{}',
  sector_focus TEXT[] DEFAULT '{}',
  geography_focus TEXT[] DEFAULT '{}',
  check_size_min NUMERIC,
  check_size_max NUMERIC,
  fund_size NUMERIC,
  type TEXT CHECK (type IN (
    'vc', 'seed_fund', 'micro_vc', 'angel_syndicate',
    'family_office', 'accelerator', 'corporate_ventures',
    'government', 'other'
  )),
  aum NUMERIC,
  founded_year INTEGER,
  headquarters TEXT,
  logo_url TEXT,
  embedding VECTOR(1536),
  quality_score NUMERIC DEFAULT 0,
  last_verified TIMESTAMPTZ,
  sources_count INTEGER DEFAULT 0,
  confidence NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_investor_firms_type ON investor_firms(type);
CREATE INDEX idx_investor_firms_embedding ON investor_firms
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- Public read, service-role write
ALTER TABLE investor_firms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view investor firms"
  ON investor_firms FOR SELECT
  USING (auth.role() = 'authenticated');
```

### investors

Individual contacts at investor firms.

```sql
CREATE TABLE investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID REFERENCES investor_firms(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  location TEXT,
  bio TEXT,
  personal_thesis TEXT,
  sector_interests TEXT[] DEFAULT '{}',
  stage_interests TEXT[] DEFAULT '{}',
  is_decision_maker BOOLEAN DEFAULT false,
  embedding VECTOR(1536),
  quality_score NUMERIC DEFAULT 0,
  last_verified TIMESTAMPTZ,
  sources_count INTEGER DEFAULT 0,
  confidence NUMERIC DEFAULT 0,
  do_not_contact BOOLEAN DEFAULT false,
  contact_status TEXT DEFAULT 'unknown'
    CHECK (contact_status IN ('unknown', 'valid', 'invalid', 'bounced')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_investors_firm_id ON investors(firm_id);
CREATE INDEX idx_investors_email ON investors(email);
CREATE INDEX idx_investors_do_not_contact ON investors(do_not_contact);
CREATE INDEX idx_investors_embedding ON investors
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- RLS
ALTER TABLE investors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view investors"
  ON investors FOR SELECT
  USING (auth.role() = 'authenticated');
```

### investor_sources

Provenance tracking for investor data.

```sql
CREATE TABLE investor_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID REFERENCES investors(id) ON DELETE CASCADE,
  firm_id UUID REFERENCES investor_firms(id) ON DELETE CASCADE,
  source_url TEXT,
  source_type TEXT CHECK (source_type IN ('website', 'linkedin', 'crunchbase', 'article', 'interview', 'database', 'other')),
  source_title TEXT,
  content TEXT,
  published_at TIMESTAMPTZ,
  retrieved_at TIMESTAMPTZ DEFAULT now(),
  confidence NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_investor_sources_investor_id ON investor_sources(investor_id);
CREATE INDEX idx_investor_sources_firm_id ON investor_sources(firm_id);
```

### investor_portfolios

Portfolio companies tracked per investor/firm.

```sql
CREATE TABLE investor_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID REFERENCES investors(id) ON DELETE CASCADE,
  firm_id UUID REFERENCES investor_firms(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  company_website TEXT,
  company_description TEXT,
  sector TEXT,
  stage TEXT,
  round_size NUMERIC,
  invested_at TIMESTAMPTZ,
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_investor_portfolios_investor_id ON investor_portfolios(investor_id);
CREATE INDEX idx_investor_portfolios_firm_id ON investor_portfolios(firm_id);
```

### investor_activity

Recent activity tracking for investors.

```sql
CREATE TABLE investor_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID REFERENCES investors(id) ON DELETE CASCADE,
  firm_id UUID REFERENCES investor_firms(id) ON DELETE CASCADE,
  activity_type TEXT CHECK (activity_type IN (
    'investment', 'fund_announcement', 'interview',
    'article', 'speak_event', 'hire', 'other'
  )),
  title TEXT,
  description TEXT,
  source_url TEXT,
  occurred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_investor_activity_investor_id ON investor_activity(investor_id);
```

### investor_research

AI-generated research summaries for investors.

```sql
CREATE TABLE investor_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  firm_id UUID REFERENCES investor_firms(id) ON DELETE CASCADE,
  research_type TEXT CHECK (research_type IN ('profile', 'thesis', 'portfolio', 'strategy', 'full')),
  summary TEXT NOT NULL,
  evidence JSONB DEFAULT '[]',
  confidence NUMERIC DEFAULT 0,
  model_used TEXT,
  task_id UUID REFERENCES agent_tasks(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_investor_research_investor_id ON investor_research(investor_id);
```

---

### campaigns

Fundraising campaigns created by founders.

```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_amount NUMERIC,
  stage TEXT,
  start_date DATE,
  target_date DATE,
  target_investor_count INTEGER DEFAULT 100,
  priority_investor_count INTEGER DEFAULT 25,
  status TEXT DEFAULT 'planning'
    CHECK (status IN (
      'planning', 'researching', 'ready_for_outreach',
      'outreach_active', 'meetings', 'due_diligence',
      'negotiation', 'closed', 'paused', 'cancelled'
    )),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_campaigns_startup_id ON campaigns(startup_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);

-- RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own campaigns"
  ON campaigns FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM startups
      WHERE startups.id = campaigns.startup_id
        AND startups.user_id = auth.uid()
    )
  );
```

### campaign_investors

Investors assigned to a campaign with pipeline stage tracking.

```sql
CREATE TABLE campaign_investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  stage TEXT DEFAULT 'discovered'
    CHECK (stage IN (
      'discovered', 'qualified', 'shortlisted', 'ready_for_outreach',
      'draft_ready', 'founder_approved', 'contacted', 'follow_up',
      'replied', 'interested', 'meeting_scheduled', 'meeting_completed',
      'due_diligence', 'term_sheet', 'committed', 'closed',
      'passed', 'not_a_fit', 'no_response', 'opted_out', 'invalid_contact'
    )),
  fit_score NUMERIC,
  priority TEXT CHECK (priority IN ('A+', 'A', 'B', 'C', 'D')),
  fit_reasons JSONB DEFAULT '[]',
  fit_concerns JSONB DEFAULT '[]',
  recommended_angle TEXT,
  recommended_contact UUID REFERENCES investors(id),
  ai_notes TEXT,
  founder_notes TEXT,
  assigned_to UUID REFERENCES profiles(id),
  last_interaction_at TIMESTAMPTZ,
  next_action TEXT,
  next_action_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_campaign_investors_campaign_id ON campaign_investors(campaign_id);
CREATE INDEX idx_campaign_investors_investor_id ON campaign_investors(investor_id);
CREATE INDEX idx_campaign_investors_stage ON campaign_investors(stage);
CREATE UNIQUE INDEX idx_campaign_investors_unique ON campaign_investors(campaign_id, investor_id);

-- RLS
ALTER TABLE campaign_investors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own campaign investors"
  ON campaign_investors FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      JOIN startups ON startups.id = campaigns.startup_id
      WHERE campaigns.id = campaign_investors.campaign_id
        AND startups.user_id = auth.uid()
    )
  );
```

### pipeline_stages

Customizable pipeline stages per campaign.

```sql
CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  color TEXT DEFAULT '#6366f1',
  is_terminal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pipeline_stages_campaign_id ON pipeline_stages(campaign_id);
```

---

### interactions

All interactions between the founder and investors.

```sql
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  investor_id UUID REFERENCES investors(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN (
    'email_sent', 'email_received', 'meeting_scheduled',
    'meeting_completed', 'note', 'follow_up', 'other'
  )),
  direction TEXT CHECK (direction IN ('inbound', 'outbound', 'internal')),
  subject TEXT,
  content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_interactions_startup_id ON interactions(startup_id);
CREATE INDEX idx_interactions_investor_id ON interactions(investor_id);
CREATE INDEX idx_interactions_campaign_id ON interactions(campaign_id);
```

---

### emails

All emails sent and received.

```sql
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  investor_id UUID REFERENCES investors(id) ON DELETE SET NULL,
  thread_id UUID,
  message_id TEXT UNIQUE,
  provider_message_id TEXT,
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  body_html TEXT,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'delivered', 'bounced', 'failed')),
  direction TEXT CHECK (direction IN ('outbound', 'inbound')),
  ai_generated BOOLEAN DEFAULT false,
  founder_edited BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounce_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_emails_startup_id ON emails(startup_id);
CREATE INDEX idx_emails_investor_id ON emails(investor_id);
CREATE INDEX idx_emails_campaign_id ON emails(campaign_id);
CREATE INDEX idx_emails_thread_id ON emails(thread_id);
CREATE INDEX idx_emails_status ON emails(status);
CREATE INDEX idx_emails_message_id ON emails(message_id);
CREATE INDEX idx_emails_direction ON emails(direction);

-- RLS
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own emails"
  ON emails FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM startups
      WHERE startups.id = emails.startup_id
        AND startups.user_id = auth.uid()
    )
  );
```

### email_threads

Groups emails into conversations.

```sql
CREATE TABLE email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  subject TEXT,
  last_message_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'closed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_email_threads_investor_id ON email_threads(investor_id);
CREATE INDEX idx_email_threads_campaign_id ON email_threads(campaign_id);
```

### email_events

Webhook events from email provider.

```sql
CREATE TABLE email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
  event_type TEXT CHECK (event_type IN (
    'sent', 'delivered', 'opened', 'clicked',
    'bounced', 'complained', 'unsubscribed'
  )),
  payload JSONB,
  processed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_email_events_email_id ON email_events(email_id);
```

---

### meetings

Meeting records between founder and investors.

```sql
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  title TEXT,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  location TEXT,
  meeting_type TEXT DEFAULT 'intro'
    CHECK (meeting_type IN ('intro', 'follow_up', 'due_diligence', 'partner', 'other')),
  status TEXT DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  ai_brief JSONB,
  ai_summary JSONB,
  founder_notes TEXT,
  follow_up_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_meetings_startup_id ON meetings(startup_id);
CREATE INDEX idx_meetings_investor_id ON meetings(investor_id);
CREATE INDEX idx_meetings_scheduled_at ON meetings(scheduled_at);

-- RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meetings"
  ON meetings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM startups
      WHERE startups.id = meetings.startup_id
        AND startups.user_id = auth.uid()
    )
  );
```

### meeting_notes

Detailed notes and AI analysis of meetings.

```sql
CREATE TABLE meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  content TEXT,
  ai_extracted JSONB DEFAULT '{}',
  sentiment TEXT,
  interest_level TEXT,
  objections JSONB DEFAULT '[]',
  requested_documents JSONB DEFAULT '[]',
  next_steps JSONB DEFAULT '[]',
  follow_up_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_meeting_notes_meeting_id ON meeting_notes(meeting_id);
```

---

### agent_tasks

Database-driven agent state machine.

```sql
CREATE TABLE agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  batch_id UUID,
  agent_type TEXT NOT NULL CHECK (agent_type IN (
    'director', 'scout', 'researcher', 'matcher',
    'writer', 'reply', 'meeting', 'compliance', 'analyst'
  )),
  status TEXT DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'running', 'waiting',
      'awaiting_approval', 'completed', 'failed',
      'cancelled', 'retrying'
    )),
  priority INTEGER DEFAULT 0,
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  error_message TEXT,
  model_used TEXT,
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX idx_agent_tasks_batch_id ON agent_tasks(batch_id);
CREATE INDEX idx_agent_tasks_startup_id ON agent_tasks(startup_id);
CREATE INDEX idx_agent_tasks_agent_type ON agent_tasks(agent_type);
CREATE INDEX idx_agent_tasks_idempotency_key ON agent_tasks(idempotency_key);

-- RLS
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent tasks"
  ON agent_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM startups
      WHERE startups.id = agent_tasks.startup_id
        AND startups.user_id = auth.uid()
    )
  );
```

---

### ai_model_config

Configurable model routing.

```sql
CREATE TABLE ai_model_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task TEXT NOT NULL UNIQUE,
  model TEXT NOT NULL,
  provider TEXT DEFAULT 'nvidia',
  temperature NUMERIC DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 4096,
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default configurations
INSERT INTO ai_model_config (task, model, temperature, max_tokens) VALUES
  ('extraction', 'meta/llama-3.1-8b-instruct', 0.3, 2048),
  ('classification', 'meta/llama-3.1-8b-instruct', 0.3, 1024),
  ('reasoning', 'meta/llama-3.1-70b-instruct', 0.7, 4096),
  ('writing', 'meta/llama-3.1-70b-instruct', 0.8, 4096),
  ('summarization', 'meta/llama-3.1-8b-instruct', 0.5, 2048),
  ('copilot', 'meta/llama-3.1-70b-instruct', 0.7, 4096),
  ('embedding', 'nvidia/nv-embedqa-e5-v5', 0.0, 0),
  ('reranking', 'nvidia/nv-rerankqa-mistral-4b-v3', 0.0, 0);
```

### ai_usage

Track all AI API calls for cost control.

```sql
CREATE TABLE ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  task TEXT,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  latency_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  cost_estimate NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_usage_startup_id ON ai_usage(startup_id);
CREATE INDEX idx_ai_usage_task_id ON ai_usage(task_id);
CREATE INDEX idx_ai_usage_created_at ON ai_usage(created_at);
```

---

### feedback_logs

Track founder feedback on AI outputs.

```sql
CREATE TABLE feedback_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
  entity_type TEXT CHECK (entity_type IN ('email_draft', 'investor_score', 'research', 'copilot_response')),
  entity_id UUID,
  original_ai_output TEXT,
  founder_edited_output TEXT,
  feedback_type TEXT CHECK (feedback_type IN (
    'too_formal', 'too_long', 'too_generic', 'too_aggressive',
    'incorrect', 'wrong_tone', 'missing_info', 'perfect', 'other'
  )),
  feedback_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feedback_logs_startup_id ON feedback_logs(startup_id);
```

---

### compliance_records

Compliance checks before sending emails.

```sql
CREATE TABLE compliance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
  checks JSONB DEFAULT '{}',
  passed BOOLEAN DEFAULT false,
  failures JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### suppression_list

Emails/investors that must not be contacted.

```sql
CREATE TABLE suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  investor_id UUID REFERENCES investors(id) ON DELETE CASCADE,
  reason TEXT CHECK (reason IN ('opt_out', 'hard_bounce', 'founder_blocked', 'invalid', 'compliance')),
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_suppression_list_email ON suppression_list(email);
CREATE INDEX idx_suppression_list_investor_id ON suppression_list(investor_id);
```

### rate_limits

Email sending rate limiting.

```sql
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, action_type, window_start)
);

CREATE INDEX idx_rate_limits_user_action ON rate_limits(user_id, action_type);
```

### processed_events

Idempotency tracking for external events.

```sql
CREATE TABLE processed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  event_type TEXT,
  payload_hash TEXT,
  processed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_processed_events_event_id ON processed_events(event_id);
```

---

### notifications

User notifications.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN (
    'email_reply', 'meeting_request', 'ai_task_complete',
    'draft_ready', 'follow_up_due', 'task_failed',
    'compliance_issue', 'campaign_update', 'system'
  )),
  title TEXT NOT NULL,
  message TEXT,
  entity_type TEXT,
  entity_id UUID,
  read BOOLEAN DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notifications"
  ON notifications FOR ALL
  USING (auth.uid() = user_id);
```

### audit_logs

Complete audit trail.

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  actor TEXT CHECK (actor IN ('founder', 'ai', 'system', 'integration')),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  before_state JSONB,
  after_state JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

---

## Database Functions

### updated_at trigger

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON startups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- ... (same for all tables with updated_at column)
```

### Profile auto-creation on signup

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

## Migration Naming Convention

```
YYYYMMDDHHMMSS_description.sql
```

Example:
```
20260821120000_initial_schema.sql
20260822150000_add_investor_scores.sql
```

---

## Backup & Recovery

See [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md) for backup procedures.
