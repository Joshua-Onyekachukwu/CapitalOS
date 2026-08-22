# Capital OS — Database Architecture

## Overview

Capital OS uses **Supabase PostgreSQL** as its primary database. All data lives in Supabase, with Row Level Security (RLS) enforcing access control. The database is organized into logical groups via migrations.

## Migration History

| Migration | Name | Tables | Status |
|-----------|------|--------|--------|
| 001 | Profiles & Triggers | `profiles` | ✅ Applied |
| 002 | Investor Intelligence | `investors`, `investor_firms`, `investor_profiles`, `investor_employment_history`, `investor_data_sources`, `data_providers`, `data_acquisition_jobs`, `investor_sectors`, `investor_search_history`, `admin_audit_log` | ✅ Applied |
| 003 | Intelligence Pipeline | `raw_records`, `duplicate_candidates`, `data_change_log`, `firm_aliases`, `email_accounts`, `email_messages`, `campaign_investors`, `saved_investors` | ✅ Applied |
| 004 | Company Intelligence & Billing | `company_profiles`, `company_team_members`, `company_documents`, `billing_plans`, `user_subscriptions`, `credit_ledger`, `credit_costs` | ⏳ Ready to apply |

## Entity Relationship Diagram

```
                    ┌──────────────┐
                    │  auth.users  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────────┐
              ▼            ▼                ▼
        ┌──────────┐ ┌──────────────┐ ┌──────────────────┐
        │ profiles │ │   company    │ │ user_subscriptions│
        │          │ │  _profiles   │ │                  │
        └──────────┘ └──────┬───────┘ └────────┬─────────┘
                            │                   │
              ┌─────────────┼──────────┐        │
              ▼             ▼          ▼        ▼
     ┌──────────────┐ ┌──────────┐ ┌──────────────┐
     │company_team_ │ │company_  │ │ billing_plans│
     │  members     │ │documents │ │              │
     └──────────────┘ └──────────┘ └──────────────┘
                                           │
                                    ┌──────┴──────┐
                                    ▼             ▼
                              ┌──────────┐ ┌──────────┐
                              │ credit_  │ │ credit_  │
                              │ ledger   │ │ costs    │
                              └──────────┘ └──────────┘

     ┌──────────────────────────────────────────────────┐
     │              INVESTOR INTELLIGENCE                │
     │                                                   │
     │  ┌──────────────┐     ┌──────────────────┐       │
     │  │investor_firms│◄────│ investors        │       │
     │  │              │     │                  │       │
     │  └──────┬───────┘     └────────┬─────────┘       │
     │         │                      │                  │
     │  ┌──────┴───────┐     ┌────────┼────────────┐    │
     │  │firm_aliases  │     │        │            │    │
     │  └──────────────┘     ▼        ▼            ▼    │
     │                ┌──────────┐ ┌────────┐ ┌────────┐│
     │                │investor_ │ │investor│ │investor││
     │                │profiles  │ │_data_  │ │_employ_││
     │                │          │ │sources │ │_history││
     │                └──────────┘ └────────┘ └────────┘│
     └──────────────────────────────────────────────────┘

     ┌──────────────────────────────────────────────────┐
     │              DATA PIPELINE                        │
     │                                                   │
     │  ┌──────────────┐     ┌──────────────────┐       │
     │  │data_providers│────►│data_acquisition_ │       │
     │  │              │     │     jobs          │       │
     │  └──────────────┘     └──────────────────┘       │
     │                                                   │
     │  ┌──────────────┐     ┌──────────────────┐       │
     │  │ raw_records  │────►│duplicate_        │       │
     │  │ (staging)    │     │  candidates      │       │
     │  └──────────────┘     └──────────────────┘       │
     │                                                   │
     │  ┌──────────────────┐  ┌──────────────────┐      │
     │  │data_change_log   │  │firm_aliases      │      │
     │  └──────────────────┘  └──────────────────┘      │
     └──────────────────────────────────────────────────┘

     ┌──────────────────────────────────────────────────┐
     │              OUTREACH & EMAIL                     │
     │                                                   │
     │  ┌──────────────┐     ┌──────────────────┐       │
     │  │email_accounts│────►│ email_messages    │       │
     │  │ (OAuth)      │     │                  │       │
     │  └──────────────┘     └──────────────────┘       │
     │                                                   │
     │  ┌──────────────┐     ┌──────────────────┐       │
     │  │campaign_     │     │ saved_investors   │       │
     │  │investors     │     │                  │       │
     │  └──────────────┘     └──────────────────┘       │
     └──────────────────────────────────────────────────┘
```

## Table Reference

### Core User Tables

#### `profiles`
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID PK | References `auth.users(id)` |
| `full_name` | TEXT | User's display name |
| `avatar_url` | TEXT | Profile picture URL |
| `created_at` | TIMESTAMPTZ | Auto-set on creation |
| `updated_at` | TIMESTAMPTZ | Auto-updated via trigger |

**RLS:** User can read/update own profile only.
**Trigger:** Auto-created on signup via `handle_new_user()`.

#### `company_profiles`
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → auth.users | UNIQUE — one company per user |
| `company_name` | TEXT | |
| `website_url` | TEXT | Used for intelligence extraction |
| `industry` | TEXT | Maps to investor_sectors taxonomy |
| `location` | TEXT | |
| `company_stage` | TEXT | pre_seed → growth |
| `business_model` | TEXT | SaaS, marketplace, etc. |
| `one_liner` | TEXT | One-sentence description |
| `description` | TEXT | Detailed description |
| `differentiator` | TEXT | Key differentiator |
| `target_customer` | TEXT | Who uses/buys the product |
| `currently_raising` | BOOLEAN | |
| `funding_amount` | NUMERIC | |
| `round_type` | TEXT | Pre-seed → Growth |
| `target_investor_geographies` | TEXT[] | |
| `has_pitch_deck` | BOOLEAN | |
| `mrr`, `arr` | NUMERIC | Revenue metrics |
| `customer_count` | INTEGER | |
| `growth_rate` | TEXT | |
| `milestones` | TEXT[] | |
| `employee_count` | INTEGER | |
| `onboarding_completed` | BOOLEAN | |
| `onboarding_step` | INTEGER | Current step (0-7) |
| `readiness_score` | INTEGER | 0-100, calculated from 13 factors |

**RLS:** User can read/update own profile.
**Trigger:** Auto-creates free subscription on insert.

### Investor Intelligence Tables

#### `investors`
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID PK | |
| `full_name` | TEXT NOT NULL | |
| `first_name`, `last_name` | TEXT | |
| `email` | TEXT | Indexed |
| `phone` | TEXT | |
| `linkedin_url` | TEXT | Indexed |
| `job_title` | TEXT | |
| `bio` | TEXT | |
| `location`, `country`, `city` | TEXT | |
| `investor_type` | investor_type ENUM | 16 types |
| `current_firm_id` | UUID FK → investor_firms | |
| `investment_stages` | investment_stage[] | GIN indexed |
| `investment_sectors` | TEXT[] | GIN indexed |
| `investment_geographies` | TEXT[] | GIN indexed |
| `min_check_size`, `max_check_size` | NUMERIC | |
| `investment_thesis` | TEXT | |
| `portfolio_count` | INTEGER | |
| `is_active` | BOOLEAN | |
| `is_verified` | BOOLEAN | |
| `do_not_contact` | BOOLEAN | |
| `outreach_readiness` | outreach_readiness ENUM | 5 states |
| `data_quality_score` | INTEGER | 0-100 |
| `fit_score` | INTEGER | 0-100 |
| `source`, `source_id`, `source_provider` | TEXT | Provenance |
| `merged_into_id` | UUID FK → investors | For dedup merge |
| `merge_history` | JSONB | |

**RLS:** All authenticated users can read. Service role manages writes.
**Indexes:** email, linkedin_url, firm, type, country, stages (GIN), sectors (GIN), geographies (GIN), source, active.

#### `investor_firms`
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID PK | |
| `name` | TEXT NOT NULL | Indexed |
| `domain`, `website` | TEXT | |
| `firm_type` | firm_type ENUM | 12 types |
| `headquarters`, `country`, `region` | TEXT | |
| `investment_stages` | investment_stage[] | GIN indexed |
| `investment_sectors` | TEXT[] | GIN indexed |
| `min_check_size`, `max_check_size` | NUMERIC | |
| `fund_size` | NUMERIC | |
| `portfolio_count` | INTEGER | |
| `normalized_name` | TEXT | For alias matching |

**RLS:** All authenticated users can read. Service role manages writes.

#### `raw_records`
Staging table for ingestion. Records flow through: `pending` → `processing` → `matched`/`new`/`duplicate`/`error`.

#### `duplicate_candidates`
Review queue for potential duplicates. Fields: `investor_a_id`, `investor_b_id`, `confidence` (0-1), `match_signals` (JSONB), `status` (pending/approved/rejected).

#### `data_change_log`
Immutable audit trail. Every field change on an investor record is logged with: old value, new value, source, confidence, timestamp.

### Email & Outreach Tables

#### `email_accounts`
OAuth-connected email accounts. Stores encrypted access/refresh tokens. One per provider per user.

#### `email_messages`
Every sent/received email. Links to `investor_id` and `user_id`. Tracks status: draft → sent → delivered → opened → replied.

#### `campaign_investors`
Junction table linking campaigns (stored as `data_acquisition_jobs` with `job_type = 'campaign'`) to investors with pipeline stage tracking.

### Billing Tables

#### `billing_plans`
Three seeded plans: Free ($0), Workspace ($29/mo), Workspace Pro ($79/mo).

#### `user_subscriptions`
One per user. Links to plan, tracks credits remaining and usage this period.

#### `credit_ledger`
Immutable log of every credit transaction. Fields: amount, balance_after, operation, model_used, tokens_used.

#### `credit_costs`
Maps operation names to credit costs. 8 operations defined.

## Views

| View | Purpose |
|------|---------|
| `v_investors_with_firms` | Investors joined with firm data |
| `v_provider_usage` | Data provider credit usage |
| `v_pending_duplicates` | Duplicate candidates with investor names |
| `v_data_health` | Aggregate data quality metrics |
| `v_user_billing` | User subscription + plan details |

## Enums

| Enum | Values |
|------|--------|
| `investor_type` | angel_investor, angel_syndicate, venture_capital, corporate_venture, family_office, private_equity, accelerator, incubator, government_fund, university_fund, venture_studio, micro_vc, impact_investor, strategic_investor, debt_investor, fund_of_funds |
| `investment_stage` | pre_seed, seed, series_a, series_b, series_c, growth, late_stage, pre_ipo |
| `firm_type` | venture_capital, corporate_venture, family_office, accelerator, incubator, angel_syndicate, micro_vc, growth_equity, private_equity, fund_of_funds, sovereign_wealth, other |
| `outreach_readiness` | not_ready, needs_verification, ready, contacted, do_not_contact |
| `source_type` | provider, web_research, firm_website, manual_entry, ai_inferred, public_records |
| `review_status` | pending, approved, rejected, auto_resolved |

---

*Last updated: August 22, 2026*
