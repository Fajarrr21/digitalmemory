-- ============================================================================
--  0029 — Roll the Love Dice
--  "A little roll, a little surprise, a little more about us."
--
--  A two-player turn game: roll → category → challenge card → done/skip →
--  the turn passes. No score, no winner.
--
--  Write model (like the quiz): every change to a game goes through trusted
--  server actions on the admin client, which check membership + whose turn it
--  is, and use `version` as an optimistic lock so a double tap or two screens
--  can never apply the same move twice. RLS below is defence in depth: members
--  may read their own space's game rows, nothing about a game is
--  client-writable.
--
--  Custom challenges + memories are plain RLS (members, author-only writes).
--  A SECRET custom challenge is invisible to the partner until the dice deals
--  it to them (the server copies its text onto the game when drawn).
-- ============================================================================

create table if not exists public.dice_games (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces(id) on delete cascade,
  created_by  uuid not null references public.profiles(id) on delete cascade,
  mode        text not null default 'soft' check (mode in ('soft','romantic','deep','chaos')),
  status      text not null default 'lobby' check (status in ('lobby','playing','ended')),
  turn_user   uuid references public.profiles(id) on delete set null,
  -- the open roll: { id, face, category, wild, cards:[{key,text,kind,by?,secret?}], partnerAnswer?, rolledAt }
  current     jsonb,
  -- challenge keys already dealt this game (repeats only once a pool runs dry)
  seen        jsonb not null default '[]'::jsonb,
  version     integer not null default 0,
  done_count  integer not null default 0,
  skip_count  integer not null default 0,
  created_at  timestamptz not null default now(),
  started_at  timestamptz,
  ended_at    timestamptz
);

-- one live game per space
create unique index if not exists uq_dice_live_per_space
  on public.dice_games(space_id) where status in ('lobby','playing');
create index if not exists idx_dice_games_space on public.dice_games(space_id, created_at desc);

-- lobby presence: who joined, who is ready, who was here a moment ago
create table if not exists public.dice_players (
  game_id   uuid not null references public.dice_games(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  ready_at  timestamptz,
  seen_at   timestamptz not null default now(),
  primary key (game_id, user_id)
);

-- every finished turn (done / skipped) — the game's history + stats
create table if not exists public.dice_turns (
  id             uuid primary key default gen_random_uuid(),
  game_id        uuid not null references public.dice_games(id) on delete cascade,
  space_id       uuid not null references public.spaces(id) on delete cascade,
  player_id      uuid not null references public.profiles(id) on delete cascade,
  face           smallint check (face between 1 and 6),
  category       text not null,
  wild           text,
  cards          jsonb not null default '[]'::jsonb,
  answer         text check (char_length(answer) <= 2000),
  partner_answer text check (char_length(partner_answer) <= 2000),
  status         text not null check (status in ('done','skipped')),
  created_at     timestamptz not null default now()
);
create index if not exists idx_dice_turns_game on public.dice_turns(game_id, created_at desc);
create index if not exists idx_dice_turns_space on public.dice_turns(space_id);

create table if not exists public.dice_custom (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  category    text not null check (category in ('sweet','deep','childhood','confession','mini','future')),
  modes       text[] not null default '{soft,romantic,deep,chaos}',
  kind        text not null default 'a' check (kind in ('a','x')),
  text        text not null check (char_length(text) between 3 and 300),
  secret      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_dice_custom_space on public.dice_custom(space_id);

-- Our Dice Memories
create table if not exists public.dice_memories (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references public.spaces(id) on delete cascade,
  turn_id        uuid references public.dice_turns(id) on delete set null,
  game_id        uuid references public.dice_games(id) on delete set null,
  saved_by       uuid not null references public.profiles(id) on delete cascade,
  player_id      uuid references public.profiles(id) on delete set null,
  category       text not null,
  challenge      text not null,
  answer         text,
  partner_answer text,
  note           text check (char_length(note) <= 1000),
  favorite       boolean not null default false,
  played_at      timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
-- pressing Save twice (or both of us) keeps one memory per turn (NULLs stay distinct)
create unique index if not exists uq_dice_memory_per_turn on public.dice_memories(turn_id);
create index if not exists idx_dice_memories_space on public.dice_memories(space_id, played_at desc);

alter table public.dice_games    enable row level security;
alter table public.dice_players  enable row level security;
alter table public.dice_turns    enable row level security;
alter table public.dice_custom   enable row level security;
alter table public.dice_memories enable row level security;

create policy dice_games_select on public.dice_games for select using (public.is_member(space_id));
create policy dice_players_select on public.dice_players for select
  using (exists (select 1 from public.dice_games g where g.id = game_id and public.is_member(g.space_id)));
create policy dice_turns_select on public.dice_turns for select using (public.is_member(space_id));

-- custom: I see mine; my partner sees mine only when they're not secret
create policy dice_custom_select on public.dice_custom for select
  using (author_id = auth.uid() or (public.is_member(space_id) and not secret));
create policy dice_custom_insert on public.dice_custom for insert
  with check (author_id = auth.uid() and public.is_member(space_id));
create policy dice_custom_update on public.dice_custom for update
  using (author_id = auth.uid()) with check (author_id = auth.uid() and public.is_member(space_id));
create policy dice_custom_delete on public.dice_custom for delete using (author_id = auth.uid());

-- memories belong to both of us: either may read, note, favourite, delete
create policy dice_memories_select on public.dice_memories for select using (public.is_member(space_id));
create policy dice_memories_insert on public.dice_memories for insert
  with check (saved_by = auth.uid() and public.is_member(space_id));
create policy dice_memories_update on public.dice_memories for update
  using (public.is_member(space_id)) with check (public.is_member(space_id));
create policy dice_memories_delete on public.dice_memories for delete using (public.is_member(space_id));
