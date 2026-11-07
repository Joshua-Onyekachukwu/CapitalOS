-- =============================================
-- 033 — Data room rate limiting and audit outcomes
-- =============================================
-- The public token endpoint is the only route in the app reachable without a
-- session, and until now it recorded only successful opens. Two gaps:
--
--   • Nothing slowed down token guessing. A 256-bit token makes brute force
--     hopeless, but the endpoint still paid a database lookup on every attempt
--     and the bill (and the logs) were ours.
--   • Denials were invisible. A revoked link being poked, or an expired link
--     still circulating, is exactly the signal the owner wants, and it was
--     thrown away as a 410.
--
-- The limiter is a fixed-window counter in Postgres rather than in memory:
-- serverless instances do not share memory, so an in-process map would give
-- every instance its own budget and multiply the real limit.

-- ── 1. Counter table ──

create table if not exists public.data_room_rate_limits (
  bucket       text not null,          -- 'ip' | 'token'
  identifier   text not null,          -- ip address, or sha256 of the token
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (bucket, identifier, window_start)
);

create index if not exists idx_data_room_rate_window
  on public.data_room_rate_limits (window_start);

alter table public.data_room_rate_limits enable row level security;
-- No policies on purpose. Only the service role touches this table, and the
-- service role bypasses RLS.

-- ── 2. Atomic consume ──
-- One statement decides the request, so two concurrent requests cannot both
-- read the same count and both be allowed.

create or replace function public.consume_data_room_rate_limit(
  p_bucket text,
  p_identifier text,
  p_window_seconds integer,
  p_limit integer
) returns table (allowed boolean, hits integer, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window  timestamptz;
  v_hits    integer;
  v_elapsed numeric;
begin
  if p_bucket is null or p_identifier is null or length(p_identifier) = 0 then
    raise exception 'rate limit bucket and identifier are required';
  end if;
  if p_window_seconds is null or p_window_seconds <= 0 or p_limit is null or p_limit <= 0 then
    raise exception 'rate limit window and limit must be positive';
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.data_room_rate_limits (bucket, identifier, window_start, hits)
  values (p_bucket, p_identifier, v_window, 1)
  on conflict (bucket, identifier, window_start)
  do update set hits = public.data_room_rate_limits.hits + 1
  returning public.data_room_rate_limits.hits into v_hits;

  -- First request in a new window is the only one that prunes, so the delete
  -- cost is paid roughly once per window per identifier instead of per request.
  if v_hits = 1 then
    delete from public.data_room_rate_limits
     where window_start < now() - interval '2 hours';
  end if;

  v_elapsed := extract(epoch from clock_timestamp()) - extract(epoch from v_window);

  return query
    select
      v_hits <= p_limit,
      v_hits,
      greatest(1, ceil(p_window_seconds - v_elapsed)::integer);
end;
$$;

revoke all on function public.consume_data_room_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_data_room_rate_limit(text, text, integer, integer)
  to service_role;

-- ── 3. Audit outcomes ──
-- Denials have no share to point at (an unknown token belongs to nobody), so
-- share_id becomes nullable, and the token is stored only as a hash. The raw
-- token is a credential: it must never land in a log table an operator can read.

alter table public.data_room_access_log
  add column if not exists outcome text not null default 'granted';

alter table public.data_room_access_log
  add column if not exists token_hash text;

alter table public.data_room_access_log
  alter column share_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'data_room_access_log_outcome_check'
  ) then
    alter table public.data_room_access_log
      add constraint data_room_access_log_outcome_check
      check (outcome in ('granted', 'not_found', 'revoked', 'expired', 'rate_limited', 'invalid_token', 'error'));
  end if;
end $$;

create index if not exists idx_data_room_access_outcome
  on public.data_room_access_log (share_id, accessed_at desc);

comment on column public.data_room_access_log.outcome is
  'granted | not_found | revoked | expired | rate_limited | invalid_token | error. Only granted increments the share counter.';
comment on column public.data_room_access_log.token_hash is
  'sha256 of the presented token. The token itself is never stored in the log.';

-- Granted opens keep using the atomic RPC. Re-declared so the outcome is
-- explicit rather than relying on the column default.
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
  insert into public.data_room_access_log
    (share_id, ip, user_agent, document_count, outcome)
  values
    (p_share_id, p_ip, p_user_agent, greatest(0, coalesce(p_document_count, 0)), 'granted');

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
