-- ============================================================================
--  0003 — per-entry visibility for daily_activities + WhatsApp numbers
--  * daily_activities gains `visibility` ('shared' | 'private').
--    - author sees EVERYTHING (own + partner's, private or not) via has_role.
--    - keeper sees own always, and the author's entries only when 'shared'.
--    - so the toggle is meaningful for the author: it gates what the keeper sees.
--  * profiles gains `whatsapp` — E.164-ish digits (e.g. 6285600889551) used to
--    send the daily-rating summary to the OTHER member via a WhatsApp gateway.
-- ============================================================================

-- ---- daily_activities.visibility -----------------------------------------
alter table public.daily_activities
  add column if not exists visibility text not null default 'shared'
  check (visibility in ('shared', 'private'));

-- Rebuild the SELECT policy to honour visibility.
drop policy if exists daily_activities_select on public.daily_activities;
create policy daily_activities_select on public.daily_activities for select
  using (
    public.is_member(space_id)
    and (
      user_id = auth.uid()                    -- your own entries, always
      or visibility = 'shared'                -- entries explicitly shared
      or public.has_role(space_id, 'author')  -- the author sees everything
    )
  );

-- ---- profiles.whatsapp ----------------------------------------------------
alter table public.profiles
  add column if not exists whatsapp text;
