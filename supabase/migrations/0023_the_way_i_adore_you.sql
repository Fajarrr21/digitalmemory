-- ============================================================================
-- 0023 — the way i adore you. ♡  (Phase 1)
--
--  adore_contents — everything the author writes about her, in ONE flexible
--                   table keyed by content_type. Phase 1 kinds:
--                     reason          Things I Adore About You
--                     open_when       Open When You…
--                     through_my_eyes If You Could See Yourself Through My Eyes
--                   Later phases widen the content_type check, not new tables.
--
--  Visibility: the author sees everything (drafts, scheduled, archived). The
--  keeper sees a row ONLY when status = 'published' and publish_at <= now() —
--  enforced by RLS, so a scheduled note can't be read early via a direct query.
--  adore_sealed() tells her only THAT something is coming and when (no words).
--
--  Her side (opened / favourite / reaction) lives on the row, written only via
--  the security-definer adore_mark(): the keeper has no UPDATE policy at all.
--  Nothing here notifies.  Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.adore_contents (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references public.spaces(id) on delete cascade,
  author_id     uuid not null references public.profiles(id) on delete cascade,
  content_type  text not null check (content_type in ('reason','open_when','through_my_eyes')),
  title         text not null check (char_length(title) between 1 and 160),
  subtitle      text check (char_length(subtitle) <= 200),
  body          text not null check (char_length(body) between 1 and 20000),
  category      text check (char_length(category) <= 40),
  status        text not null default 'draft' check (status in ('draft','published','archived')),
  publish_at    timestamptz not null default now(),
  opened_at     timestamptz,
  favorite      boolean not null default false,
  reaction      text check (reaction in ('loved','emotional','smile','appreciated','favorite')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_adore_contents_updated on public.adore_contents;
create trigger trg_adore_contents_updated before update on public.adore_contents
  for each row execute function public.set_updated_at();
create index if not exists idx_adore_contents_space
  on public.adore_contents(space_id, content_type, publish_at);

alter table public.adore_contents enable row level security;

drop policy if exists adore_contents_select on public.adore_contents;
create policy adore_contents_select on public.adore_contents for select
  using (
    public.is_member(space_id)
    and (public.has_role(space_id, 'author')
         or (status = 'published' and publish_at <= now()))
  );

drop policy if exists adore_contents_insert on public.adore_contents;
create policy adore_contents_insert on public.adore_contents for insert
  with check (public.has_role(space_id, 'author') and author_id = auth.uid());

drop policy if exists adore_contents_update on public.adore_contents;
create policy adore_contents_update on public.adore_contents for update
  using (public.has_role(space_id, 'author') and author_id = auth.uid())
  with check (public.has_role(space_id, 'author') and author_id = auth.uid());

drop policy if exists adore_contents_delete on public.adore_contents;
create policy adore_contents_delete on public.adore_contents for delete
  using (public.has_role(space_id, 'author') and author_id = auth.uid());

-- The keeper opens / favourites / reacts. p_favorite null = leave as is;
-- p_reaction null = leave as is, '' = clear it.
create or replace function public.adore_mark(p_id uuid, p_favorite boolean, p_reaction text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.adore_contents;
begin
  select * into c from public.adore_contents where id = p_id for update;
  if not found or not public.has_role(c.space_id, 'keeper') then
    raise exception 'adore_forbidden' using errcode = '42501';
  end if;
  if c.status <> 'published' or c.publish_at > now() then
    raise exception 'adore_locked' using errcode = 'P0001';
  end if;
  update public.adore_contents
     set opened_at = coalesce(opened_at, now()),
         favorite  = coalesce(p_favorite, favorite),
         reaction  = case when p_reaction is null then reaction
                          when p_reaction = '' then null
                          else p_reaction end
   where id = c.id;
end;
$$;

-- What's coming but still sealed: no title, no words — only the kind,
-- the category, and when it opens.
create or replace function public.adore_sealed(p_space uuid)
returns table (id uuid, content_type text, category text, publish_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.content_type, c.category, c.publish_at
    from public.adore_contents c
   where c.space_id = p_space
     and public.is_member(p_space)
     and c.status = 'published'
     and c.publish_at > now()
   order by c.publish_at asc;
$$;

revoke all on function public.adore_mark(uuid, boolean, text) from public, anon;
revoke all on function public.adore_sealed(uuid) from public, anon;
grant execute on function public.adore_mark(uuid, boolean, text) to authenticated;
grant execute on function public.adore_sealed(uuid) to authenticated;
