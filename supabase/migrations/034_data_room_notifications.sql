-- =============================================
-- 034 — Data room owner notifications
-- =============================================
-- The access log records what happened, but an owner has to go looking for it.
-- These rows are the active signal: a link was opened, or one of their links is
-- being hammered with attempts that no longer work.
--
-- Deduplication is part of the schema, not the caller: (share_id, kind, bucket)
-- is unique, where bucket is a coarse time window computed by the caller. That
-- makes "once per hour for opens" and "once per six hours for a burst of blocked
-- attempts" safe even when two requests race, because the second insert loses.

create table if not exists public.data_room_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  share_id uuid references public.data_room_shares(id) on delete cascade,
  kind text not null check (kind in ('opened', 'blocked')),
  bucket text not null,
  title text not null,
  detail jsonb not null default '{}'::jsonb,
  email_status text not null default 'not_attempted'
    check (email_status in ('not_attempted', 'sent', 'skipped_no_account', 'failed')),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint data_room_notifications_once unique (share_id, kind, bucket)
);

create index if not exists idx_data_room_notifications_owner
  on public.data_room_notifications (user_id, created_at desc);

alter table public.data_room_notifications enable row level security;

-- Owners read their own notifications. Writes stay with the service role (which
-- bypasses RLS), because the public token endpoint creates them and it has no
-- session to attribute an insert to.
drop policy if exists "data_room_notifications_owner_select" on public.data_room_notifications;
create policy "data_room_notifications_owner_select"
  on public.data_room_notifications for select
  using (auth.uid() = user_id);

drop policy if exists "data_room_notifications_owner_update" on public.data_room_notifications;
create policy "data_room_notifications_owner_update"
  on public.data_room_notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.data_room_notifications is
  'Owner-facing alerts for share activity. (share_id, kind, bucket) is unique so repeated opens or a burst of blocked attempts cannot spam the owner.';
