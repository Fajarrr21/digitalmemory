-- ============================================================================
--  0027 — Seberapa Kenal Kita? (couple quiz)
--
--  A game = one round of 25 questions, both members answer about themselves
--  (a "sheet": answer + 3 decoys per question), then guess each other.
--
--  Secrecy model: the real answers and which option is correct must never
--  reach the partner before a round is revealed. So sheets/picks are read and
--  written ONLY by trusted server actions (admin client) that filter what each
--  person may see. RLS below is defence in depth: owners may read their own
--  sheet, members may read the game row, nothing else is client-reachable.
-- ============================================================================

create table if not exists public.quiz_games (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references public.spaces(id) on delete cascade,
  created_by   uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'preparing'
               check (status in ('preparing','playing','completed','cancelled')),
  tone         text not null default 'playful' check (tone in ('sweet','playful','savage')),
  -- number of fully answered rounds (0..25); round N is open while round = N
  round        smallint not null default 0 check (round between 0 and 25),
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  completed_at timestamptz
);

-- one live game per space
create unique index if not exists uq_quiz_live_per_space
  on public.quiz_games(space_id) where status in ('preparing','playing');
create index if not exists idx_quiz_games_space on public.quiz_games(space_id, created_at desc);

create table if not exists public.quiz_sheets (
  game_id    uuid not null references public.quiz_games(id) on delete cascade,
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  -- [{ a: answer, d: [decoy, decoy, decoy] }] × 25
  answers    jsonb not null default '[]'::jsonb,
  -- set at lock: 25 permutations of [0,1,2,3]; 0 = the real answer, k = d[k-1]
  option_order jsonb,
  locked_at  timestamptz,
  updated_at timestamptz not null default now(),
  primary key (game_id, owner_id)
);

create table if not exists public.quiz_picks (
  game_id    uuid not null references public.quiz_games(id) on delete cascade,
  guesser_id uuid not null references public.profiles(id) on delete cascade,
  idx        smallint not null check (idx between 0 and 24),
  choice     smallint not null check (choice between 0 and 3),
  correct    boolean not null,
  created_at timestamptz not null default now(),
  primary key (game_id, guesser_id, idx)
);

alter table public.quiz_games  enable row level security;
alter table public.quiz_sheets enable row level security;
alter table public.quiz_picks  enable row level security;

create policy quiz_games_select on public.quiz_games for select
  using (public.is_member(space_id));
create policy quiz_sheets_select_own on public.quiz_sheets for select
  using (owner_id = auth.uid());
-- quiz_picks: no client policies at all (revealed only through the server).
