-- ============================================================================
--  0008 — repair media parent constraint on databases where 0005/0006 only
--  partially applied (the rating_id / album_id COLUMNS were added but the
--  chk_media_one_parent CHECK was never rebuilt, so it still enforced the old
--  three-parent rule). Symptom: album uploads and voice notes on a daily
--  rating fail with "violates check constraint chk_media_one_parent" (23514).
--  Idempotent — safe to run even where 0005/0006 applied cleanly.
-- ============================================================================

-- media.type must allow audio (voice notes).
alter table public.media drop constraint if exists media_type_check;
alter table public.media add constraint media_type_check
  check (type in ('image', 'video', 'audio'));

-- The one-parent rule spans all five possible parents.
alter table public.media drop constraint if exists chk_media_one_parent;
alter table public.media add constraint chk_media_one_parent check (
  (activity_id is not null)::int
  + (memory_id is not null)::int
  + (message_id is not null)::int
  + (rating_id is not null)::int
  + (album_id is not null)::int = 1
);
