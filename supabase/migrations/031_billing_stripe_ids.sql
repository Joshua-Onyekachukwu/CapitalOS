-- =============================================
-- 031: Stripe identifiers on user_subscriptions
-- =============================================
-- Checkout needs a stable customer per user (so the portal can find them), and
-- the webhook needs to map a Stripe subscription back to the local row. Both
-- were previously impossible to store, which is why billing could only ever be
-- mock. Nullable so existing rows and the internal (non-Stripe) path are
-- unaffected.

alter table user_subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

create index if not exists idx_user_subscriptions_user
  on user_subscriptions (user_id);

create index if not exists idx_user_subscriptions_stripe_customer
  on user_subscriptions (stripe_customer_id);

create index if not exists idx_user_subscriptions_stripe_subscription
  on user_subscriptions (stripe_subscription_id);
