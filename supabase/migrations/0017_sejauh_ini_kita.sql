-- ============================================================================
--  0017 — Sejauh Ini, Kita (a story of how two people became "us")
--
--  The journey itself is DERIVED: every footprint on the road (letters,
--  memories, photobooth, watch sessions, flame milestones, …) is read from the
--  tables that already own it. Nothing is copied here, so the road grows by
--  itself whenever either of you lives a little inside the app.
--
--  Only the two things that exist nowhere else get a table:
--
--  1. journey_notes — "I was here." A Presence Note left at one stop of the
--     journey (a chapter). Not a letter, not a chat: just a mark that says
--     "aku pernah berhenti di sini". The partner finds it when they reach that
--     stop. Never notifies.
--
--  2. journey_knowings — "Things I Know About You." What one of you has learned
--     about the other along the way (♡ likes, ☕ comfort, 🌙 when sad, …).
--     Always written BY you ABOUT your partner.
--
--  RLS: both members read both tables; you only ever write AS yourself.
-- ============================================================================

-- ---- Presence notes ---------------------------------------------------------
create table if not exists public.journey_notes (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references public.spaces(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  -- Which stop of the journey this was left at (matches journey-config.ts).
  stop       text not null check (stop in
               ('beginning','along','little','hard','far','learned','now','ahead')),
  body       text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);

create index if not exists idx_journey_notes_space
  on public.journey_notes(space_id, stop, created_at);

alter table public.journey_notes enable row level security;

drop policy if exists journey_notes_select on public.journey_notes;
create policy journey_notes_select on public.journey_notes for select
  using (public.is_member(space_id));
drop policy if exists journey_notes_insert on public.journey_notes;
create policy journey_notes_insert on public.journey_notes for insert
  with check (public.is_member(space_id) and author_id = auth.uid());
drop policy if exists journey_notes_delete on public.journey_notes;
create policy journey_notes_delete on public.journey_notes for delete
  using (author_id = auth.uid());

-- ---- Things I know about you ------------------------------------------------
create table if not exists public.journey_knowings (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references public.spaces(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  about_id   uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 16),
  label      text not null check (char_length(label) between 1 and 40),
  body       text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (author_id <> about_id)
);

create index if not exists idx_journey_knowings_space
  on public.journey_knowings(space_id, about_id, created_at);

drop trigger if exists trg_journey_knowings_updated on public.journey_knowings;
create trigger trg_journey_knowings_updated before update on public.journey_knowings
  for each row execute function public.set_updated_at();

alter table public.journey_knowings enable row level security;

drop policy if exists journey_knowings_select on public.journey_knowings;
create policy journey_knowings_select on public.journey_knowings for select
  using (public.is_member(space_id));
-- You write about your partner — the other member of the same space — as you.
drop policy if exists journey_knowings_insert on public.journey_knowings;
create policy journey_knowings_insert on public.journey_knowings for insert
  with check (
    public.is_member(space_id)
    and author_id = auth.uid()
    and about_id <> auth.uid()
    and exists (
      select 1 from public.space_members m
      where m.space_id = journey_knowings.space_id and m.user_id = journey_knowings.about_id
    )
  );
drop policy if exists journey_knowings_update on public.journey_knowings;
create policy journey_knowings_update on public.journey_knowings for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists journey_knowings_delete on public.journey_knowings;
create policy journey_knowings_delete on public.journey_knowings for delete
  using (author_id = auth.uid());
