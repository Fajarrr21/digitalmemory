-- ============================================================================
--  0015 — Little Things To Do
--
--  "So you don't have to keep everything in your head."
--
--  A small, warm place for homework, deadlines, errands, promises — the little
--  things either of you is afraid to forget. Not a project tracker: one flat
--  list, a due date, an optional time, and gentle reminders.
--
--  tasks             — the thing to remember. `assigned_to` = null means BOTH
--                      of us (a shared little thing); otherwise it's for that
--                      one member (either of you may create one FOR the other).
--  task_completions  — who has finished it. One row per (task, member). A solo
--                      task is done when its assignee has a row; a shared task
--                      is fully done only when BOTH members do. Kept as rows so
--                      "Fajar ○ / Her ✓" is readable, and un-completing is just
--                      deleting your own row.
--  task_reminders    — the nudges. Several per task ("1 day before · 19:00",
--                      "on the day · 08:00"). `remind_at` is absolute UTC,
--                      computed from the owner's timezone when it's created.
--                      In-app the nudge simply appears once remind_at passes;
--                      `sent_at` only ever means "the WhatsApp went out", so a
--                      reminder is never silently consumed.
--
--  Nothing here is ever auto-deleted: an overdue task waits, it doesn't vanish.
-- ============================================================================

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces(id) on delete cascade,
  created_by  uuid not null references public.profiles(id) on delete cascade,
  -- null = "both of us"; otherwise the one member it's for.
  assigned_to uuid references public.profiles(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 160),
  note        text check (char_length(note) <= 2000),
  emoji       text check (char_length(emoji) <= 16),
  due_date    date not null,
  due_time    time,                       -- optional "by 08:00"
  -- Set when someone says "I've started" — the ◐ In Progress state.
  started_at  timestamptz,
  repeat_kind text not null default 'none'
              check (repeat_kind in ('none','daily','weekly','monthly')),
  -- Per-task opt-in: a WhatsApp nudge on top of the in-app one. Deliberately
  -- NOT always on — a reminder you didn't ask for is nagging, not caring.
  notify_whatsapp boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_tasks_space_due
  on public.tasks(space_id, due_date, due_time nulls first);
create index if not exists idx_tasks_assigned
  on public.tasks(assigned_to);

create trigger trg_tasks_updated before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

-- A shared little home: both members see, add, edit and remove the list.
-- (Either of you may write a task FOR the other — that's the point of §8.)
create policy tasks_select on public.tasks for select
  using (public.is_member(space_id));
create policy tasks_insert on public.tasks for insert
  with check (public.is_member(space_id) and created_by = auth.uid());
create policy tasks_update on public.tasks for update
  using (public.is_member(space_id)) with check (public.is_member(space_id));
create policy tasks_delete on public.tasks for delete
  using (public.is_member(space_id));

-- ---- Completions ------------------------------------------------------------
create table if not exists public.task_completions (
  task_id      uuid not null references public.tasks(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

alter table public.task_completions enable row level security;

-- You can read both, but only ever tick your own box.
create policy task_completions_select on public.task_completions for select
  using (exists (
    select 1 from public.tasks t
    where t.id = task_id and public.is_member(t.space_id)
  ));
create policy task_completions_insert on public.task_completions for insert
  with check (user_id = auth.uid() and exists (
    select 1 from public.tasks t
    where t.id = task_id and public.is_member(t.space_id)
  ));
create policy task_completions_delete on public.task_completions for delete
  using (user_id = auth.uid());

-- ---- Reminders --------------------------------------------------------------
create table if not exists public.task_reminders (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  -- Denormalised so RLS (and the dispatcher) never needs the join.
  space_id     uuid not null references public.spaces(id) on delete cascade,
  remind_at    timestamptz not null,
  -- How it was chosen: 0 = on the day, 1 = a day before, 7 = a week before,
  -- null = a custom moment. Kept so a repeating task can regenerate them.
  offset_days  int,
  remind_time  time not null default '19:00',
  -- Only ever "the WhatsApp nudge went out". The in-app nudge is derived from
  -- remind_at, so nothing is consumed by being shown.
  sent_at      timestamptz,
  -- "okay, I've seen it" — clears the nudge from the reminder center.
  dismissed_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_task_reminders_due
  on public.task_reminders(remind_at) where sent_at is null;
create index if not exists idx_task_reminders_task
  on public.task_reminders(task_id);

alter table public.task_reminders enable row level security;

create policy task_reminders_select on public.task_reminders for select
  using (public.is_member(space_id));
create policy task_reminders_insert on public.task_reminders for insert
  with check (public.is_member(space_id));
create policy task_reminders_update on public.task_reminders for update
  using (public.is_member(space_id)) with check (public.is_member(space_id));
create policy task_reminders_delete on public.task_reminders for delete
  using (public.is_member(space_id));
