-- ============================================================================
--  0028 — Seberapa Kenal Kita? Phase 2: Funny Punishment
--  After a non-tie game the loser gets 3 suggestions (one sweet / funny /
--  savage, from a hand-written pool), picks one, the winner approves or asks
--  for others (either may swap at any time if it feels uncomfortable), and the
--  loser marks it done. Written only by server actions (admin client).
-- ============================================================================
alter table public.quiz_games
  add column if not exists punish_options jsonb,
  add column if not exists punish_choice  text,
  add column if not exists punish_state   text
    check (punish_state in ('choosing','chosen','approved','done'));
