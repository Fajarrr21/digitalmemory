-- ============================================================================
--  0018 — If I Could Hold Your Feelings ("Hold")
--
--  "Kamu nggak harus baik-baik saja untuk tetap disayang."
--
--  One member lets the other know what they're carrying and what kind of
--  support they need; the other answers with a small, symbolic gesture.
--  Either of you can start one — it's never one person's job to be the carer.
--
--  hold_sessions — the session. Holds ONLY what the sender chose to share:
--                  the feeling, the need, the timing, and (if shared) the
--                  intensity and a few words of context.
--  hold_private  — what the sender kept for themselves (private context,
--                  private intensity). A separate table on purpose: RLS is
--                  row-level, so a column on hold_sessions could never be
--                  hidden from the partner. Here only the owner can read it.
--  hold_replies  — one support gesture per round from the recipient
--                  (stay / warmth / listening / space), and the sender's
--                  optional follow-up when they ask for "a little longer".
--
--  WRITES: there are deliberately NO insert/update policies for these tables.
--  Every change goes through the security-definer functions below, which lock
--  the row, check who you are (sender vs recipient) and which state the
--  session is in. So a client can never skip a transition, reopen a closed
--  session, answer twice, or write as the other person. Reads are RLS.
--
--  Retention: a session nobody chose to keep is scrubbed of its personal
--  words the moment it ends, and the empty shell is deleted 7 days later
--  (hold_tidy, called lazily when either of you opens /hold — no cron).
--  Expiry: an unanswered session quietly expires 3 days after it was sent
--  (or after "stay a little longer"). Never a countdown on screen.
--
--  Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.hold_sessions (
  id               uuid primary key default gen_random_uuid(),
  space_id         uuid not null references public.spaces(id) on delete cascade,
  sender_id        uuid not null references public.profiles(id) on delete cascade,
  recipient_id     uuid not null references public.profiles(id) on delete cascade,
  feeling          text not null check (feeling in
                     ('overwhelmed','alone','tired','racing','miss_you','comfort')),
  need             text not null check (need in ('stay','loved','space','vent')),
  timing           text not null check (timing in ('whenever','soon')),
  -- Only present when the sender explicitly chose to share them.
  shared_intensity smallint check (shared_intensity between 1 and 4),
  shared_context   text check (char_length(shared_context) between 1 and 600),
  status           text not null default 'pending' check (status in
                     ('pending','opened','responded','continued','closed','expired')),
  round            smallint not null default 1 check (round between 1 and 20),
  -- How the sender felt after the support ('longer' keeps it going).
  after_choice     text check (after_choice in ('less_alone','longer','quiet')),
  -- Past Holds: kept only when the sender says so.
  kept             boolean not null default false,
  -- Retry-safe creation: the same client_key always maps to the same session.
  client_key       uuid not null,
  notified_at      timestamptz,
  opened_at        timestamptz,
  responded_at     timestamptz,
  closed_at        timestamptz,
  expires_at       timestamptz not null default now() + interval '3 days',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint hold_not_self check (sender_id <> recipient_id),
  constraint uq_hold_client_key unique (sender_id, client_key)
);

create index if not exists idx_hold_space_created
  on public.hold_sessions(space_id, created_at desc);
create index if not exists idx_hold_recipient_status
  on public.hold_sessions(recipient_id, status);
create index if not exists idx_hold_sender_status
  on public.hold_sessions(sender_id, status);

drop trigger if exists trg_hold_sessions_updated on public.hold_sessions;
create trigger trg_hold_sessions_updated before update on public.hold_sessions
  for each row execute function public.set_updated_at();

create table if not exists public.hold_private (
  session_id uuid primary key references public.hold_sessions(id) on delete cascade,
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  intensity  smallint check (intensity between 1 and 4),
  context    text check (char_length(context) between 1 and 600),
  created_at timestamptz not null default now()
);

create table if not exists public.hold_replies (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.hold_sessions(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  round       smallint not null,
  -- support = the recipient's gesture; followup = the sender's "a little longer".
  kind        text not null check (kind in ('support','followup')),
  action      text check (action in ('stay','warmth','listening','space')),
  gesture     text check (gesture in ('wrap','glow','hand')),
  message     text check (char_length(message) between 1 and 500),
  client_key  uuid not null,
  created_at  timestamptz not null default now(),
  constraint hold_reply_shape check (
    (kind = 'support' and action is not null) or (kind = 'followup' and action is null)
  ),
  -- One gesture per round, one follow-up per round: a double tap can't stack.
  constraint uq_hold_reply_round unique (session_id, round, kind),
  constraint uq_hold_reply_client_key unique (author_id, client_key)
);

create index if not exists idx_hold_replies_session
  on public.hold_replies(session_id, round, created_at);

-- ---- RLS: reads only ------------------------------------------------------

alter table public.hold_sessions enable row level security;
alter table public.hold_private  enable row level security;
alter table public.hold_replies  enable row level security;

drop policy if exists hold_sessions_select on public.hold_sessions;
create policy hold_sessions_select on public.hold_sessions for select
  using (public.is_member(space_id)
         and (sender_id = auth.uid() or recipient_id = auth.uid()));
-- The sender may let a session go entirely (it disappears for both of you).
drop policy if exists hold_sessions_delete on public.hold_sessions;
create policy hold_sessions_delete on public.hold_sessions for delete
  using (sender_id = auth.uid());

drop policy if exists hold_private_select on public.hold_private;
create policy hold_private_select on public.hold_private for select
  using (owner_id = auth.uid());
drop policy if exists hold_private_delete on public.hold_private;
create policy hold_private_delete on public.hold_private for delete
  using (owner_id = auth.uid());

drop policy if exists hold_replies_select on public.hold_replies;
create policy hold_replies_select on public.hold_replies for select
  using (exists (
    select 1 from public.hold_sessions s
    where s.id = hold_replies.session_id
      and (s.sender_id = auth.uid() or s.recipient_id = auth.uid())
  ));

-- ---- Helpers ----------------------------------------------------------------

-- A live session past its quiet window counts as expired.
create or replace function public.hold_is_expired(s public.hold_sessions)
returns boolean language sql stable as $$
  select s.status in ('pending','opened','continued') and s.expires_at <= now();
$$;

-- Words go, shape stays: used when a session ends without being kept.
create or replace function public.hold_scrub(p_session uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.hold_private where session_id = p_session;
  update public.hold_sessions set shared_context = null where id = p_session;
  update public.hold_replies  set message = null where session_id = p_session;
$$;
revoke all on function public.hold_scrub(uuid) from public, anon, authenticated;

-- ---- hold_create ------------------------------------------------------------
-- Returns { id, created }. A retry with the same client_key returns the same
-- session with created=false. While you already have one session open, a new
-- one is refused with 'hold_active_exists' (and its id in the DETAIL).
create or replace function public.hold_create(
  p_space uuid,
  p_feeling text,
  p_intensity int,
  p_share_intensity boolean,
  p_need text,
  p_context text,
  p_share_context boolean,
  p_timing text,
  p_client_key uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_recipient uuid;
  v_existing public.hold_sessions;
  v_id uuid;
  v_context text := nullif(btrim(coalesce(p_context, '')), '');
begin
  if v_uid is null or not public.is_member(p_space) then
    raise exception 'hold_forbidden' using errcode = '42501';
  end if;
  if p_intensity is not null and (p_intensity < 1 or p_intensity > 4) then
    raise exception 'hold_invalid' using errcode = '22023';
  end if;

  -- Serialise this sender's creations so two tabs can't both open one.
  perform pg_advisory_xact_lock(hashtextextended('hold:' || v_uid::text, 0));

  select * into v_existing from public.hold_sessions
   where sender_id = v_uid and client_key = p_client_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'created', false);
  end if;

  select * into v_existing from public.hold_sessions
   where sender_id = v_uid and space_id = p_space
     and status in ('pending','opened','responded','continued')
     and not public.hold_is_expired(hold_sessions)
   order by created_at desc limit 1;
  if found then
    raise exception 'hold_active_exists' using errcode = 'P0001', detail = v_existing.id::text;
  end if;

  select user_id into v_recipient from public.space_members
   where space_id = p_space and user_id <> v_uid limit 1;
  if v_recipient is null then
    raise exception 'hold_no_partner' using errcode = 'P0001';
  end if;

  insert into public.hold_sessions
    (space_id, sender_id, recipient_id, feeling, need, timing,
     shared_intensity, shared_context, client_key)
  values
    (p_space, v_uid, v_recipient, p_feeling, p_need, p_timing,
     case when p_share_intensity then p_intensity end,
     case when p_share_context then v_context end,
     p_client_key)
  returning id into v_id;

  if (p_intensity is not null and not coalesce(p_share_intensity, false))
     or (v_context is not null and not coalesce(p_share_context, false)) then
    insert into public.hold_private (session_id, owner_id, intensity, context)
    values (
      v_id, v_uid,
      case when not coalesce(p_share_intensity, false) then p_intensity end,
      case when not coalesce(p_share_context, false) then v_context end
    );
  end if;

  return jsonb_build_object('id', v_id, 'created', true);
end;
$$;

-- ---- hold_open --------------------------------------------------------------
-- The recipient arrived. pending → opened; anything else is a quiet no-op.
create or replace function public.hold_open(p_session uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.hold_sessions s
     set status = 'opened', opened_at = now()
   where s.id = p_session and s.recipient_id = auth.uid()
     and s.status = 'pending' and not public.hold_is_expired(s);
end;
$$;

-- ---- hold_respond -----------------------------------------------------------
-- The recipient's gesture for the current round. Returns { id, duplicate }.
create or replace function public.hold_respond(
  p_session uuid,
  p_action text,
  p_gesture text,
  p_message text,
  p_client_key uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  s public.hold_sessions;
  v_reply public.hold_replies;
  v_id uuid;
begin
  select * into s from public.hold_sessions where id = p_session for update;
  if not found or s.recipient_id is distinct from v_uid then
    raise exception 'hold_forbidden' using errcode = '42501';
  end if;

  -- A retry of the very same send is fine, whatever happened since.
  select * into v_reply from public.hold_replies
   where author_id = v_uid and client_key = p_client_key;
  if found then
    return jsonb_build_object('id', v_reply.id, 'duplicate', true);
  end if;

  if s.status = 'closed' then raise exception 'hold_closed' using errcode = 'P0001'; end if;
  if s.status = 'expired' or public.hold_is_expired(s) then
    raise exception 'hold_expired' using errcode = 'P0001';
  end if;
  if s.status not in ('pending','opened','continued') then
    raise exception 'hold_already_responded' using errcode = 'P0001';
  end if;
  -- Someone who asked for space is never answered with "tell me about it".
  if s.need = 'space' and p_action = 'listening' then
    raise exception 'hold_action_unfit' using errcode = 'P0001';
  end if;
  if p_gesture is not null and p_action <> 'warmth' then
    raise exception 'hold_invalid' using errcode = '22023';
  end if;

  insert into public.hold_replies
    (session_id, author_id, round, kind, action, gesture, message, client_key)
  values
    (s.id, v_uid, s.round, 'support', p_action, p_gesture,
     nullif(btrim(coalesce(p_message, '')), ''), p_client_key)
  returning id into v_id;

  update public.hold_sessions
     set status = 'responded', responded_at = now(),
         opened_at = coalesce(opened_at, now()), after_choice = null
   where id = s.id;

  return jsonb_build_object('id', v_id, 'duplicate', false);
end;
$$;

-- ---- hold_after -------------------------------------------------------------
-- The sender's "what do you need now?" after a gesture arrived.
--   longer     → continued, next round (need may change, follow-up optional)
--   less_alone → closed, gently
--   quiet      → closed, no reply needed from anyone
create or replace function public.hold_after(
  p_session uuid,
  p_choice text,
  p_new_need text,
  p_followup text,
  p_keep boolean,
  p_client_key uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  s public.hold_sessions;
  v_msg text := nullif(btrim(coalesce(p_followup, '')), '');
begin
  select * into s from public.hold_sessions where id = p_session for update;
  if not found or s.sender_id is distinct from v_uid then
    raise exception 'hold_forbidden' using errcode = '42501';
  end if;

  if p_choice = 'longer' then
    -- Retried "longer": the follow-up already landed — nothing more to do.
    if exists (select 1 from public.hold_replies
                where author_id = v_uid and client_key = p_client_key) then
      return;
    end if;
    if s.status <> 'responded' then
      if s.status = 'closed' then raise exception 'hold_closed' using errcode = 'P0001'; end if;
      raise exception 'hold_bad_state' using errcode = 'P0001';
    end if;
    update public.hold_sessions
       set status = 'continued', round = s.round + 1, after_choice = 'longer',
           need = coalesce(p_new_need, s.need),
           expires_at = now() + interval '3 days'
     where id = s.id;
    if v_msg is not null then
      insert into public.hold_replies (session_id, author_id, round, kind, message, client_key)
      values (s.id, v_uid, s.round + 1, 'followup', v_msg, p_client_key);
    end if;
    return;
  end if;

  if p_choice not in ('less_alone','quiet') then
    raise exception 'hold_invalid' using errcode = '22023';
  end if;
  if s.status = 'closed' then
    return; -- already closed: a retried close is a no-op, never a reopen
  end if;
  if s.status <> 'responded' then
    raise exception 'hold_bad_state' using errcode = 'P0001';
  end if;

  update public.hold_sessions
     set status = 'closed', after_choice = p_choice, closed_at = now(),
         kept = coalesce(p_keep, false)
   where id = s.id;
  if not coalesce(p_keep, false) then
    perform public.hold_scrub(s.id);
  end if;
end;
$$;

-- ---- hold_close -------------------------------------------------------------
-- The sender ends a session at any point (also withdrawing an unanswered one).
create or replace function public.hold_close(p_session uuid, p_keep boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  s public.hold_sessions;
begin
  select * into s from public.hold_sessions where id = p_session for update;
  if not found or s.sender_id is distinct from auth.uid() then
    raise exception 'hold_forbidden' using errcode = '42501';
  end if;
  if s.status = 'closed' then return; end if;

  update public.hold_sessions
     set status = case when public.hold_is_expired(s) or s.status = 'expired'
                       then 'expired' else 'closed' end,
         closed_at = now(), kept = coalesce(p_keep, false)
   where id = s.id;
  if not coalesce(p_keep, false) then
    perform public.hold_scrub(s.id);
  end if;
end;
$$;

-- ---- hold_set_kept ----------------------------------------------------------
-- Past Holds: keep an ended session, or let it go (words scrubbed now, the
-- shell goes with the next tidy). Only for sessions that have ended.
create or replace function public.hold_set_kept(p_session uuid, p_keep boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  s public.hold_sessions;
begin
  select * into s from public.hold_sessions where id = p_session for update;
  if not found or s.sender_id is distinct from auth.uid() then
    raise exception 'hold_forbidden' using errcode = '42501';
  end if;
  if s.status not in ('closed','expired') then
    raise exception 'hold_bad_state' using errcode = 'P0001';
  end if;
  update public.hold_sessions
     set kept = coalesce(p_keep, false), closed_at = coalesce(closed_at, now())
   where id = s.id;
  if not coalesce(p_keep, false) then
    perform public.hold_scrub(s.id);
  end if;
end;
$$;

-- ---- hold_tidy --------------------------------------------------------------
-- Lazy housekeeping for one space: settle expired sessions (their words are
-- scrubbed unless kept) and delete un-kept shells a week after they ended.
create or replace function public.hold_tidy(p_space uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if not public.is_member(p_space) then
    raise exception 'hold_forbidden' using errcode = '42501';
  end if;

  for r in
    update public.hold_sessions s
       set status = 'expired', closed_at = now()
     where s.space_id = p_space and public.hold_is_expired(s)
    returning s.id, s.kept
  loop
    if not r.kept then perform public.hold_scrub(r.id); end if;
  end loop;

  delete from public.hold_sessions
   where space_id = p_space and status in ('closed','expired')
     and not kept and closed_at < now() - interval '7 days';
end;
$$;

revoke all on function public.hold_create(uuid,text,int,boolean,text,text,boolean,text,uuid) from public, anon;
revoke all on function public.hold_open(uuid) from public, anon;
revoke all on function public.hold_respond(uuid,text,text,text,uuid) from public, anon;
revoke all on function public.hold_after(uuid,text,text,text,boolean,uuid) from public, anon;
revoke all on function public.hold_close(uuid,boolean) from public, anon;
revoke all on function public.hold_set_kept(uuid,boolean) from public, anon;
revoke all on function public.hold_tidy(uuid) from public, anon;

grant execute on function public.hold_create(uuid,text,int,boolean,text,text,boolean,text,uuid) to authenticated;
grant execute on function public.hold_open(uuid) to authenticated;
grant execute on function public.hold_respond(uuid,text,text,text,uuid) to authenticated;
grant execute on function public.hold_after(uuid,text,text,text,boolean,uuid) to authenticated;
grant execute on function public.hold_close(uuid,boolean) to authenticated;
grant execute on function public.hold_set_kept(uuid,boolean) to authenticated;
grant execute on function public.hold_tidy(uuid) to authenticated;
