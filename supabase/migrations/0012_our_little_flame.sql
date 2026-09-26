-- ============================================================================
--  0012 — Our Little Flame (presence streak)
--
--  "We both showed up today." A flame day = BOTH members opened the app on the
--  same calendar day (each in their own profile timezone). Presence is recorded
--  on any authenticated page view — no activity required, no forced logout.
--
--  presence_days     — one row per (member, local day). Insert-only.
--  flame_recoveries  — a "patch" over ONE missed day, restoring the streak
--                      across it. Max 5 per calendar month (enforced in the
--                      server action; the unique constraint stops double-
--                      patching a day). Either member may restore.
--
--  Streak math is computed on read from these two tables (lib/flame-logic.ts)
--  — no denormalised counters to drift. History is derived, never deleted.
-- ============================================================================

create table if not exists public.presence_days (
  space_id   uuid not null references public.spaces(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  day        date not null,
  created_at timestamptz not null default now(),
  primary key (space_id, user_id, day)
);

create index if not exists idx_presence_space_day
  on public.presence_days(space_id, day desc);

alter table public.presence_days enable row level security;

create policy presence_select on public.presence_days for select
  using (public.is_member(space_id));
create policy presence_insert on public.presence_days for insert
  with check (public.is_member(space_id) and user_id = auth.uid());
-- No update/delete: presence is a fact, not a setting.

create table if not exists public.flame_recoveries (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces(id) on delete cascade,
  day         date not null,
  restored_by uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint uq_recovery_per_day unique (space_id, day)
);

alter table public.flame_recoveries enable row level security;

create policy recoveries_select on public.flame_recoveries for select
  using (public.is_member(space_id));
create policy recoveries_insert on public.flame_recoveries for insert
  with check (public.is_member(space_id) and restored_by = auth.uid());
