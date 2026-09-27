-- ============================================================================
--  0013 — A Little Photo Booth
--
--  "Two people. One little frame." A photobooth session for the BOTH OF US
--  mode: one member creates a session, shares its link, the partner joins,
--  each takes their own photos on their own camera, and the app composes one
--  strip. JUST ME mode never touches the database (capture → compose →
--  save/download happens entirely client-side).
--
--  photobooth_sessions — one row per shared session. The row id doubles as
--    the invite token in the link (/photobooth/session/{id}): gen_random_uuid
--    is unguessable, and RLS restricts every read to space members anyway, so
--    a leaked link shows nothing to outsiders.
--  photobooth_photos   — one row per (member, shot). A separate table (not a
--    jsonb map on the session) so two people uploading at the same moment
--    can't clobber each other's writes.
--
--  Sessions expire: a session never joined within 24h is treated as closed
--  (enforced in the server actions; no cron needed). Completed results are
--  saved into a shared album via the existing media/albums path — the session
--  rows are just scaffolding.
--
--  Idempotent — safe to re-run after a partial apply.
-- ============================================================================

create table if not exists public.photobooth_sessions (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references public.spaces(id) on delete cascade,
  creator_id     uuid not null references public.profiles(id) on delete cascade,
  participant_id uuid references public.profiles(id) on delete set null,
  status         text not null default 'waiting'
                 check (status in ('waiting','joined','shooting','completed')),
  frame_id       text not null default 'minimal',
  shot_count     int  not null default 4 check (shot_count in (1, 4)),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  expires_at     timestamptz not null default now() + interval '24 hours'
);

create index if not exists idx_booth_sessions_space
  on public.photobooth_sessions(space_id, created_at desc);

drop trigger if exists trg_booth_sessions_updated on public.photobooth_sessions;
create trigger trg_booth_sessions_updated before update on public.photobooth_sessions
  for each row execute function public.set_updated_at();

alter table public.photobooth_sessions enable row level security;

drop policy if exists booth_sessions_select on public.photobooth_sessions;
create policy booth_sessions_select on public.photobooth_sessions for select
  using (public.is_member(space_id));
drop policy if exists booth_sessions_insert on public.photobooth_sessions;
create policy booth_sessions_insert on public.photobooth_sessions for insert
  with check (public.is_member(space_id) and creator_id = auth.uid());
-- Both members drive the session forward (join, pick frame, advance status).
drop policy if exists booth_sessions_update on public.photobooth_sessions;
create policy booth_sessions_update on public.photobooth_sessions for update
  using (public.is_member(space_id)) with check (public.is_member(space_id));
drop policy if exists booth_sessions_delete on public.photobooth_sessions;
create policy booth_sessions_delete on public.photobooth_sessions for delete
  using (public.is_member(space_id));

create table if not exists public.photobooth_photos (
  session_id   uuid not null references public.photobooth_sessions(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  shot_index   int  not null check (shot_index between 0 and 3),
  storage_path text not null,
  created_at   timestamptz not null default now(),
  primary key (session_id, user_id, shot_index)
);

alter table public.photobooth_photos enable row level security;

drop policy if exists booth_photos_select on public.photobooth_photos;
create policy booth_photos_select on public.photobooth_photos for select
  using (exists (
    select 1 from public.photobooth_sessions s
    where s.id = session_id and public.is_member(s.space_id)
  ));
-- You only place/replace/remove your OWN photo in a session of your space.
drop policy if exists booth_photos_insert on public.photobooth_photos;
create policy booth_photos_insert on public.photobooth_photos for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.photobooth_sessions s
      where s.id = session_id and public.is_member(s.space_id)
    )
  );
drop policy if exists booth_photos_update on public.photobooth_photos;
create policy booth_photos_update on public.photobooth_photos for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists booth_photos_delete on public.photobooth_photos;
create policy booth_photos_delete on public.photobooth_photos for delete
  using (user_id = auth.uid());
