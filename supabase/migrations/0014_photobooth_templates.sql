-- ============================================================================
--  0014 — Photobooth v2: real frame templates
--
--  Frames are now image templates (public/photobooth/frames/*.webp) with
--  2–4 photo windows each, so a session's shot_count follows the chosen
--  template's slot count (3-slot strips are common) instead of the old
--  Classic/4-shot pair. Idempotent.
-- ============================================================================

alter table public.photobooth_sessions
  drop constraint if exists photobooth_sessions_shot_count_check;
alter table public.photobooth_sessions
  add constraint photobooth_sessions_shot_count_check
  check (shot_count between 1 and 4);
