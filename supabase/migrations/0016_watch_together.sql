-- ============================================================================
--  0016 — Watch Together
--
--  "Bring something to watch. We'll watch it together."
--
--  One room, one watching, two people. The room row IS the invite token
--  (/watch/join/{id}): gen_random_uuid is unguessable and RLS restricts every
--  read to space members, so a leaked link shows an outsider nothing.
--
--  watch_rooms     — the room and, for controllable sources, the ONE canonical
--                    playback clock. Position is stored as (position_seconds,
--                    position_at): "we were at 12:43 as of this instant". Any
--                    client derives where we should be now from that pair, so
--                    a late joiner or a reconnect lands in the right second
--                    without anyone re-broadcasting. Both members may write it
--                    — either of you can pause, and the other follows.
--  watch_messages  — Little Chat. Persisted (not just broadcast) so a reload
--                    keeps the conversation and the memory can count it.
--  watch_reactions — the floating hearts. Broadcast for the instant animation;
--                    a row per tap so the memory's count is real, not guessed.
--  watch_memories  — "That's a wrap." What we watched, for how long, and the
--                    line one of you wrote about it afterwards.
--
--  Voice is never recorded and never touches the database: it is a
--  peer-to-peer WebRTC call signalled over the room's Realtime channel.
--
--  Rooms expire: one never joined within 24h is treated as closed (checked in
--  the server actions — no cron needed). Finished rooms keep their memory.
--
--  Idempotent — safe to re-run after a partial apply.
-- ============================================================================

create table if not exists public.watch_rooms (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces(id) on delete cascade,
  host_id     uuid not null references public.profiles(id) on delete cascade,
  guest_id    uuid references public.profiles(id) on delete set null,
  status      text not null default 'waiting'
              check (status in ('waiting', 'ready', 'watching', 'ended')),

  -- How the thing plays inside the room:
  --   youtube — the IFrame Player API: we can play/pause/seek it, so playback
  --             is genuinely synchronised.
  --   file    — a direct video file in a <video> element: same, fully synced.
  --   embed   — someone else's page in an iframe. It plays here, but we cannot
  --             reach inside it, so the room counts you in and keeps you
  --             together by hand instead of pretending to control it.
  source_kind text not null check (source_kind in ('youtube', 'file', 'embed')),
  source_url  text not null check (char_length(source_url) between 4 and 2000),
  video_id    text,                                  -- YouTube id, when known
  title       text not null check (char_length(title) between 1 and 200),
  subtitle    text check (char_length(subtitle) <= 200),   -- "Episode 12"
  poster_url  text,

  -- The shared clock. Meaningless for 'embed' sources; harmless there too.
  is_playing       boolean not null default false,
  position_seconds numeric not null default 0 check (position_seconds >= 0),
  position_at      timestamptz not null default now(),
  duration_seconds numeric,
  updated_by       uuid references public.profiles(id) on delete set null,

  started_at  timestamptz,
  ended_at    timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '24 hours'
);

create index if not exists idx_watch_rooms_space
  on public.watch_rooms(space_id, created_at desc);
-- The landing page's "is anything on right now?" lookup.
create index if not exists idx_watch_rooms_live
  on public.watch_rooms(space_id, status)
  where status <> 'ended';

drop trigger if exists trg_watch_rooms_updated on public.watch_rooms;
create trigger trg_watch_rooms_updated before update on public.watch_rooms
  for each row execute function public.set_updated_at();

alter table public.watch_rooms enable row level security;

drop policy if exists watch_rooms_select on public.watch_rooms;
create policy watch_rooms_select on public.watch_rooms for select
  using (public.is_member(space_id));
drop policy if exists watch_rooms_insert on public.watch_rooms;
create policy watch_rooms_insert on public.watch_rooms for insert
  with check (public.is_member(space_id) and host_id = auth.uid());
-- Both of you drive the room: join, ready up, play, pause, seek, end.
drop policy if exists watch_rooms_update on public.watch_rooms;
create policy watch_rooms_update on public.watch_rooms for update
  using (public.is_member(space_id)) with check (public.is_member(space_id));
drop policy if exists watch_rooms_delete on public.watch_rooms;
create policy watch_rooms_delete on public.watch_rooms for delete
  using (public.is_member(space_id));

-- ---- Little Chat -----------------------------------------------------------

create table if not exists public.watch_messages (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.watch_rooms(id) on delete cascade,
  space_id   uuid not null references public.spaces(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  reply_to   uuid references public.watch_messages(id) on delete set null,
  -- Where in the video this was said, so a reaction keeps its moment.
  at_seconds numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_watch_messages_room
  on public.watch_messages(room_id, created_at);

alter table public.watch_messages enable row level security;

drop policy if exists watch_messages_select on public.watch_messages;
create policy watch_messages_select on public.watch_messages for select
  using (public.is_member(space_id));
drop policy if exists watch_messages_insert on public.watch_messages;
create policy watch_messages_insert on public.watch_messages for insert
  with check (public.is_member(space_id) and user_id = auth.uid());
drop policy if exists watch_messages_delete on public.watch_messages;
create policy watch_messages_delete on public.watch_messages for delete
  using (user_id = auth.uid());

-- ---- Reactions -------------------------------------------------------------

create table if not exists public.watch_reactions (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.watch_rooms(id) on delete cascade,
  space_id   uuid not null references public.spaces(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 16),
  at_seconds numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_watch_reactions_room
  on public.watch_reactions(room_id, created_at);

alter table public.watch_reactions enable row level security;

drop policy if exists watch_reactions_select on public.watch_reactions;
create policy watch_reactions_select on public.watch_reactions for select
  using (public.is_member(space_id));
drop policy if exists watch_reactions_insert on public.watch_reactions;
create policy watch_reactions_insert on public.watch_reactions for insert
  with check (public.is_member(space_id) and user_id = auth.uid());

-- ---- "That's a wrap." ------------------------------------------------------

create table if not exists public.watch_memories (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references public.spaces(id) on delete cascade,
  -- Kept as a memory even if the room row is ever cleaned away.
  room_id        uuid references public.watch_rooms(id) on delete set null,
  created_by     uuid not null references public.profiles(id) on delete cascade,
  title          text not null check (char_length(title) between 1 and 200),
  subtitle       text check (char_length(subtitle) <= 200),
  source_kind    text not null check (source_kind in ('youtube', 'file', 'embed')),
  source_url     text,
  poster_url     text,
  watched_date   date not null,
  minutes        int not null default 0 check (minutes >= 0),
  message_count  int not null default 0 check (message_count >= 0),
  reaction_count int not null default 0 check (reaction_count >= 0),
  note           text check (char_length(note) <= 2000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- One memory per room: saving twice edits the same wrap card.
  constraint uq_watch_memory_per_room unique (room_id)
);

create index if not exists idx_watch_memories_space
  on public.watch_memories(space_id, watched_date desc, created_at desc);

drop trigger if exists trg_watch_memories_updated on public.watch_memories;
create trigger trg_watch_memories_updated before update on public.watch_memories
  for each row execute function public.set_updated_at();

alter table public.watch_memories enable row level security;

drop policy if exists watch_memories_select on public.watch_memories;
create policy watch_memories_select on public.watch_memories for select
  using (public.is_member(space_id));
drop policy if exists watch_memories_insert on public.watch_memories;
create policy watch_memories_insert on public.watch_memories for insert
  with check (public.is_member(space_id) and created_by = auth.uid());
-- Either of you may add or change the line underneath it.
drop policy if exists watch_memories_update on public.watch_memories;
create policy watch_memories_update on public.watch_memories for update
  using (public.is_member(space_id)) with check (public.is_member(space_id));
drop policy if exists watch_memories_delete on public.watch_memories;
create policy watch_memories_delete on public.watch_memories for delete
  using (public.is_member(space_id));

-- ---- Realtime channel authorisation ----------------------------------------
--
--  A room's fast path (pause, seek, chat, reactions, the voice handshake) rides
--  a Realtime channel named `watch:<room id>`. The id is unguessable, but that
--  alone shouldn't be what keeps a conversation private — so the channel is
--  opened as a PRIVATE one and this policy is the gate: you may join
--  `watch:<id>` only if you are a member of that room's space, exactly like
--  every table above.
--
--  NOTE: with this policy in place, `realtime.messages` is deny-by-default for
--  everything else. Any future feature that wants a Realtime channel needs its
--  own policy here.
--
--  Deliberately NOT wrapped in an exception handler: an earlier version of
--  this migration swallowed the failure and reported success, which quietly
--  turned a privacy boundary off. If this can't be applied, the migration
--  should fail loudly so somebody decides on purpose. (At runtime the client
--  still falls back to a public channel on the unguessable topic rather than
--  breaking a room — see use-room-channel.ts.)
--
--  Verified by step 8 of scripts/test-watch.mjs, which actually joins the
--  channel as each member instead of trusting that the policy exists.
drop policy if exists watch_rooms_realtime on realtime.messages;
create policy watch_rooms_realtime on realtime.messages
  for all to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and realtime.topic() like 'watch:%'
    and exists (
      select 1 from public.watch_rooms r
      -- Text comparison, not a uuid cast: a malformed topic must simply fail
      -- to match, never raise.
      where r.id::text = substring(realtime.topic() from 7)
        and public.is_member(r.space_id)
    )
  )
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and realtime.topic() like 'watch:%'
    and exists (
      select 1 from public.watch_rooms r
      where r.id::text = substring(realtime.topic() from 7)
        and public.is_member(r.space_id)
    )
  );
