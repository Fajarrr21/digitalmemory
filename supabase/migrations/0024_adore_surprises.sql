-- ============================================================================
-- 0024 — the way i adore you. ♡  (Phase 2: the little surprises)
--   Run AFTER 0023.
--
--  Same table, two new kinds:
--    thousand   A Thousand Times, You — numbered reasons. `number` is assigned
--               by a trigger (max+1 under a per-space advisory lock) and is
--               unique per space, so two saves can never share a number.
--               Body is optional for these ("001 — Your smile.").
--    surprise   Tonight, I Choose You — category = moment (morning / midnight /
--               special / random / unscheduled). Timing IS publish_at: RLS
--               already hides a row until then, so no scheduler is needed.
--
--  Surprise pool: any kind may join (`in_pool`). `repeat_allowed` = it may be
--  drawn again after she has opened it. Drawing happens in the app over rows
--  RLS already lets her read, so the pool can never surface a sealed note.
--
--  `song_track_id` — optional Spotify track (official embed, no API key).
--  Idempotent — safe to re-run.
-- ============================================================================

alter table public.adore_contents drop constraint if exists adore_contents_content_type_check;
alter table public.adore_contents add constraint adore_contents_content_type_check
  check (content_type in ('reason','open_when','through_my_eyes','thousand','surprise'));

-- Body may be empty only for a thousand-reason (the title is the reason).
alter table public.adore_contents drop constraint if exists adore_contents_body_check;
alter table public.adore_contents add constraint adore_contents_body_check
  check (char_length(body) <= 20000 and (content_type = 'thousand' or char_length(body) >= 1));

alter table public.adore_contents add column if not exists number         int;
alter table public.adore_contents add column if not exists in_pool        boolean not null default false;
alter table public.adore_contents add column if not exists repeat_allowed boolean not null default true;
alter table public.adore_contents add column if not exists song_track_id  text
  check (song_track_id ~ '^[A-Za-z0-9]{22}$');

create unique index if not exists uq_adore_number
  on public.adore_contents(space_id, number) where content_type = 'thousand';

create or replace function public.adore_assign_number()
returns trigger
language plpgsql as $$
begin
  if new.content_type = 'thousand' then
    if new.number is null then
      perform pg_advisory_xact_lock(hashtext('adore_number:' || new.space_id::text));
      select coalesce(max(number), 0) + 1 into new.number
        from public.adore_contents
       where space_id = new.space_id and content_type = 'thousand';
    end if;
  else
    new.number := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_adore_number on public.adore_contents;
create trigger trg_adore_number before insert or update of content_type on public.adore_contents
  for each row execute function public.adore_assign_number();
