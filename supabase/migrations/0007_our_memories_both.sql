-- ============================================================================
--  0007 — Our Little Universe is now co-authored
--  Both members may add / edit / delete shared memories (was author-only).
--  Storage deletes of the partner's files run via the admin client server-side.
-- ============================================================================

drop policy if exists our_memories_write on public.our_memories;
create policy our_memories_write on public.our_memories for all
  using (public.is_member(space_id))
  with check (public.is_member(space_id));
