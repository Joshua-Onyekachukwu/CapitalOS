-- =============================================
-- 029 — Document storage policies and the data room
-- =============================================
-- Two things:
--
-- 1. `storage.objects` had NO policies. Uploads and downloads work only because
--    the server uses the service role after an ownership check. That is a
--    single point of failure: any future code that reaches storage from the
--    client would have no policy to stop it. These policies scope every
--    operation to the caller's own prefix, where the prefix is the user id.
--
-- 2. A data room: a revocable, expiring, logged link that exposes selected
--    documents to someone without a Capital OS account. The token is a bearer
--    secret, so it is high-entropy, stored server-side only, and every access
--    is recorded. Expiry and revocation are both checked on read.

-- ── 1. Storage policies ──

drop policy if exists company_documents_select_own on storage.objects;
create policy company_documents_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'company-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists company_documents_insert_own on storage.objects;
create policy company_documents_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'company-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists company_documents_update_own on storage.objects;
create policy company_documents_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'company-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'company-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists company_documents_delete_own on storage.objects;
create policy company_documents_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'company-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 2. Data room shares ──

create table if not exists public.data_room_shares (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  token            text not null unique,
  label            text,
  document_ids     uuid[] not null default '{}',
  expires_at       timestamptz not null,
  revoked_at       timestamptz,
  access_count     integer not null default 0,
  last_accessed_at timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists idx_data_room_shares_user
  on public.data_room_shares (user_id, created_at desc);

create index if not exists idx_data_room_shares_token
  on public.data_room_shares (token);

alter table public.data_room_shares enable row level security;

drop policy if exists data_room_shares_select_own on public.data_room_shares;
create policy data_room_shares_select_own on public.data_room_shares
  for select using (auth.uid() = user_id);

drop policy if exists data_room_shares_insert_own on public.data_room_shares;
create policy data_room_shares_insert_own on public.data_room_shares
  for insert with check (auth.uid() = user_id);

drop policy if exists data_room_shares_update_own on public.data_room_shares;
create policy data_room_shares_update_own on public.data_room_shares
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists data_room_shares_delete_own on public.data_room_shares;
create policy data_room_shares_delete_own on public.data_room_shares
  for delete using (auth.uid() = user_id);

-- ── 3. Access log ──
-- Written only by the server (service role) when a share link is opened. The
-- owner can read the log for their own shares; nobody can edit it from a client.

create table if not exists public.data_room_access_log (
  id             uuid primary key default gen_random_uuid(),
  share_id       uuid not null references public.data_room_shares(id) on delete cascade,
  accessed_at    timestamptz not null default now(),
  ip             text,
  user_agent     text,
  document_count integer not null default 0
);

create index if not exists idx_data_room_access_share
  on public.data_room_access_log (share_id, accessed_at desc);

alter table public.data_room_access_log enable row level security;

drop policy if exists data_room_access_select_own on public.data_room_access_log;
create policy data_room_access_select_own on public.data_room_access_log
  for select using (
    exists (
      select 1 from public.data_room_shares s
       where s.id = share_id
         and s.user_id = auth.uid()
    )
  );

comment on table public.data_room_shares is
  'Expiring, revocable bearer link to selected company documents. Token is never rendered in the owner UI after creation except for copying.';
comment on table public.data_room_access_log is
  'Every open of a data room link, written server-side only.';

-- ── 4. Atomic access logging ──
-- The counter and the log row must move together; two round-trips from the
-- route could record an access without counting it. SECURITY DEFINER with
-- execute revoked from every client role: only the service role may call it.

create or replace function public.log_data_room_access(
  p_share_id uuid,
  p_ip text,
  p_user_agent text,
  p_document_count integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.data_room_access_log (share_id, ip, user_agent, document_count)
  values (p_share_id, p_ip, p_user_agent, greatest(0, coalesce(p_document_count, 0)));

  update public.data_room_shares
     set access_count = access_count + 1,
         last_accessed_at = now()
   where id = p_share_id;
end;
$$;

revoke all on function public.log_data_room_access(uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.log_data_room_access(uuid, text, text, integer)
  to service_role;
