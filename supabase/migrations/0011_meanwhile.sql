-- ============================================================================
--  0011 — Meanwhile… (away status + little moments)
--
--  "Meanwhile" is a small space to visit while the other person is busy living
--  their own life. Two pieces of state:
--
--  1. away_status — a MANUAL "I'm away" flag per member (working / playing /
--     outside / sleeping / busy). No live tracking, ever: it only gives the
--     partner context ("Fajar is working right now. Meanwhile…").
--
--  2. meanwhile_moments — the archive. One row per kept Moment (a tiny answer,
--     a pick, a photo, a song, a small creation, a silly choice). Private by
--     default; `shared` = true makes it visible to the partner (manual only —
--     nothing auto-shares, nothing notifies).
-- ============================================================================

-- ---- Away status ------------------------------------------------------------
create table if not exists public.away_status (
  space_id   uuid not null references public.spaces(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('working','playing','outside','sleeping','busy')),
  active     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create trigger trg_away_status_updated before update on public.away_status
  for each row execute function public.set_updated_at();

alter table public.away_status enable row level security;

create policy away_status_select on public.away_status for select
  using (public.is_member(space_id));
create policy away_status_insert on public.away_status for insert
  with check (public.is_member(space_id) and user_id = auth.uid());
create policy away_status_update on public.away_status for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy away_status_delete on public.away_status for delete
  using (user_id = auth.uid());

-- ---- Meanwhile moments (the archive) ----------------------------------------
create table if not exists public.meanwhile_moments (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  category    text not null check (category in ('question','pick','photo','song','creation','silly')),
  prompt      text not null,
  -- Shape depends on category:
  --   question → { answer }            pick/silly → { choice, emoji?, rating? }
  --   photo    → { path, mime }        song       → { trackId, title, image }
  --   creation → { templateId, fills }
  payload     jsonb not null default '{}'::jsonb,
  shared      boolean not null default false,
  moment_date date not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_meanwhile_space_date
  on public.meanwhile_moments(space_id, moment_date desc, created_at desc);
create index if not exists idx_meanwhile_user
  on public.meanwhile_moments(user_id);

alter table public.meanwhile_moments enable row level security;

-- Owner sees everything of their own; the partner only sees shared moments.
create policy meanwhile_select on public.meanwhile_moments for select
  using (user_id = auth.uid() or (public.is_member(space_id) and shared));
create policy meanwhile_insert on public.meanwhile_moments for insert
  with check (public.is_member(space_id) and user_id = auth.uid());
create policy meanwhile_update on public.meanwhile_moments for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy meanwhile_delete on public.meanwhile_moments for delete
  using (user_id = auth.uid());
