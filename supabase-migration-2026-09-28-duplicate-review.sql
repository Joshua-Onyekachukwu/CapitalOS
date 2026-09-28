-- Duplicate review + merge (applied 2026-09-28).
-- Extends the dedup lifecycle: canonical-name duplicate pairs are persisted
-- as 'pending' review items by find_duplicate_investors(), and
-- merge_investors() folds a reviewed pair under admin confirmation.
-- Idempotent; nothing merges automatically.

-- New lifecycle value for reviewed-and-merged pairs.
-- NOTE: if run in a transaction with immediate use, Postgres raises
-- 55P04 (unsafe use of new value) — run ALTER TYPE in its own transaction.
alter type review_status add value if not exists 'merged' after 'auto_resolved';

-- Find duplicates by canonical name; persist pending candidates.
create or replace function find_duplicate_investors(p_similarity numeric default 0.85, p_limit int default 200)
returns jsonb
language plpgsql
set search_path = public
as $fn$
declare
  v_groups jsonb;
  v_created int := 0;
  rec record;
begin
  create temp table tmp_pairs on commit drop as
  select g.ids[1] as a_id, g.ids[2] as b_id, g.name_normalized
  from (
    select name_normalized, array_agg(id order by created_at) as ids
    from investors
    where is_active = true and name_normalized is not null
    group by name_normalized
    having count(*) > 1
  ) g
  limit p_limit;

  for rec in select a_id, b_id, name_normalized from tmp_pairs loop
    if not exists (
      select 1 from duplicate_candidates
      where (investor_a_id = rec.a_id and investor_b_id = rec.b_id)
         or (investor_a_id = rec.b_id and investor_b_id = rec.a_id)
    ) then
      insert into duplicate_candidates (investor_a_id, investor_b_id, confidence, match_signals, status)
      values (rec.a_id, rec.b_id, 0.99, jsonb_build_object('signal', 'name_normalized_exact', 'name', rec.name_normalized), 'pending');
      v_created := v_created + 1;
    end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('aId', t.a_id, 'bId', t.b_id, 'name', t.name_normalized)), '[]'::jsonb)
  into v_groups from tmp_pairs t;

  return jsonb_build_object('groups', coalesce(v_groups, '[]'::jsonb), 'created', v_created);
end
$fn$;

revoke execute on function find_duplicate_investors(numeric, int) from anon, authenticated;

-- Merge a reviewed pair: fill keeper's empty fields, re-attach user
-- references, deactivate (never delete) the loser, resolve candidates.
create or replace function merge_investors(p_keeper uuid, p_loser uuid)
returns jsonb
language plpgsql
set search_path = public
as $fn$
declare
  v_counts jsonb;
begin
  if p_keeper = p_loser then
    raise exception 'Cannot merge an investor into itself';
  end if;
  if not exists (select 1 from investors where id = p_keeper) or not exists (select 1 from investors where id = p_loser) then
    raise exception 'Investor not found';
  end if;

  update investors k set
    email = coalesce(k.email, l.email),
    linkedin_url = coalesce(k.linkedin_url, l.linkedin_url),
    website_url = coalesce(k.website_url, l.website_url),
    job_title = coalesce(k.job_title, l.job_title),
    bio = coalesce(k.bio, l.bio),
    city = coalesce(k.city, l.city),
    country = coalesce(k.country, l.country),
    fit_score = greatest(coalesce(k.fit_score, 0), coalesce(l.fit_score, 0)),
    data_quality_score = greatest(coalesce(k.data_quality_score, 0), coalesce(l.data_quality_score, 0)),
    last_verified_at = greatest(coalesce(k.last_verified_at, l.last_verified_at), coalesce(l.last_verified_at, k.last_verified_at)),
    updated_at = now()
  from investors l
  where k.id = p_keeper and l.id = p_loser;

  update saved_investors set investor_id = p_keeper where investor_id = p_loser;
  update user_pipeline_entries set investor_id = p_keeper where investor_id = p_loser;

  update investors set is_active = false, updated_at = now() where id = p_loser;

  update duplicate_candidates
  set status = 'merged', merge_into_id = p_keeper, reviewed_at = now()
  where status = 'pending'
    and ((investor_a_id = p_keeper and investor_b_id = p_loser)
      or (investor_a_id = p_loser and investor_b_id = p_keeper));

  select jsonb_build_object('keeper', p_keeper, 'loser', p_loser) into v_counts;
  return v_counts;
end
$fn$;

revoke execute on function merge_investors(uuid, uuid) from anon, authenticated;
