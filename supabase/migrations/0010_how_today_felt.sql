-- ============================================================================
--  0010 — How Today Felt (daily coloring)
--  An extension of "Rating Hari Ini": after saving the day's rating, the user
--  may optionally colour a random line-art scene to express how the day *felt*.
--  The artwork is stored as vector data (which template + a region→colour map),
--  not an uploaded image — so it stays crisp, editable, and needs no Storage.
--
--  One coloring per rating (rating_id is unique). Owned by the rating's author;
--  the partner may see it (is_member) but only the owner may write it, mirroring
--  daily_ratings. WhatsApp is intentionally NOT touched here — colouring never
--  sends a notification (the rating save already did that).
-- ============================================================================

create table if not exists public.daily_coloring (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  rating_id   uuid not null references public.daily_ratings(id) on delete cascade,
  template_id text not null,
  fills       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint uq_coloring_per_rating unique (rating_id)
);

create index if not exists idx_daily_coloring_rating on public.daily_coloring(rating_id);
create index if not exists idx_daily_coloring_space on public.daily_coloring(space_id);

create trigger trg_daily_coloring_updated before update on public.daily_coloring
  for each row execute function public.set_updated_at();

-- ---- RLS: members read, owner writes (mirrors daily_ratings) ---------------
alter table public.daily_coloring enable row level security;

create policy daily_coloring_select on public.daily_coloring for select
  using (public.is_member(space_id));
create policy daily_coloring_insert on public.daily_coloring for insert
  with check (public.is_member(space_id) and user_id = auth.uid());
create policy daily_coloring_update on public.daily_coloring for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy daily_coloring_delete on public.daily_coloring for delete
  using (user_id = auth.uid());
