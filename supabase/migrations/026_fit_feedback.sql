-- =============================================
-- 026 — Match feedback
-- =============================================
-- The fit score is a batch classification of the shared corpus. A founder's
-- judgement that a particular match was right or wrong is per-user data, so it
-- lives in its own table rather than modifying the shared investor record.
--
-- One row per (user, investor): re-rating replaces the previous verdict instead
-- of stacking duplicates, which is what a feedback loop needs to stay honest.

create table if not exists public.fit_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  investor_id uuid not null references public.investors(id) on delete cascade,
  verdict     text not null check (verdict in ('good_match', 'not_a_fit')),
  reason      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, investor_id)
);

create index if not exists idx_fit_feedback_user
  on public.fit_feedback (user_id, updated_at desc);

alter table public.fit_feedback enable row level security;

drop policy if exists fit_feedback_select_own on public.fit_feedback;
create policy fit_feedback_select_own on public.fit_feedback
  for select using (auth.uid() = user_id);

drop policy if exists fit_feedback_insert_own on public.fit_feedback;
create policy fit_feedback_insert_own on public.fit_feedback
  for insert with check (auth.uid() = user_id);

drop policy if exists fit_feedback_update_own on public.fit_feedback;
create policy fit_feedback_update_own on public.fit_feedback
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists fit_feedback_delete_own on public.fit_feedback;
create policy fit_feedback_delete_own on public.fit_feedback
  for delete using (auth.uid() = user_id);

comment on table public.fit_feedback is
  'Per-user verdict on a corpus fit score; never written to the shared investors table.';
