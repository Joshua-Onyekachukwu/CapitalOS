-- =============================================
-- 044: Synthetic waitlist entries
-- =============================================
-- The founder demo profiles should also be visible as waitlist entries so the
-- admin surface and the waitlist flow can be exercised with realistic volume.
-- They must never count as traction: the public waitlist counter and every
-- "signups" stat exclude them, and the admin list labels them.
--
-- Kept in its own migration because 043 is already applied in production.

alter table public.waitlist
  add column if not exists is_synthetic boolean not null default false,
  add column if not exists demo_batch  text;

create index if not exists waitlist_demo_batch_idx
  on public.waitlist (demo_batch)
  where is_synthetic;

create index if not exists waitlist_organic_idx
  on public.waitlist (created_at desc)
  where not is_synthetic;

comment on column public.waitlist.is_synthetic is
  'true = generated demo row from demo_founders. Never a real signup, never counted as traction.';
comment on column public.waitlist.demo_batch is
  'Batch id so a synthetic waitlist load can be removed atomically.';
