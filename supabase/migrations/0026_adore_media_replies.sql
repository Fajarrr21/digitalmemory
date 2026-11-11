-- ============================================================================
-- 0026 — the way i adore you. ♡  (Phase 4: media + replies)
--   Run AFTER 0023, 0024 and 0025.
--
--  photo_path / audio_path — optional photo + voice note per item, in the
--  private `media` bucket under {space_id}/{author_id}/adore/… (so the
--  existing storage policies apply: only the author uploads/deletes there).
--  They're shown only through short-lived signed URLs minted server-side for
--  rows the viewer can already read, so a sealed note's media never leaks
--  through the page. The path must sit in the author's own adore folder.
--
--  reply_text / replied_at — her one reply to an item (she may rewrite it or
--  clear it), via security-definer adore_reply(); she still has no UPDATE
--  policy. Nothing notifies. Idempotent — safe to re-run.
-- ============================================================================

alter table public.adore_contents add column if not exists photo_path    text;
alter table public.adore_contents add column if not exists audio_path    text;
alter table public.adore_contents add column if not exists audio_seconds int check (audio_seconds between 1 and 300);
alter table public.adore_contents add column if not exists reply_text    text check (char_length(reply_text) <= 2000);
alter table public.adore_contents add column if not exists replied_at    timestamptz;

alter table public.adore_contents drop constraint if exists adore_media_in_own_folder;
alter table public.adore_contents add constraint adore_media_in_own_folder check (
  (photo_path is null or photo_path like space_id::text || '/' || author_id::text || '/adore/%')
  and (audio_path is null or audio_path like space_id::text || '/' || author_id::text || '/adore/%')
);

create or replace function public.adore_reply(p_id uuid, p_text text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.adore_contents;
  t text := nullif(trim(p_text), '');
begin
  select * into c from public.adore_contents where id = p_id for update;
  if not found or not public.has_role(c.space_id, 'keeper') then
    raise exception 'adore_forbidden' using errcode = '42501';
  end if;
  if c.status <> 'published' or c.publish_at > now() then
    raise exception 'adore_locked' using errcode = 'P0001';
  end if;
  if char_length(t) > 2000 then
    raise exception 'adore_too_long' using errcode = 'P0001';
  end if;
  update public.adore_contents
     set reply_text = t,
         replied_at = case when t is null then null else now() end,
         opened_at  = coalesce(opened_at, now())
   where id = c.id;
end;
$$;

revoke all on function public.adore_reply(uuid, text) from public, anon;
grant execute on function public.adore_reply(uuid, text) to authenticated;
