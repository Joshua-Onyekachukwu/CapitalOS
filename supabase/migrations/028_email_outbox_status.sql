-- =============================================
-- 028 — Developer outbox status
-- =============================================
-- The send path can run without a mailbox by writing to an outbox, but only
-- when EMAIL_PROVIDER=outbox is explicitly set. Those messages must be
-- distinguishable from delivered mail forever, so they get their own status
-- value rather than reusing 'sent'.
--
-- Every existing row already satisfies the new list, so re-validating the
-- constraint cannot fail on production data.

alter table public.email_messages
  drop constraint if exists email_messages_status_check;

alter table public.email_messages
  add constraint email_messages_status_check
  check (
    status = any (
      array[
        'draft'::text,
        'scheduled'::text,
        'queued_dev'::text,
        'sent'::text,
        'delivered'::text,
        'opened'::text,
        'clicked'::text,
        'bounced'::text,
        'failed'::text,
        'replied'::text
      ]
    )
  );

comment on column public.email_messages.status is
  'queued_dev = written to the developer outbox; never delivered, never reported as sent.';
