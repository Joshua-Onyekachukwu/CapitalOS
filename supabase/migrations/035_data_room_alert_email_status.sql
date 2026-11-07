-- =============================================
-- 035 — Platform-sent data room alerts
-- =============================================
-- Alerts can now be delivered from the platform's own sender when the owner has
-- not connected a mailbox. "No provider configured" is a distinct outcome from
-- "owner has no mailbox" and from "send failed", and the column should say which
-- happened rather than collapsing them.

alter table public.data_room_notifications
  drop constraint if exists data_room_notifications_email_status_check;

alter table public.data_room_notifications
  add constraint data_room_notifications_email_status_check
  check (email_status in (
    'not_attempted',
    'sent',
    'skipped_no_account',
    'skipped_no_provider',
    'failed'
  ));
