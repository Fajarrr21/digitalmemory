-- ============================================================================
--  0004 — cap WhatsApp rating notifications at 2 per person per day
--  Each successful notify increments notify_count; we only send while it's < 2.
--  So the first rating + one later update both notify, then it stops.
-- ============================================================================

alter table public.daily_ratings
  add column if not exists notify_count int not null default 0;
