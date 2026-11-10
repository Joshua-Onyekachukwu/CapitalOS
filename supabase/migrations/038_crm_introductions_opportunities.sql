-- 038 — CRM tasks, introductions and opportunities
--
-- Three surfaces had UI copy and nav entries but no persistence. These tables
-- back them with the same per-user ownership model as the rest of the app:
-- every row is owned by auth.uid(), and RLS enforces that even if a query
-- forgets the filter.
--
-- Deliberately no seed data. An empty table renders an empty state that says
-- so; a fabricated row would put invented activity in a founder's pipeline.

begin;

-- ── CRM tasks ────────────────────────────────────────────────────────────────
create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  notes text,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'done', 'snoozed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_tasks_user_status_due_idx
  on public.crm_tasks (user_id, status, due_at nulls last);
create index if not exists crm_tasks_investor_idx
  on public.crm_tasks (investor_id) where investor_id is not null;

alter table public.crm_tasks enable row level security;

drop policy if exists "crm_tasks_owner_all" on public.crm_tasks;
create policy "crm_tasks_owner_all" on public.crm_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Introductions ────────────────────────────────────────────────────────────
-- A record of an introduction the founder is pursuing or has received. The
-- investor link is optional: many introductions are to people who are not in
-- the 18,995-firm corpus, and forcing a foreign key would make those
-- unrecordable.
create table if not exists public.introductions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investor_id uuid references public.investors(id) on delete set null,
  target_name text not null check (char_length(target_name) between 1 and 200),
  target_firm text,
  via_name text,
  route text not null default 'warm' check (route in ('direct', 'warm', 'cold')),
  status text not null default 'planned'
    check (status in ('planned', 'requested', 'made', 'met', 'declined')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists introductions_user_status_idx
  on public.introductions (user_id, status, created_at desc);

alter table public.introductions enable row level security;

drop policy if exists "introductions_owner_all" on public.introductions;
create policy "introductions_owner_all" on public.introductions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Opportunities ────────────────────────────────────────────────────────────
-- Grants, accelerators, demo days and challenges. There is no automated source
-- connected yet (docs/33 §5), so these are entered by hand and the page says so
-- rather than showing an empty "market" it cannot substantiate.
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  org text,
  kind text not null default 'grant'
    check (kind in ('grant', 'accelerator', 'event', 'challenge', 'other')),
  deadline date,
  url text,
  notes text,
  status text not null default 'watching'
    check (status in ('watching', 'applied', 'won', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists opportunities_user_status_deadline_idx
  on public.opportunities (user_id, status, deadline nulls last);

alter table public.opportunities enable row level security;

drop policy if exists "opportunities_owner_all" on public.opportunities;
create policy "opportunities_owner_all" on public.opportunities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

commit;
