-- ============================================================================
--  0030 — Roll the Love Dice: Ular Tangga (board mode)
--  Same game row, same dice, same challenge bank. A 30-square board where a
--  snake head, a ladder foot or a ♥ square deals a challenge card. First to
--  square 30 wins; the other gets one sweet "prize" to do (swappable).
--  Written only by server actions (admin client), like the rest of 0029.
-- ============================================================================
alter table public.dice_games
  add column if not exists kind       text not null default 'free' check (kind in ('free','board')),
  -- { "<user id>": square 0..30 }  (0 = still at the start)
  add column if not exists positions  jsonb not null default '{}'::jsonb,
  -- the latest roll on the board: { id, by, face, from, landed, to, event }
  add column if not exists last_move  jsonb,
  add column if not exists winner     uuid references public.profiles(id) on delete set null,
  add column if not exists prize      text,
  add column if not exists prize_done boolean not null default false;
