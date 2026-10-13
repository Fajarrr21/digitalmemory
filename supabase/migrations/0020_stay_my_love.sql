-- ============================================================================
--  0020 — stay, my love. ♡
--
--  "You don't have to explain everything. You can just come here, get
--   comfortable, and let me leave a little love for you."
--
--  A small illustrated bedroom each of you has in the app. The room itself
--  (bed, blanket, teddy bear, lamp, window, the little character) is pure
--  client state — nothing about how you feel is ever asked or stored. What
--  persists is only what matters across visits:
--
--  stay_gifts — something one of you left in the OTHER's room: a handwritten
--               note, a voice recording (private Storage, key
--               {space}/{sender}/stay/…), a small object (flower / heart /
--               star / paper crane / moon charm, with an optional line), or a
--               comfort message that the room whispers at the end of "you can
--               rest here". Delivery + read timestamps; the recipient can put
--               a gift away into "the little box" (never deleted by them).
--  stay_rooms — each person's own room preferences (window scene, lamp,
--               whether the little character is shown, calmer motion, and
--               whether they've seen the opening). Owner-only.
--
--  This migration also RETIRES Little Care (0019): it was replaced by this
--  feature, so its tables and functions are dropped. Nothing in the app
--  reads them any more.
--
--  WRITES: gifts are inserted directly (RLS checks you only ever send AS
--  yourself, TO your partner, with audio inside your own folder). Everything
--  after delivery — opening, putting away, editing — goes through the
--  security-definer functions below, so the recipient can never rewrite your
--  words and you can never mark your own gift as read.
--
--  Realtime: the "I'm here" light rides a PRIVATE channel `stay:<space id>`
--  (presence = who is in their room right now, broadcast = a small heart).
--  Gated by the policy at the bottom, exactly like watch:<id> in 0016.
--
--  Idempotent — safe to re-run.
-- ============================================================================

-- ---- Retire Little Care (0019) ----------------------------------------------
drop function if exists public.care_create(uuid,text[],text,text,boolean,boolean,text[],boolean,text[],uuid);
drop function if exists public.care_open(uuid);
drop function if exists public.care_act(uuid,text,text,text,uuid);
drop function if exists public.care_answer(uuid,text);
drop function if exists public.care_after(uuid,text,boolean);
drop function if exists public.care_set_rest(uuid,boolean);
drop function if exists public.care_close(uuid,boolean);
drop function if exists public.care_set_kept(uuid,boolean);
drop function if exists public.care_tidy(uuid);
drop function if exists public.care_scrub(uuid);
drop table if exists public.care_actions cascade;
drop table if exists public.care_private cascade;
drop table if exists public.care_sessions cascade; -- also takes care_is_expired(care_sessions)
update public.profiles set notif_prefs = notif_prefs - 'care_whatsapp'
 where notif_prefs ? 'care_whatsapp';

-- ---- stay_gifts ---------------------------------------------------------------
create table if not exists public.stay_gifts (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references public.spaces(id) on delete cascade,
  sender_id     uuid not null references public.profiles(id) on delete cascade,
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  kind          text not null check (kind in ('note','voice','object','comfort')),
  object_kind   text check (object_kind in ('flower','heart','star','crane','moon')),
  body          text check (char_length(body) between 1 and 1000),
  audio_path    text,
  audio_mime    text,
  audio_seconds int check (audio_seconds between 1 and 300),
  opened_at     timestamptz,
  put_away_at   timestamptz,
  edited_at     timestamptz,
  notified_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint stay_not_self check (sender_id <> recipient_id),
  constraint stay_gift_shape check (
    (kind = 'note'    and body is not null and object_kind is null and audio_path is null) or
    (kind = 'comfort' and body is not null and char_length(body) <= 300
                      and object_kind is null and audio_path is null) or
    (kind = 'object'  and object_kind is not null and (body is null or char_length(body) <= 140)
                      and audio_path is null) or
    (kind = 'voice'   and audio_path is not null and audio_seconds is not null
                      and object_kind is null and (body is null or char_length(body) <= 140))
  )
);

create index if not exists idx_stay_gifts_recipient
  on public.stay_gifts(recipient_id, created_at desc);
create index if not exists idx_stay_gifts_sender
  on public.stay_gifts(sender_id, created_at desc);

drop trigger if exists trg_stay_gifts_updated on public.stay_gifts;
create trigger trg_stay_gifts_updated before update on public.stay_gifts
  for each row execute function public.set_updated_at();

alter table public.stay_gifts enable row level security;

drop policy if exists stay_gifts_select on public.stay_gifts;
create policy stay_gifts_select on public.stay_gifts for select
  using (public.is_member(space_id)
         and (sender_id = auth.uid() or recipient_id = auth.uid()));

-- Send only AS yourself, only TO the other member of your space, only fresh
-- (not pre-opened), and any audio must live in your own stay/ folder.
drop policy if exists stay_gifts_insert on public.stay_gifts;
create policy stay_gifts_insert on public.stay_gifts for insert
  with check (
    sender_id = auth.uid()
    and public.is_member(space_id)
    and recipient_id <> auth.uid()
    and exists (select 1 from public.space_members m
                 where m.space_id = stay_gifts.space_id and m.user_id = stay_gifts.recipient_id)
    and opened_at is null and put_away_at is null and edited_at is null and notified_at is null
    and (audio_path is null
         or audio_path like space_id::text || '/' || auth.uid()::text || '/stay/%')
  );

-- Only the sender may take a gift back (it disappears for both of you).
drop policy if exists stay_gifts_delete on public.stay_gifts;
create policy stay_gifts_delete on public.stay_gifts for delete
  using (sender_id = auth.uid());

-- A soft limit against clutter: at most 40 gifts on the table + in the box
-- for one person at a time. (The table itself only ever shows the newest few.)
create or replace function public.stay_gift_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.stay_gifts
       where recipient_id = new.recipient_id and space_id = new.space_id) >= 40 then
    raise exception 'stay_room_full' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_stay_gift_limit on public.stay_gifts;
create trigger trg_stay_gift_limit before insert on public.stay_gifts
  for each row execute function public.stay_gift_limit();

-- ---- After delivery: functions only ----------------------------------------

-- The recipient opened it. Only the first time counts.
create or replace function public.stay_open(p_gift uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.stay_gifts
     set opened_at = now()
   where id = p_gift and recipient_id = auth.uid() and opened_at is null;
end;
$$;

-- The recipient puts a gift away into the little box, or back on the table.
create or replace function public.stay_put_away(p_gift uuid, p_away boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  g public.stay_gifts;
begin
  select * into g from public.stay_gifts where id = p_gift for update;
  if not found or g.recipient_id is distinct from auth.uid() then
    raise exception 'stay_forbidden' using errcode = '42501';
  end if;
  update public.stay_gifts
     set put_away_at = case when p_away then coalesce(put_away_at, now()) end,
         opened_at = coalesce(opened_at, case when p_away then now() end)
   where id = g.id;
end;
$$;

-- The sender edits their words (note / comfort / an object's little line).
-- A voice recording is never edited — record a new one instead.
create or replace function public.stay_edit(p_gift uuid, p_body text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  g public.stay_gifts;
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
begin
  select * into g from public.stay_gifts where id = p_gift for update;
  if not found or g.sender_id is distinct from auth.uid() then
    raise exception 'stay_forbidden' using errcode = '42501';
  end if;
  if g.kind = 'voice' then
    raise exception 'stay_invalid' using errcode = '22023';
  end if;
  if g.kind in ('note','comfort') and v_body is null then
    raise exception 'stay_invalid' using errcode = '22023';
  end if;
  update public.stay_gifts set body = v_body, edited_at = now() where id = g.id;
end;
$$;

revoke all on function public.stay_open(uuid) from public, anon;
revoke all on function public.stay_put_away(uuid,boolean) from public, anon;
revoke all on function public.stay_edit(uuid,text) from public, anon;
grant execute on function public.stay_open(uuid) to authenticated;
grant execute on function public.stay_put_away(uuid,boolean) to authenticated;
grant execute on function public.stay_edit(uuid,text) to authenticated;

-- ---- stay_rooms (preferences) ----------------------------------------------
create table if not exists public.stay_rooms (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  space_id       uuid not null references public.spaces(id) on delete cascade,
  scene          text not null default 'rain' check (scene in ('rain','night','morning')),
  lamp           text not null default 'warm' check (lamp in ('warm','dim','window')),
  show_character boolean not null default true,
  calm_motion    boolean not null default false,
  intro_seen_at  timestamptz,
  updated_at     timestamptz not null default now()
);

drop trigger if exists trg_stay_rooms_updated on public.stay_rooms;
create trigger trg_stay_rooms_updated before update on public.stay_rooms
  for each row execute function public.set_updated_at();

alter table public.stay_rooms enable row level security;

drop policy if exists stay_rooms_own on public.stay_rooms;
create policy stay_rooms_own on public.stay_rooms for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_member(space_id));

-- ---- Realtime: the "I'm here" light ----------------------------------------
-- Join `stay:<space id>` only if you're a member of that space. Plain
-- statement on purpose (see the note in 0016): if it can't be applied, fail
-- loudly rather than quietly leaving the channel unguarded.
drop policy if exists stay_space_realtime on realtime.messages;
create policy stay_space_realtime on realtime.messages
  for all to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and realtime.topic() like 'stay:%'
    and exists (
      select 1 from public.spaces s
      where s.id::text = substring(realtime.topic() from 6)
        and public.is_member(s.id)
    )
  )
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and realtime.topic() like 'stay:%'
    and exists (
      select 1 from public.spaces s
      where s.id::text = substring(realtime.topic() from 6)
        and public.is_member(s.id)
    )
  );
