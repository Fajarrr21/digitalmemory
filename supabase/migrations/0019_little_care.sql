-- ============================================================================
--  0019 — Little Care
--
--  "Kalau aku belum bisa menghilangkan rasa sakitmu, setidaknya aku ingin
--   membuatmu merasa nggak sendirian."
--
--  A small, warm room for when one of you is physically unwell. The one who
--  isn't feeling well says what they feel and what kind of care would help;
--  the other answers with small, real gestures. Two-way: either of you can
--  open one. It is NOT medical: no diagnosis, no medicine, no dosage — only
--  comfort, plus safety reminders that point to real medical help.
--
--  care_sessions — the session. Holds ONLY what the sender chose to share:
--                  the care they'd like (wants), and — if they said so —
--                  their symptoms, severity, a note, and the single flag
--                  "this may need a medical check" (needs_check).
--  care_private  — the full truth for the sender only (symptoms, severity,
--                  note, warning signs). A separate table because RLS is
--                  row-level: a column could never be hidden from the partner.
--  care_actions  — the carer's gestures: a hug/glow/star, a short message,
--                  an offer to keep them company (chat/call), "I'll let you
--                  rest", or an offer of real help (a drink, contacting
--                  family / medical help / someone close). Offers wait for the
--                  sender's yes / not now — nothing happens without consent.
--
--  WRITES: no insert/update policies. Every change goes through the
--  security-definer functions below, which lock the row and check who you
--  are and which state the session is in. Reads are RLS.
--
--  Rest mode ("Rest Without Pressure"): while a session is resting nothing
--  asks the sender for anything — no WhatsApp, no call offers — and the
--  carer may leave just ONE message to be read later.
--
--  Retention: a session nobody chose to keep has its health details scrubbed
--  the moment it ends, and the shell is deleted 7 days later (care_tidy,
--  called lazily when either of you opens /care). An untouched session
--  quietly expires 3 days after its last activity.
--
--  Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.care_sessions (
  id               uuid primary key default gen_random_uuid(),
  space_id         uuid not null references public.spaces(id) on delete cascade,
  sender_id        uuid not null references public.profiles(id) on delete cascade,
  recipient_id     uuid not null references public.profiles(id) on delete cascade,
  -- What would help — always shared, that's the whole point.
  wants            text[] not null check (
                     cardinality(wants) between 1 and 5
                     and wants <@ array['warm','drink','stay','quiet','surprise']::text[]),
  -- Shared only when the sender said so.
  shared_symptoms  text[] check (shared_symptoms is null or (
                     cardinality(shared_symptoms) between 1 and 6
                     and shared_symptoms <@ array['stomach','nausea','cramps','dizzy','weak','other']::text[])),
  shared_severity  text check (shared_severity in ('mild','moderate','severe')),
  shared_note      text check (char_length(shared_note) between 1 and 400),
  -- "Let them know this may need a medical check" — only ever with consent.
  needs_check      boolean not null default false,
  status           text not null default 'open'
                     check (status in ('open','resting','closed','expired')),
  after_choice     text check (after_choice in ('better','longer','rest')),
  after_at         timestamptz,
  rest_since       timestamptz,
  kept             boolean not null default false,
  client_key       uuid not null,
  notified_at        timestamptz,  -- the carer's one WhatsApp heads-up
  sender_notified_at timestamptz,  -- the sender's one "someone is here"
  opened_at        timestamptz,
  last_care_at     timestamptz,
  closed_at        timestamptz,
  expires_at       timestamptz not null default now() + interval '3 days',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint care_not_self check (sender_id <> recipient_id),
  constraint uq_care_client_key unique (sender_id, client_key)
);

create index if not exists idx_care_space_created
  on public.care_sessions(space_id, created_at desc);
create index if not exists idx_care_recipient_status
  on public.care_sessions(recipient_id, status);
create index if not exists idx_care_sender_status
  on public.care_sessions(sender_id, status);

drop trigger if exists trg_care_sessions_updated on public.care_sessions;
create trigger trg_care_sessions_updated before update on public.care_sessions
  for each row execute function public.set_updated_at();

create table if not exists public.care_private (
  session_id uuid primary key references public.care_sessions(id) on delete cascade,
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  symptoms   text[] not null default '{}',
  severity   text check (severity in ('mild','moderate','severe')),
  note       text check (char_length(note) between 1 and 400),
  red_flags  text[] not null default '{}' check (red_flags <@ array[
               'severe_pain','repeated_vomiting','no_fluids','fainted',
               'heavy_bleeding','pregnant_pain','dehydrated']::text[]),
  created_at timestamptz not null default now()
);

create table if not exists public.care_actions (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.care_sessions(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('gesture','message','accompany','rest','help')),
  variant     text,
  message     text check (char_length(message) between 1 and 280),
  -- Offers (accompany / help) wait for the sender's consent.
  answer      text check (answer in ('yes','not_now')),
  answered_at timestamptz,
  client_key  uuid not null,
  created_at  timestamptz not null default now(),
  constraint care_action_shape check (
    (kind = 'gesture'   and variant in ('hug','glow','star') and message is null) or
    (kind = 'message'   and variant is null and message is not null) or
    (kind = 'accompany' and variant in ('chat','call') and message is null) or
    (kind = 'rest'      and variant is null and message is null) or
    (kind = 'help'      and variant in ('drink','family','medical','close') and message is null)
  ),
  constraint care_answer_only_offers check (answer is null or kind in ('accompany','help')),
  constraint uq_care_action_client_key unique (author_id, client_key)
);

create index if not exists idx_care_actions_session
  on public.care_actions(session_id, created_at);

-- ---- RLS: reads only ------------------------------------------------------

alter table public.care_sessions enable row level security;
alter table public.care_private  enable row level security;
alter table public.care_actions  enable row level security;

drop policy if exists care_sessions_select on public.care_sessions;
create policy care_sessions_select on public.care_sessions for select
  using (public.is_member(space_id)
         and (sender_id = auth.uid() or recipient_id = auth.uid()));
drop policy if exists care_sessions_delete on public.care_sessions;
create policy care_sessions_delete on public.care_sessions for delete
  using (sender_id = auth.uid());

drop policy if exists care_private_select on public.care_private;
create policy care_private_select on public.care_private for select
  using (owner_id = auth.uid());

drop policy if exists care_actions_select on public.care_actions;
create policy care_actions_select on public.care_actions for select
  using (exists (
    select 1 from public.care_sessions s
    where s.id = care_actions.session_id
      and (s.sender_id = auth.uid() or s.recipient_id = auth.uid())
  ));

-- ---- Helpers ----------------------------------------------------------------

create or replace function public.care_is_expired(s public.care_sessions)
returns boolean language sql stable as $$
  select s.status in ('open','resting') and s.expires_at <= now();
$$;

-- Health details go, shape stays: used when a session ends without being kept.
create or replace function public.care_scrub(p_session uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.care_private where session_id = p_session;
  update public.care_sessions
     set shared_symptoms = null, shared_severity = null, shared_note = null,
         needs_check = false
   where id = p_session;
  delete from public.care_actions where session_id = p_session and kind = 'message';
$$;
revoke all on function public.care_scrub(uuid) from public, anon, authenticated;

-- ---- care_create ------------------------------------------------------------
-- Returns { id, created }. A retry with the same client_key returns the same
-- session. While you already have one open, a new one is refused with
-- 'care_active_exists' (its id in DETAIL).
create or replace function public.care_create(
  p_space uuid,
  p_symptoms text[],
  p_severity text,
  p_note text,
  p_share_details boolean,
  p_share_note boolean,
  p_red_flags text[],
  p_needs_check boolean,
  p_wants text[],
  p_client_key uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_recipient uuid;
  v_existing public.care_sessions;
  v_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_flags text[] := coalesce(p_red_flags, '{}');
  v_wants text[] := array(select distinct unnest(coalesce(p_wants, '{}')));
  v_symptoms text[] := array(select distinct unnest(coalesce(p_symptoms, '{}')));
  v_quiet boolean;
begin
  if v_uid is null or not public.is_member(p_space) then
    raise exception 'care_forbidden' using errcode = '42501';
  end if;
  if cardinality(v_symptoms) = 0 or p_severity is null
     or not v_symptoms <@ array['stomach','nausea','cramps','dizzy','weak','other']::text[] then
    raise exception 'care_invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('care:' || v_uid::text, 0));

  select * into v_existing from public.care_sessions
   where sender_id = v_uid and client_key = p_client_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'created', false);
  end if;

  select * into v_existing from public.care_sessions
   where sender_id = v_uid and space_id = p_space
     and status in ('open','resting')
     and not public.care_is_expired(care_sessions)
   order by created_at desc limit 1;
  if found then
    raise exception 'care_active_exists' using errcode = 'P0001', detail = v_existing.id::text;
  end if;

  select user_id into v_recipient from public.space_members
   where space_id = p_space and user_id <> v_uid limit 1;
  if v_recipient is null then
    raise exception 'care_no_partner' using errcode = 'P0001';
  end if;

  v_quiet := 'quiet' = any(v_wants);

  insert into public.care_sessions
    (space_id, sender_id, recipient_id, wants,
     shared_symptoms, shared_severity, shared_note, needs_check,
     status, rest_since, client_key)
  values
    (p_space, v_uid, v_recipient, v_wants,
     case when p_share_details then v_symptoms end,
     case when p_share_details then p_severity end,
     case when p_share_note then v_note end,
     -- The flag only means something when there was a reason for it.
     coalesce(p_needs_check, false)
       and (p_severity = 'severe' or cardinality(v_flags) > 0),
     case when v_quiet then 'resting' else 'open' end,
     case when v_quiet then now() end,
     p_client_key)
  returning id into v_id;

  insert into public.care_private (session_id, owner_id, symptoms, severity, note, red_flags)
  values (v_id, v_uid, v_symptoms, p_severity, v_note, v_flags);

  return jsonb_build_object('id', v_id, 'created', true);
end;
$$;

-- ---- care_open --------------------------------------------------------------
create or replace function public.care_open(p_session uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.care_sessions s
     set opened_at = now()
   where s.id = p_session and s.recipient_id = auth.uid()
     and s.opened_at is null and not public.care_is_expired(s);
end;
$$;

-- ---- care_act ---------------------------------------------------------------
-- The carer's gesture. Returns { id, duplicate, first }.
create or replace function public.care_act(
  p_session uuid,
  p_kind text,
  p_variant text,
  p_message text,
  p_client_key uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  s public.care_sessions;
  v_action public.care_actions;
  v_id uuid;
  v_count int;
  v_msg text := nullif(btrim(coalesce(p_message, '')), '');
begin
  select * into s from public.care_sessions where id = p_session for update;
  if not found or s.recipient_id is distinct from v_uid then
    raise exception 'care_forbidden' using errcode = '42501';
  end if;

  select * into v_action from public.care_actions
   where author_id = v_uid and client_key = p_client_key;
  if found then
    return jsonb_build_object('id', v_action.id, 'duplicate', true, 'first', false);
  end if;

  if s.status = 'closed' then raise exception 'care_closed' using errcode = 'P0001'; end if;
  if s.status = 'expired' or public.care_is_expired(s) then
    raise exception 'care_expired' using errcode = 'P0001';
  end if;
  if p_kind = 'message' and v_msg is null then
    raise exception 'care_invalid' using errcode = '22023';
  end if;

  if s.status = 'resting' then
    -- Resting: nothing that asks for an answer right now…
    if p_kind = 'accompany' then
      raise exception 'care_resting' using errcode = 'P0001';
    end if;
    -- …and only one message, to be read later.
    if p_kind = 'message' and exists (
      select 1 from public.care_actions
       where session_id = s.id and kind = 'message' and created_at >= s.rest_since
    ) then
      raise exception 'care_rest_note_used' using errcode = 'P0001';
    end if;
  end if;

  select count(*) into v_count from public.care_actions where session_id = s.id;
  if v_count >= 40 then
    raise exception 'care_too_many' using errcode = 'P0001';
  end if;

  insert into public.care_actions (session_id, author_id, kind, variant, message, client_key)
  values (s.id, v_uid, p_kind,
          case when p_kind in ('message','rest') then null else p_variant end,
          case when p_kind = 'message' then v_msg end,
          p_client_key)
  returning id into v_id;

  update public.care_sessions
     set last_care_at = now(), opened_at = coalesce(opened_at, now()),
         expires_at = greatest(expires_at, now() + interval '3 days')
   where id = s.id;

  return jsonb_build_object('id', v_id, 'duplicate', false, 'first', v_count = 0);
end;
$$;

-- ---- care_answer ------------------------------------------------------------
-- The sender's yes / not now to an offer. May be changed while the session lives.
create or replace function public.care_answer(p_action uuid, p_answer text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  a public.care_actions;
  s public.care_sessions;
begin
  select * into a from public.care_actions where id = p_action;
  if not found then raise exception 'care_forbidden' using errcode = '42501'; end if;
  select * into s from public.care_sessions where id = a.session_id for update;
  if s.sender_id is distinct from auth.uid() then
    raise exception 'care_forbidden' using errcode = '42501';
  end if;
  if a.kind not in ('accompany','help') or p_answer not in ('yes','not_now') then
    raise exception 'care_invalid' using errcode = '22023';
  end if;
  if s.status not in ('open','resting') or public.care_is_expired(s) then
    raise exception 'care_closed' using errcode = 'P0001';
  end if;
  update public.care_actions set answer = p_answer, answered_at = now() where id = a.id;
end;
$$;

-- ---- care_after -------------------------------------------------------------
-- "A little better?" — never a claim of being healed.
--   better → closed (kept or scrubbed)
--   longer → stays open, the carer is gently told
--   rest   → rest mode
create or replace function public.care_after(p_session uuid, p_choice text, p_keep boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  s public.care_sessions;
begin
  select * into s from public.care_sessions where id = p_session for update;
  if not found or s.sender_id is distinct from auth.uid() then
    raise exception 'care_forbidden' using errcode = '42501';
  end if;
  if s.status = 'closed' then return; end if;
  if s.status = 'expired' or public.care_is_expired(s) then
    raise exception 'care_expired' using errcode = 'P0001';
  end if;

  if p_choice = 'better' then
    update public.care_sessions
       set status = 'closed', after_choice = 'better', after_at = now(),
           closed_at = now(), kept = coalesce(p_keep, false)
     where id = s.id;
    if not coalesce(p_keep, false) then perform public.care_scrub(s.id); end if;
  elsif p_choice = 'longer' then
    update public.care_sessions
       set status = 'open', rest_since = null, after_choice = 'longer', after_at = now(),
           expires_at = now() + interval '3 days'
     where id = s.id;
  elsif p_choice = 'rest' then
    update public.care_sessions
       set status = 'resting', rest_since = coalesce(s.rest_since, now()),
           after_choice = 'rest', after_at = now(),
           expires_at = now() + interval '3 days'
     where id = s.id;
  else
    raise exception 'care_invalid' using errcode = '22023';
  end if;
end;
$$;

-- ---- care_set_rest ----------------------------------------------------------
create or replace function public.care_set_rest(p_session uuid, p_on boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  s public.care_sessions;
begin
  select * into s from public.care_sessions where id = p_session for update;
  if not found or s.sender_id is distinct from auth.uid() then
    raise exception 'care_forbidden' using errcode = '42501';
  end if;
  if s.status not in ('open','resting') or public.care_is_expired(s) then
    raise exception 'care_closed' using errcode = 'P0001';
  end if;
  update public.care_sessions
     set status = case when p_on then 'resting' else 'open' end,
         rest_since = case when p_on then coalesce(s.rest_since, now()) end
   where id = s.id;
end;
$$;

-- ---- care_close -------------------------------------------------------------
create or replace function public.care_close(p_session uuid, p_keep boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  s public.care_sessions;
begin
  select * into s from public.care_sessions where id = p_session for update;
  if not found or s.sender_id is distinct from auth.uid() then
    raise exception 'care_forbidden' using errcode = '42501';
  end if;
  if s.status in ('closed','expired') then return; end if;
  update public.care_sessions
     set status = case when public.care_is_expired(s) then 'expired' else 'closed' end,
         closed_at = now(), kept = coalesce(p_keep, false)
   where id = s.id;
  if not coalesce(p_keep, false) then perform public.care_scrub(s.id); end if;
end;
$$;

-- ---- care_set_kept ----------------------------------------------------------
create or replace function public.care_set_kept(p_session uuid, p_keep boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  s public.care_sessions;
begin
  select * into s from public.care_sessions where id = p_session for update;
  if not found or s.sender_id is distinct from auth.uid() then
    raise exception 'care_forbidden' using errcode = '42501';
  end if;
  if s.status not in ('closed','expired') then
    raise exception 'care_bad_state' using errcode = 'P0001';
  end if;
  update public.care_sessions
     set kept = coalesce(p_keep, false), closed_at = coalesce(closed_at, now())
   where id = s.id;
  if not coalesce(p_keep, false) then perform public.care_scrub(s.id); end if;
end;
$$;

-- ---- care_tidy --------------------------------------------------------------
create or replace function public.care_tidy(p_space uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if not public.is_member(p_space) then
    raise exception 'care_forbidden' using errcode = '42501';
  end if;

  for r in
    update public.care_sessions s
       set status = 'expired', closed_at = now()
     where s.space_id = p_space and public.care_is_expired(s)
    returning s.id, s.kept
  loop
    if not r.kept then perform public.care_scrub(r.id); end if;
  end loop;

  delete from public.care_sessions
   where space_id = p_space and status in ('closed','expired')
     and not kept and closed_at < now() - interval '7 days';
end;
$$;

revoke all on function public.care_create(uuid,text[],text,text,boolean,boolean,text[],boolean,text[],uuid) from public, anon;
revoke all on function public.care_open(uuid) from public, anon;
revoke all on function public.care_act(uuid,text,text,text,uuid) from public, anon;
revoke all on function public.care_answer(uuid,text) from public, anon;
revoke all on function public.care_after(uuid,text,boolean) from public, anon;
revoke all on function public.care_set_rest(uuid,boolean) from public, anon;
revoke all on function public.care_close(uuid,boolean) from public, anon;
revoke all on function public.care_set_kept(uuid,boolean) from public, anon;
revoke all on function public.care_tidy(uuid) from public, anon;

grant execute on function public.care_create(uuid,text[],text,text,boolean,boolean,text[],boolean,text[],uuid) to authenticated;
grant execute on function public.care_open(uuid) to authenticated;
grant execute on function public.care_act(uuid,text,text,text,uuid) to authenticated;
grant execute on function public.care_answer(uuid,text) to authenticated;
grant execute on function public.care_after(uuid,text,boolean) to authenticated;
grant execute on function public.care_set_rest(uuid,boolean) to authenticated;
grant execute on function public.care_close(uuid,boolean) to authenticated;
grant execute on function public.care_set_kept(uuid,boolean) to authenticated;
grant execute on function public.care_tidy(uuid) to authenticated;
