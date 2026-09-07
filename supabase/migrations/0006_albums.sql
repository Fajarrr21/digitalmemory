-- ============================================================================
--  0006 — shared albums
--  A space can hold many named albums (e.g. "Bali", "Anniversary"). BOTH members
--  can create albums and add photos/videos; both can delete anything (deletion
--  of others' files is done server-side via the admin client). Media gains an
--  album_id parent alongside the existing ones.
-- ============================================================================

create table public.albums (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references public.spaces(id) on delete cascade,
  title      text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_albums_updated before update on public.albums
  for each row execute function public.set_updated_at();
create index idx_albums_space on public.albums(space_id, created_at desc);

alter table public.albums enable row level security;

-- Both members may read and manage albums (create / rename / delete).
create policy albums_select on public.albums for select
  using (public.is_member(space_id));
create policy albums_write on public.albums for all
  using (public.is_member(space_id))
  with check (public.is_member(space_id));

-- ---- media can belong to an album -----------------------------------------
alter table public.media
  add column if not exists album_id uuid references public.albums(id) on delete cascade;

alter table public.media drop constraint if exists chk_media_one_parent;
alter table public.media add constraint chk_media_one_parent check (
  (activity_id is not null)::int
  + (memory_id is not null)::int
  + (message_id is not null)::int
  + (rating_id is not null)::int
  + (album_id is not null)::int = 1
);

create index if not exists idx_media_album on public.media(album_id);
