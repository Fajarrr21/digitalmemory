-- ============================================================================
--  0001_init — schema for "A little place made for you"
--  Postgres / Supabase. Run in the SQL editor or via `supabase db push`.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---- updated_at trigger helper -------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---- profiles (1:1 with auth.users) --------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  display_name   text not null default 'friend',
  nickname       text,
  birthday       date,
  avatar_path    text,
  timezone       text not null default 'Asia/Jakarta',
  theme          text not null default 'system' check (theme in ('system','light','dark')),
  reduced_motion boolean not null default false,
  notif_prefs    jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), 'friend'))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---- spaces + members -----------------------------------------------------
create table public.spaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'our little universe',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_spaces_updated before update on public.spaces
  for each row execute function public.set_updated_at();

create table public.space_members (
  space_id   uuid not null references public.spaces(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null check (role in ('keeper','author')),
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);
create index idx_space_members_user on public.space_members(user_id);

-- Membership check used everywhere by RLS. SECURITY DEFINER so it can read
-- space_members without recursively triggering that table's own policies.
create or replace function public.is_member(p_space uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members m
    where m.space_id = p_space and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_role(p_space uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members m
    where m.space_id = p_space and m.user_id = auth.uid() and m.role = p_role
  );
$$;

-- ---- letter pool + daily letters -----------------------------------------
create table public.letter_pool (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references public.spaces(id) on delete cascade,
  category     text not null,
  title        text,
  body         text not null,
  content_hash text,
  author_id    uuid references public.profiles(id) on delete set null,
  used_on      date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_letter_pool_updated before update on public.letter_pool
  for each row execute function public.set_updated_at();
create index idx_letter_pool_available on public.letter_pool(space_id, category) where used_on is null;

create table public.daily_letters (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references public.spaces(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  letter_date  date not null,
  pool_id      uuid references public.letter_pool(id) on delete set null,
  category     text not null,
  title        text,
  body         text not null,
  status       text not null default 'sealed' check (status in ('sealed','opened')),
  opened_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- THE one-letter-per-day guarantee. Defeats race conditions at the DB level.
  constraint uq_letter_per_day unique (recipient_id, letter_date)
);
create trigger trg_daily_letters_updated before update on public.daily_letters
  for each row execute function public.set_updated_at();

-- ---- daily ratings --------------------------------------------------------
create table public.daily_ratings (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  rating_date date not null,
  score       int not null check (score between 1 and 10),
  mood        text,
  reason      text,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint uq_rating_per_day unique (user_id, rating_date)
);
create trigger trg_daily_ratings_updated before update on public.daily_ratings
  for each row execute function public.set_updated_at();

-- ---- daily activities -----------------------------------------------------
create table public.daily_activities (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references public.spaces(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  activity_date date not null,
  title         text not null,
  description   text,
  location      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_daily_activities_updated before update on public.daily_activities
  for each row execute function public.set_updated_at();
create index idx_activities_timeline on public.daily_activities(user_id, activity_date desc);

-- ---- our memories ---------------------------------------------------------
create table public.our_memories (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces(id) on delete cascade,
  title       text not null,
  description text,
  memory_date date,
  sort_order  int not null default 0,
  is_featured boolean not null default false,
  created_by  uuid not null references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_our_memories_updated before update on public.our_memories
  for each row execute function public.set_updated_at();
create index idx_our_memories_order on public.our_memories(space_id, sort_order);

-- ---- special messages ("For You") ----------------------------------------
create table public.special_messages (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references public.spaces(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  author_id    uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  body         text not null,
  unlock_type  text not null default 'always' check (unlock_type in ('always','date','streak','manual')),
  unlock_value jsonb not null default '{}'::jsonb,
  opened_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_special_messages_updated before update on public.special_messages
  for each row execute function public.set_updated_at();

-- ---- night reflections ----------------------------------------------------
create table public.night_reflections (
  id              uuid primary key default gen_random_uuid(),
  space_id        uuid not null references public.spaces(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  reflection_date date not null,
  q_today         text,
  q_smile         text,
  q_hard          text,
  q_release       text,
  q_grateful      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint uq_reflection_per_day unique (user_id, reflection_date)
);
create trigger trg_night_reflections_updated before update on public.night_reflections
  for each row execute function public.set_updated_at();

-- ---- tags -----------------------------------------------------------------
create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references public.spaces(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  constraint uq_tag_name unique (space_id, name)
);

create table public.activity_tags (
  activity_id uuid not null references public.daily_activities(id) on delete cascade,
  tag_id      uuid not null references public.tags(id) on delete cascade,
  primary key (activity_id, tag_id)
);

-- ---- media ----------------------------------------------------------------
create table public.media (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references public.spaces(id) on delete cascade,
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  type         text not null check (type in ('image','video')),
  storage_path text not null,
  mime         text not null,
  size_bytes   bigint not null,
  width        int,
  height       int,
  duration     numeric,
  alt_text     text,
  activity_id  uuid references public.daily_activities(id) on delete cascade,
  memory_id    uuid references public.our_memories(id) on delete cascade,
  message_id   uuid references public.special_messages(id) on delete cascade,
  created_at   timestamptz not null default now(),
  -- media attaches to exactly one parent
  constraint chk_media_one_parent check (
    (activity_id is not null)::int
    + (memory_id is not null)::int
    + (message_id is not null)::int = 1
  )
);
create index idx_media_activity on public.media(activity_id);
create index idx_media_memory on public.media(memory_id);
create index idx_media_message on public.media(message_id);
