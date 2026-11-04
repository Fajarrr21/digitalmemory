-- ============================================================================
--  0022 — little words. ♡  A private literary space for two.
--
--  "A little space for everything we cannot always say."
--
--  literary_works      — every poem / prose / letter / quote one of you wrote
--                        (by hand, from The Muse, or through The Rewrite).
--                        OWNER-ONLY, always: a draft is never readable by the
--                        partner, and neither is a finished work. Sharing
--                        happens only through a delivery (below), which
--                        SNAPSHOTS the words — so the partner never gets a
--                        window into your drafts, and later edits to the work
--                        never rewrite what was already given.
--  literary_revisions  — revision history of a work: a snapshot (title +
--                        content) each time it is created, rewritten by AI,
--                        refined, restored, or explicitly "saved as a
--                        version". Owner-only; deleted with its work.
--  literary_lines      — "Lines I Love": a single line you kept from a work
--                        (your own, or one given to you). Owner-only. The
--                        line text is kept even if its source is deleted.
--  literary_deliveries — "To You": a work given to the partner. Snapshot of
--                        title/content/form + an intro message, an optional
--                        "Open when…" label and an optional unlock time.
--                        The recipient cannot read the words before
--                        unlock_at (RLS), only that something is waiting
--                        (words_sealed()). Without unlock_at, "open when you
--                        miss me" is the recipient's own choice — nothing
--                        here pretends to know how anyone feels.
--  literary_ai_usage   — one row per AI request, owner-only. Only used for a
--                        soft daily cap so a bug can never run up a bill.
--                        Stores NO text — never the writing itself.
--
--  Deleting a work: revisions go with it; kept lines and deliveries keep
--  their own snapshot (work_id → null). A sender may withdraw a delivery
--  only while it is still unopened; the recipient can archive it from their
--  own library (never delete the sender's gift).
--
--  Idempotent — safe to re-run.
-- ============================================================================

-- ---- literary_works ----------------------------------------------------------
create table if not exists public.literary_works (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references public.spaces(id) on delete cascade,
  author_id      uuid not null references public.profiles(id) on delete cascade,
  title          text not null default '' check (char_length(title) <= 160),
  content        text not null default '' check (char_length(content) <= 20000),
  work_type      text not null default 'poetry'
                   check (work_type in ('poetry','prose','letter','quote')),
  style          text check (char_length(style) <= 40),
  theme          text check (char_length(theme) <= 160),
  genre          text check (genre in ('romanticism','melancholia','nostalgia','existentialism',
                                       'contemplative','philosophical','affection','longing','acceptance')),
  mood           text check (mood in ('romantic','melancholic','nostalgic','philosophical','intimate',
                                      'tender','dramatic','contemplative','hopeful','bittersweet')),
  language       text not null default 'id' check (language in ('id','en')),
  literary_depth smallint check (literary_depth between 1 and 5),
  status         text not null default 'draft' check (status in ('draft','finished')),
  origin         text not null default 'manual' check (origin in ('manual','muse','rewrite')),
  is_favorite    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_literary_works_author
  on public.literary_works(author_id, updated_at desc);

drop trigger if exists trg_literary_works_updated on public.literary_works;
create trigger trg_literary_works_updated before update on public.literary_works
  for each row execute function public.set_updated_at();

alter table public.literary_works enable row level security;

drop policy if exists literary_works_select on public.literary_works;
create policy literary_works_select on public.literary_works for select
  using (author_id = auth.uid() and public.is_member(space_id));

drop policy if exists literary_works_insert on public.literary_works;
create policy literary_works_insert on public.literary_works for insert
  with check (author_id = auth.uid() and public.is_member(space_id));

drop policy if exists literary_works_update on public.literary_works;
create policy literary_works_update on public.literary_works for update
  using (author_id = auth.uid() and public.is_member(space_id))
  with check (author_id = auth.uid() and public.is_member(space_id));

drop policy if exists literary_works_delete on public.literary_works;
create policy literary_works_delete on public.literary_works for delete
  using (author_id = auth.uid());

-- ---- literary_revisions ------------------------------------------------------
create table if not exists public.literary_revisions (
  id              uuid primary key default gen_random_uuid(),
  work_id         uuid not null references public.literary_works(id) on delete cascade,
  author_id       uuid not null references public.profiles(id) on delete cascade,
  title           text not null default '' check (char_length(title) <= 160),
  content         text not null check (char_length(content) <= 20000),
  kind            text not null check (kind in ('created','manual','rewrite','refine','restore')),
  transformation  text check (char_length(transformation) <= 80),
  created_at      timestamptz not null default now()
);

create index if not exists idx_literary_revisions_work
  on public.literary_revisions(work_id, created_at desc);

alter table public.literary_revisions enable row level security;

drop policy if exists literary_revisions_select on public.literary_revisions;
create policy literary_revisions_select on public.literary_revisions for select
  using (author_id = auth.uid());

drop policy if exists literary_revisions_insert on public.literary_revisions;
create policy literary_revisions_insert on public.literary_revisions for insert
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.literary_works w
                 where w.id = literary_revisions.work_id and w.author_id = auth.uid())
  );

drop policy if exists literary_revisions_delete on public.literary_revisions;
create policy literary_revisions_delete on public.literary_revisions for delete
  using (author_id = auth.uid());

-- ---- literary_deliveries -----------------------------------------------------
create table if not exists public.literary_deliveries (
  id                 uuid primary key default gen_random_uuid(),
  space_id           uuid not null references public.spaces(id) on delete cascade,
  work_id            uuid references public.literary_works(id) on delete set null,
  sender_id          uuid not null references public.profiles(id) on delete cascade,
  recipient_id       uuid not null references public.profiles(id) on delete cascade,
  title              text not null default '' check (char_length(title) <= 160),
  content            text not null check (char_length(content) between 1 and 20000),
  work_type          text not null check (work_type in ('poetry','prose','letter','quote')),
  genre              text,
  mood               text,
  language           text not null default 'id' check (language in ('id','en')),
  intro              text check (char_length(intro) <= 600),
  open_when          text check (open_when in ('miss_me','tired','reminder','birthday',
                                               'courage','right_time','custom')),
  open_when_label    text check (char_length(open_when_label) <= 80),
  unlock_at          timestamptz,
  reply_to           uuid references public.literary_deliveries(id) on delete set null,
  opened_at          timestamptz,
  recipient_favorite boolean not null default false,
  recipient_archived boolean not null default false,
  created_at         timestamptz not null default now(),
  constraint literary_delivery_not_self check (sender_id <> recipient_id),
  constraint literary_delivery_custom_label check (open_when <> 'custom' or open_when_label is not null)
);

create index if not exists idx_literary_deliveries_recipient
  on public.literary_deliveries(recipient_id, created_at desc);
create index if not exists idx_literary_deliveries_sender
  on public.literary_deliveries(sender_id, created_at desc);

alter table public.literary_deliveries enable row level security;

-- The sender always sees what they gave. The recipient sees the words only
-- once they're unlocked; before that, words_sealed() says only THAT
-- something is waiting.
drop policy if exists literary_deliveries_select on public.literary_deliveries;
create policy literary_deliveries_select on public.literary_deliveries for select
  using (
    public.is_member(space_id)
    and (sender_id = auth.uid()
         or (recipient_id = auth.uid() and (unlock_at is null or unlock_at <= now())))
  );

-- Give only AS yourself, only TO the other member, only fresh, only from a
-- work you own, and a reply only to something that was given to you.
drop policy if exists literary_deliveries_insert on public.literary_deliveries;
create policy literary_deliveries_insert on public.literary_deliveries for insert
  with check (
    sender_id = auth.uid()
    and public.is_member(space_id)
    and recipient_id <> auth.uid()
    and exists (select 1 from public.space_members m
                 where m.space_id = literary_deliveries.space_id
                   and m.user_id = literary_deliveries.recipient_id)
    and opened_at is null and recipient_favorite = false and recipient_archived = false
    and (work_id is null or exists (select 1 from public.literary_works w
                                     where w.id = literary_deliveries.work_id
                                       and w.author_id = auth.uid()))
    and (reply_to is null or exists (select 1 from public.literary_deliveries d
                                      where d.id = literary_deliveries.reply_to
                                        and d.recipient_id = auth.uid()))
  );

-- Withdraw: the sender, and only while it hasn't been opened yet.
drop policy if exists literary_deliveries_delete on public.literary_deliveries;
create policy literary_deliveries_delete on public.literary_deliveries for delete
  using (sender_id = auth.uid() and opened_at is null);

-- No UPDATE policy: the recipient's flags go through the functions below,
-- so nobody can rewrite the words after they were given.

-- The recipient opens it (first time counts). Refused while still locked.
create or replace function public.words_open(p_delivery uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.literary_deliveries;
begin
  select * into d from public.literary_deliveries where id = p_delivery for update;
  if not found or d.recipient_id is distinct from auth.uid() then
    raise exception 'words_forbidden' using errcode = '42501';
  end if;
  if d.unlock_at is not null and d.unlock_at > now() then
    raise exception 'words_locked' using errcode = 'P0001';
  end if;
  update public.literary_deliveries set opened_at = coalesce(opened_at, now()) where id = d.id;
end;
$$;

-- The recipient favourites / archives a gift in their own library.
create or replace function public.words_mark(p_delivery uuid, p_favorite boolean, p_archived boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.literary_deliveries;
begin
  select * into d from public.literary_deliveries where id = p_delivery for update;
  if not found or d.recipient_id is distinct from auth.uid() then
    raise exception 'words_forbidden' using errcode = '42501';
  end if;
  if d.unlock_at is not null and d.unlock_at > now() then
    raise exception 'words_locked' using errcode = 'P0001';
  end if;
  update public.literary_deliveries
     set recipient_favorite = coalesce(p_favorite, recipient_favorite),
         recipient_archived = coalesce(p_archived, recipient_archived),
         opened_at = coalesce(opened_at, now())
   where id = d.id;
end;
$$;

-- What's waiting for me but still locked: no title, no words — only who,
-- the "open when" label, and when it unlocks.
create or replace function public.words_sealed(p_space uuid)
returns table (id uuid, sender_id uuid, open_when text, open_when_label text,
               unlock_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select d.id, d.sender_id, d.open_when, d.open_when_label, d.unlock_at, d.created_at
    from public.literary_deliveries d
   where d.space_id = p_space
     and d.recipient_id = auth.uid()
     and d.unlock_at is not null and d.unlock_at > now()
   order by d.unlock_at asc;
$$;

revoke all on function public.words_open(uuid) from public, anon;
revoke all on function public.words_mark(uuid,boolean,boolean) from public, anon;
revoke all on function public.words_sealed(uuid) from public, anon;
grant execute on function public.words_open(uuid) to authenticated;
grant execute on function public.words_mark(uuid,boolean,boolean) to authenticated;
grant execute on function public.words_sealed(uuid) to authenticated;

-- ---- literary_lines ("Lines I Love") ----------------------------------------
create table if not exists public.literary_lines (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references public.spaces(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  text          text not null check (char_length(text) between 1 and 600),
  work_id       uuid references public.literary_works(id) on delete set null,
  delivery_id   uuid references public.literary_deliveries(id) on delete set null,
  source_title  text check (char_length(source_title) <= 160),
  created_at    timestamptz not null default now()
);

create index if not exists idx_literary_lines_user
  on public.literary_lines(user_id, created_at desc);

alter table public.literary_lines enable row level security;

drop policy if exists literary_lines_select on public.literary_lines;
create policy literary_lines_select on public.literary_lines for select
  using (user_id = auth.uid());

drop policy if exists literary_lines_insert on public.literary_lines;
create policy literary_lines_insert on public.literary_lines for insert
  with check (
    user_id = auth.uid()
    and public.is_member(space_id)
    and (work_id is null or exists (select 1 from public.literary_works w
                                     where w.id = literary_lines.work_id and w.author_id = auth.uid()))
    and (delivery_id is null or exists (select 1 from public.literary_deliveries d
                                         where d.id = literary_lines.delivery_id
                                           and (d.sender_id = auth.uid()
                                                or (d.recipient_id = auth.uid()
                                                    and (d.unlock_at is null or d.unlock_at <= now())))))
  );

drop policy if exists literary_lines_delete on public.literary_lines;
create policy literary_lines_delete on public.literary_lines for delete
  using (user_id = auth.uid());

-- ---- literary_ai_usage (soft cap; never stores text) -------------------------
create table if not exists public.literary_ai_usage (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('generate','rewrite','refine','explain')),
  created_at  timestamptz not null default now()
);

create index if not exists idx_literary_ai_usage_user
  on public.literary_ai_usage(user_id, created_at desc);

alter table public.literary_ai_usage enable row level security;

drop policy if exists literary_ai_usage_select on public.literary_ai_usage;
create policy literary_ai_usage_select on public.literary_ai_usage for select
  using (user_id = auth.uid());

drop policy if exists literary_ai_usage_insert on public.literary_ai_usage;
create policy literary_ai_usage_insert on public.literary_ai_usage for insert
  with check (user_id = auth.uid());
