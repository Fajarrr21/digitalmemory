-- ============================================================================
--  0021 — her little moon. ♡
--
--  A private place for her to understand her own cycle: periods, a gentle
--  daily body check-in, insights computed only from what she logged, her own
--  reminders — and, ONLY when she chooses, a way to ask for a little care.
--
--  PRIVACY MODEL (the point of this migration):
--
--  moon_periods / moon_checkins / moon_reminders / moon_share are OWNER-ONLY.
--  Being in the same couple space grants the partner NOTHING here: there is
--  no select policy for anyone but the owner, so a direct API call returns
--  zero rows.
--
--  The partner can see exactly two things, both by her explicit choice:
--    1. moon_care_requests — a request she deliberately sends ("I need a
--       little extra care", "Please keep me company", …). Readable by her and
--       by the recipient; she can withdraw it (delete) at any time.
--    2. moon_partner_view() — a security-definer function that returns ONLY
--       what her moon_share settings allow at the moment of the call
--       (period dates for the heads-up / phase, today's symptom flags — never
--       notes, mood or flow). It reads the settings live, so turning a share
--       off stops further access immediately. If she shares nothing, it
--       returns nothing at all.
--
--  Nothing here is ever sent anywhere automatically except her OWN optional
--  reminders, whose WhatsApp text is generic ("Pengingat kecil untukmu ♡").
--
--  Idempotent — safe to re-run.
-- ============================================================================

-- ---- Periods ------------------------------------------------------------------
create table if not exists public.moon_periods (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  space_id   uuid not null references public.spaces(id) on delete cascade,
  start_date date not null,
  end_date   date,             -- null = still going
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint moon_period_order check (end_date is null or end_date >= start_date),
  constraint moon_period_length check (end_date is null or end_date - start_date <= 20)
);
create index if not exists idx_moon_periods_user on public.moon_periods(user_id, start_date desc);
-- At most one period "still going" per person.
create unique index if not exists uq_moon_one_ongoing on public.moon_periods(user_id) where end_date is null;

drop trigger if exists trg_moon_periods_updated on public.moon_periods;
create trigger trg_moon_periods_updated before update on public.moon_periods
  for each row execute function public.set_updated_at();

-- No two periods of the same person may overlap. An ongoing period counts as
-- reaching up to today (its end isn't known yet).
create or replace function public.moon_period_no_overlap()
returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('moon:' || new.user_id::text, 0));
  if exists (
    select 1 from public.moon_periods p
     where p.user_id = new.user_id
       and p.id <> new.id
       and daterange(p.start_date, coalesce(p.end_date, greatest(p.start_date, current_date)), '[]')
           && daterange(new.start_date, coalesce(new.end_date, greatest(new.start_date, current_date)), '[]')
  ) then
    raise exception 'moon_overlap' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_moon_period_overlap on public.moon_periods;
create trigger trg_moon_period_overlap before insert or update on public.moon_periods
  for each row execute function public.moon_period_no_overlap();

-- ---- Daily body check-in -----------------------------------------------------
create table if not exists public.moon_checkins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  space_id   uuid not null references public.spaces(id) on delete cascade,
  day        date not null,
  cramps     smallint check (cramps between 1 and 3),   -- 1 light · 2 moderate · 3 strong
  headache   boolean not null default false,
  nausea     boolean not null default false,
  vomiting   boolean not null default false,
  fatigue    boolean not null default false,
  mood       text check (mood in ('calm','happy','sensitive','sad','irritable','anxious')),
  energy     smallint check (energy between 1 and 3),   -- 1 low · 2 okay · 3 good
  flow       text check (flow in ('spotting','light','medium','heavy')),
  note       text check (char_length(note) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_moon_checkin_day unique (user_id, day),
  constraint moon_checkin_not_empty check (
    cramps is not null or headache or nausea or vomiting or fatigue
    or mood is not null or energy is not null or flow is not null or note is not null
  )
);
create index if not exists idx_moon_checkins_user on public.moon_checkins(user_id, day desc);

drop trigger if exists trg_moon_checkins_updated on public.moon_checkins;
create trigger trg_moon_checkins_updated before update on public.moon_checkins
  for each row execute function public.set_updated_at();

-- ---- Sharing settings (owner-only) --------------------------------------------
create table if not exists public.moon_share (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  space_id        uuid not null references public.spaces(id) on delete cascade,
  share_phase     boolean not null default false,  -- "on my period" / "expected soon"
  share_symptoms  boolean not null default false,  -- today's symptom flags only (no note/mood/flow)
  partner_heads_up boolean not null default false, -- an in-app nudge for him ~1 day before
  updated_at      timestamptz not null default now()
);
drop trigger if exists trg_moon_share_updated on public.moon_share;
create trigger trg_moon_share_updated before update on public.moon_share
  for each row execute function public.set_updated_at();

-- ---- Her own reminders ----------------------------------------------------------
create table if not exists public.moon_reminders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  space_id     uuid not null references public.spaces(id) on delete cascade,
  kind         text not null check (kind in ('checkin','period','insights','custom')),
  label        text check (char_length(label) between 1 and 80),
  at_time      time not null,
  enabled      boolean not null default true,
  whatsapp     boolean not null default false,
  dismissed_on date,   -- "oke ♡" in the 🔔 center, for that local day
  sent_on      date,   -- WhatsApp went out for that local day (claimed before sending)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint moon_reminder_label check (kind <> 'custom' or label is not null)
);
create index if not exists idx_moon_reminders_user on public.moon_reminders(user_id);
create index if not exists idx_moon_reminders_whatsapp on public.moon_reminders(whatsapp, enabled);

drop trigger if exists trg_moon_reminders_updated on public.moon_reminders;
create trigger trg_moon_reminders_updated before update on public.moon_reminders
  for each row execute function public.set_updated_at();

-- ---- Owner-only RLS ---------------------------------------------------------------
alter table public.moon_periods   enable row level security;
alter table public.moon_checkins  enable row level security;
alter table public.moon_share     enable row level security;
alter table public.moon_reminders enable row level security;

drop policy if exists moon_periods_own on public.moon_periods;
create policy moon_periods_own on public.moon_periods for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_member(space_id));

drop policy if exists moon_checkins_own on public.moon_checkins;
create policy moon_checkins_own on public.moon_checkins for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_member(space_id));

drop policy if exists moon_share_own on public.moon_share;
create policy moon_share_own on public.moon_share for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_member(space_id));

drop policy if exists moon_reminders_own on public.moon_reminders;
create policy moon_reminders_own on public.moon_reminders for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_member(space_id));

-- ---- Care requests (sent on purpose) ------------------------------------------
create table if not exists public.moon_care_requests (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references public.spaces(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,  -- her
  recipient_id uuid not null references public.profiles(id) on delete cascade,  -- him
  need         text not null check (need in ('extra_care','company','cheer','space','help','share')),
  message      text check (char_length(message) between 1 and 500),
  acked_at     timestamptz,   -- he tapped "I'm on it ♡"
  closed_at    timestamptz,   -- she says it's okay now
  created_at   timestamptz not null default now(),
  constraint moon_care_not_self check (user_id <> recipient_id)
);
create index if not exists idx_moon_care_recipient on public.moon_care_requests(recipient_id, created_at desc);
create index if not exists idx_moon_care_user on public.moon_care_requests(user_id, created_at desc);

alter table public.moon_care_requests enable row level security;

drop policy if exists moon_care_select on public.moon_care_requests;
create policy moon_care_select on public.moon_care_requests for select
  using (public.is_member(space_id) and (user_id = auth.uid() or recipient_id = auth.uid()));

drop policy if exists moon_care_insert on public.moon_care_requests;
create policy moon_care_insert on public.moon_care_requests for insert
  with check (
    user_id = auth.uid()
    and public.is_member(space_id)
    and recipient_id <> auth.uid()
    and exists (select 1 from public.space_members m
                 where m.space_id = moon_care_requests.space_id and m.user_id = moon_care_requests.recipient_id)
    and acked_at is null and closed_at is null
  );

-- She can withdraw a request entirely — it disappears for both.
drop policy if exists moon_care_delete on public.moon_care_requests;
create policy moon_care_delete on public.moon_care_requests for delete
  using (user_id = auth.uid());

-- He acknowledges; she closes. Nothing else can change.
create or replace function public.moon_care_ack(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.moon_care_requests
     set acked_at = coalesce(acked_at, now())
   where id = p_request and recipient_id = auth.uid() and closed_at is null;
end;
$$;

create or replace function public.moon_care_close(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.moon_care_requests
     set closed_at = coalesce(closed_at, now())
   where id = p_request and user_id = auth.uid();
end;
$$;

-- ---- What the partner may see, decided live --------------------------------------
-- Called by the partner. Returns null when the other member shares nothing.
-- Never returns notes, mood, energy or flow.
create or replace function public.moon_partner_view(p_space uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  s public.moon_share;
  v_tz text;
  v_today date;
  v_out jsonb := '{}'::jsonb;
  v_periods jsonb;
  v_symptoms jsonb;
begin
  if v_uid is null or not public.is_member(p_space) then
    return null;
  end if;
  select user_id into v_owner from public.space_members
   where space_id = p_space and user_id <> v_uid limit 1;
  if v_owner is null then return null; end if;

  select * into s from public.moon_share where user_id = v_owner and space_id = p_space;
  if not found or not (s.share_phase or s.share_symptoms or s.partner_heads_up) then
    return null;
  end if;

  select coalesce(nullif(timezone, ''), 'Asia/Jakarta') into v_tz from public.profiles where id = v_owner;
  v_today := (now() at time zone v_tz)::date;
  v_out := jsonb_build_object('today', v_today, 'share_phase', s.share_phase,
                              'share_symptoms', s.share_symptoms, 'heads_up', s.partner_heads_up);

  if s.share_phase or s.partner_heads_up then
    select coalesce(jsonb_agg(jsonb_build_object('start', start_date, 'end', end_date) order by start_date desc), '[]'::jsonb)
      into v_periods
      from (select start_date, end_date from public.moon_periods
             where user_id = v_owner order by start_date desc limit 8) p;
    v_out := v_out || jsonb_build_object('periods', v_periods);
  end if;

  if s.share_symptoms then
    select jsonb_build_object('cramps', cramps, 'headache', headache, 'nausea', nausea,
                              'vomiting', vomiting, 'fatigue', fatigue)
      into v_symptoms
      from public.moon_checkins where user_id = v_owner and day = v_today;
    v_out := v_out || jsonb_build_object('symptoms', v_symptoms);
  end if;

  return v_out;
end;
$$;

revoke all on function public.moon_care_ack(uuid) from public, anon;
revoke all on function public.moon_care_close(uuid) from public, anon;
revoke all on function public.moon_partner_view(uuid) from public, anon;
grant execute on function public.moon_care_ack(uuid) to authenticated;
grant execute on function public.moon_care_close(uuid) to authenticated;
grant execute on function public.moon_partner_view(uuid) to authenticated;
