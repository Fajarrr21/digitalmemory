-- ============================================================================
-- 0025 — the way i adore you. ♡  (Phase 3: the little details)
--   Run AFTER 0023 and 0024.
--
--  Six more kinds, same table, same RLS (she reads only published + due):
--    remembered        I Remember That — published = "I remembered this for
--                      you" (she sees it); a draft stays his private note.
--    another_universe  In Another Universe — chapters; can be marked fulfilled.
--    reasons_i_stay    Reasons I Stay — chapters.
--    future_wish       A Future With You — wish_state someday → planned →
--                      in_progress → fulfilled, optional target_date + note.
--    name_page         Your Name, My Favorite Word — category = theme.
--    notification      My Favorite Notification — body is the message. When
--                      due it shows in her 🔔; WhatsApp ONLY if she opted in
--                      (profiles.notif_prefs.adore_whatsapp_per_day, default
--                      0 = off), claimed via notified_at so it never repeats.
--
--  Either member may move a wish / mark a universe fulfilled, via
--  adore_wish() (she has no UPDATE policy). Idempotent — safe to re-run.
-- ============================================================================

alter table public.adore_contents drop constraint if exists adore_contents_content_type_check;
alter table public.adore_contents add constraint adore_contents_content_type_check
  check (content_type in ('reason','open_when','through_my_eyes','thousand','surprise',
                          'remembered','another_universe','reasons_i_stay','future_wish',
                          'name_page','notification'));

alter table public.adore_contents add column if not exists wish_state   text
  check (wish_state in ('someday','planned','in_progress','fulfilled'));
alter table public.adore_contents add column if not exists wish_note    text check (char_length(wish_note) <= 2000);
alter table public.adore_contents add column if not exists fulfilled_at timestamptz;
alter table public.adore_contents add column if not exists target_date  date;
alter table public.adore_contents add column if not exists notified_at  timestamptz;

create or replace function public.adore_wish(p_id uuid, p_state text, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.adore_contents;
begin
  select * into c from public.adore_contents where id = p_id for update;
  if not found or not public.is_member(c.space_id) then
    raise exception 'adore_forbidden' using errcode = '42501';
  end if;
  if c.content_type not in ('future_wish','another_universe') then
    raise exception 'adore_not_a_wish' using errcode = 'P0001';
  end if;
  if not public.has_role(c.space_id, 'author')
     and (c.status <> 'published' or c.publish_at > now()) then
    raise exception 'adore_locked' using errcode = 'P0001';
  end if;
  update public.adore_contents
     set wish_state   = p_state,
         wish_note    = coalesce(nullif(trim(p_note), ''), wish_note),
         fulfilled_at = case when p_state = 'fulfilled' then coalesce(fulfilled_at, now()) else null end
   where id = c.id;
end;
$$;

revoke all on function public.adore_wish(uuid, text, text) from public, anon;
grant execute on function public.adore_wish(uuid, text, text) to authenticated;
