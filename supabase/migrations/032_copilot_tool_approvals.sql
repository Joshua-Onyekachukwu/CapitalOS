-- =============================================
-- 032: Copilot tool approvals
-- =============================================
-- A copilot that can act has to be able to stop and ask. Every mutating tool
-- call is written here as `pending` and only executed after the owner approves
-- it; the row is the record of what was proposed, by whom, with what arguments,
-- and what actually happened. Nothing in this table is executed automatically.
--
-- Read-only tools never write here — they run inline and their output is shown
-- with the answer.

create table if not exists copilot_tool_runs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  conversation_id uuid references copilot_conversations(id) on delete cascade,
  tool_name       text not null,
  args            jsonb not null default '{}'::jsonb,
  summary         text not null,
  status          text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected', 'executed', 'failed')),
  result          jsonb,
  error           text,
  created_at      timestamptz not null default now(),
  decided_at      timestamptz,
  executed_at     timestamptz
);

create index if not exists idx_copilot_tool_runs_user
  on copilot_tool_runs (user_id, created_at desc);

create index if not exists idx_copilot_tool_runs_pending
  on copilot_tool_runs (user_id, status)
  where status = 'pending';

alter table copilot_tool_runs enable row level security;

-- Owners see and create only their own rows. Execution happens server-side via
-- the service role after an explicit approve, so there is no UPDATE policy for
-- authenticated users: a client cannot approve its own pending action by
-- writing to the table directly.
drop policy if exists "copilot_tool_runs_select_own" on copilot_tool_runs;
create policy "copilot_tool_runs_select_own"
  on copilot_tool_runs for select
  using (auth.uid() = user_id);

drop policy if exists "copilot_tool_runs_insert_own" on copilot_tool_runs;
create policy "copilot_tool_runs_insert_own"
  on copilot_tool_runs for insert
  with check (auth.uid() = user_id);
