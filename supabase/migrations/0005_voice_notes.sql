-- ============================================================================
--  0005 — voice notes
--  * media.type gains 'audio'.
--  * media can attach to a daily_rating too (voice note on the day's story),
--    so the one-parent rule now spans four possible parents.
--  Storage + media RLS already cover this (keyed by space_id/owner_id).
-- ============================================================================

-- ---- allow audio media ----------------------------------------------------
alter table public.media drop constraint if exists media_type_check;
alter table public.media add constraint media_type_check
  check (type in ('image', 'video', 'audio'));

-- ---- media can belong to a rating -----------------------------------------
alter table public.media
  add column if not exists rating_id uuid references public.daily_ratings(id) on delete cascade;

alter table public.media drop constraint if exists chk_media_one_parent;
alter table public.media add constraint chk_media_one_parent check (
  (activity_id is not null)::int
  + (memory_id is not null)::int
  + (message_id is not null)::int
  + (rating_id is not null)::int = 1
);

create index if not exists idx_media_rating on public.media(rating_id);
