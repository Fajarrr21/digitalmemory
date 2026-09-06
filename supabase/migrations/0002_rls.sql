-- ============================================================================
--  0002_rls — Row-Level Security + Storage policies
--  Default posture: RLS on, deny-all, then grant the minimum. A table with no
--  matching policy is inaccessible to normal (anon/authenticated) users.
-- ============================================================================

alter table public.profiles          enable row level security;
alter table public.spaces            enable row level security;
alter table public.space_members     enable row level security;
alter table public.letter_pool       enable row level security;
alter table public.daily_letters     enable row level security;
alter table public.daily_ratings     enable row level security;
alter table public.daily_activities  enable row level security;
alter table public.our_memories      enable row level security;
alter table public.special_messages  enable row level security;
alter table public.night_reflections enable row level security;
alter table public.tags              enable row level security;
alter table public.activity_tags     enable row level security;
alter table public.media             enable row level security;

-- ---- profiles -------------------------------------------------------------
-- You can see your own profile, and profiles of anyone sharing a space with you.
create policy profiles_select on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.space_members me
      join public.space_members them on them.space_id = me.space_id
      where me.user_id = auth.uid() and them.user_id = profiles.id
    )
  );
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ---- spaces ---------------------------------------------------------------
create policy spaces_select on public.spaces for select
  using (public.is_member(id));
create policy spaces_insert on public.spaces for insert
  with check (created_by = auth.uid());

-- ---- space_members --------------------------------------------------------
-- Readable by fellow members; membership changes are done via SQL/service role.
create policy space_members_select on public.space_members for select
  using (public.is_member(space_id));

-- ---- letter_pool (author-managed) ----------------------------------------
create policy letter_pool_select on public.letter_pool for select
  using (public.is_member(space_id));
create policy letter_pool_write on public.letter_pool for all
  using (public.has_role(space_id, 'author'))
  with check (public.has_role(space_id, 'author'));

-- ---- daily_letters --------------------------------------------------------
-- Assignment happens server-side via the service role (race-safe). The
-- recipient may update their own letter (to open it). No user-level insert.
create policy daily_letters_select on public.daily_letters for select
  using (public.is_member(space_id));
create policy daily_letters_update on public.daily_letters for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- ---- daily_ratings (acting user owns the row) ----------------------------
create policy daily_ratings_select on public.daily_ratings for select
  using (public.is_member(space_id));
create policy daily_ratings_insert on public.daily_ratings for insert
  with check (public.is_member(space_id) and user_id = auth.uid());
create policy daily_ratings_update on public.daily_ratings for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy daily_ratings_delete on public.daily_ratings for delete
  using (user_id = auth.uid());

-- ---- daily_activities -----------------------------------------------------
create policy daily_activities_select on public.daily_activities for select
  using (public.is_member(space_id));
create policy daily_activities_insert on public.daily_activities for insert
  with check (public.is_member(space_id) and user_id = auth.uid());
create policy daily_activities_update on public.daily_activities for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy daily_activities_delete on public.daily_activities for delete
  using (user_id = auth.uid());

-- ---- our_memories (author-managed, all members read) ---------------------
create policy our_memories_select on public.our_memories for select
  using (public.is_member(space_id));
create policy our_memories_write on public.our_memories for all
  using (public.has_role(space_id, 'author'))
  with check (public.has_role(space_id, 'author'));

-- ---- special_messages -----------------------------------------------------
-- Author writes; recipient may update (to mark opened). All members read.
create policy special_messages_select on public.special_messages for select
  using (public.is_member(space_id));
create policy special_messages_insert on public.special_messages for insert
  with check (public.has_role(space_id, 'author') and author_id = auth.uid());
create policy special_messages_update on public.special_messages for update
  using (public.has_role(space_id, 'author') or recipient_id = auth.uid())
  with check (public.has_role(space_id, 'author') or recipient_id = auth.uid());
create policy special_messages_delete on public.special_messages for delete
  using (public.has_role(space_id, 'author'));

-- ---- night_reflections ----------------------------------------------------
create policy night_reflections_select on public.night_reflections for select
  using (public.is_member(space_id));
create policy night_reflections_insert on public.night_reflections for insert
  with check (public.is_member(space_id) and user_id = auth.uid());
create policy night_reflections_update on public.night_reflections for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---- tags + activity_tags -------------------------------------------------
create policy tags_select on public.tags for select using (public.is_member(space_id));
create policy tags_write on public.tags for all
  using (public.is_member(space_id)) with check (public.is_member(space_id));

create policy activity_tags_select on public.activity_tags for select
  using (exists (
    select 1 from public.daily_activities a
    where a.id = activity_id and public.is_member(a.space_id)
  ));
create policy activity_tags_write on public.activity_tags for all
  using (exists (
    select 1 from public.daily_activities a
    where a.id = activity_id and a.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.daily_activities a
    where a.id = activity_id and a.user_id = auth.uid()
  ));

-- ---- media (owner writes, members read) ----------------------------------
create policy media_select on public.media for select
  using (public.is_member(space_id));
create policy media_insert on public.media for insert
  with check (public.is_member(space_id) and owner_id = auth.uid());
create policy media_update on public.media for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy media_delete on public.media for delete
  using (owner_id = auth.uid());

-- ============================================================================
--  Storage — a single PRIVATE bucket. Object keys: {space_id}/{owner_id}/...
--  Access is served through short-lived signed URLs minted server-side.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

create policy media_objects_select on storage.objects for select
  using (
    bucket_id = 'media'
    and public.is_member(((storage.foldername(name))[1])::uuid)
  );
create policy media_objects_insert on storage.objects for insert
  with check (
    bucket_id = 'media'
    and public.is_member(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2] = auth.uid()::text
  );
create policy media_objects_update on storage.objects for update
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
create policy media_objects_delete on storage.objects for delete
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
