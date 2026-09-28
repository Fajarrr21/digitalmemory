import "server-only";
import { createClient } from "@/lib/supabase/server";
import { trimTime } from "@/lib/date";
import type { TaskRepeat } from "@/lib/supabase/database.types";
import { isFullyComplete, type TaskLike } from "@/lib/tasks/logic";

export type TaskReminder = {
  id: string;
  remindAt: string;
  offsetDays: number | null;
  remindTime: string;
  sentAt: string | null;
  dismissedAt: string | null;
};

export type Task = TaskLike & {
  spaceId: string;
  createdBy: string;
  title: string;
  note: string | null;
  emoji: string | null;
  repeatKind: TaskRepeat;
  notifyWhatsapp: boolean;
  createdAt: string;
  /** Newest completion timestamp, for the "Completed <date>" line. */
  completedAt: string | null;
  reminders: TaskReminder[];
};

const SELECT =
  "id, space_id, created_by, assigned_to, title, note, emoji, due_date, due_time, started_at, repeat_kind, notify_whatsapp, created_at, " +
  "task_completions(user_id, completed_at), " +
  "task_reminders(id, remind_at, offset_days, remind_time, sent_at, dismissed_at)";

type Raw = {
  id: string;
  space_id: string;
  created_by: string;
  assigned_to: string | null;
  title: string;
  note: string | null;
  emoji: string | null;
  due_date: string;
  due_time: string | null;
  started_at: string | null;
  repeat_kind: TaskRepeat;
  notify_whatsapp: boolean;
  created_at: string;
  task_completions: { user_id: string; completed_at: string }[] | null;
  task_reminders:
    | {
        id: string;
        remind_at: string;
        offset_days: number | null;
        remind_time: string;
        sent_at: string | null;
        dismissed_at: string | null;
      }[]
    | null;
};

function toTask(row: Raw): Task {
  const completions = row.task_completions ?? [];
  const completedAt = completions
    .map((c) => c.completed_at)
    .sort()
    .at(-1);
  return {
    id: row.id,
    spaceId: row.space_id,
    createdBy: row.created_by,
    assignedTo: row.assigned_to,
    title: row.title,
    note: row.note,
    emoji: row.emoji,
    dueDate: row.due_date,
    dueTime: trimTime(row.due_time),
    startedAt: row.started_at,
    repeatKind: row.repeat_kind,
    notifyWhatsapp: row.notify_whatsapp,
    createdAt: row.created_at,
    completedBy: completions.map((c) => c.user_id),
    completedAt: completedAt ?? null,
    reminders: (row.task_reminders ?? [])
      .map((r) => ({
        id: r.id,
        remindAt: r.remind_at,
        offsetDays: r.offset_days,
        remindTime: trimTime(r.remind_time) ?? "19:00",
        sentAt: r.sent_at,
        dismissedAt: r.dismissed_at,
      }))
      .sort((a, b) => (a.remindAt < b.remindAt ? -1 : 1)),
  };
}

/**
 * Every little thing in the space. Both members see the whole list (RLS says
 * so) — who it's *for* is a label, not a wall. Completed things older than a
 * couple of months drop out of the query so the page stays light; they're
 * still in the database, never deleted.
 */
export async function getTasks(spaceId: string, since?: string): Promise<Task[]> {
  const supabase = await createClient();
  let query = supabase.from("tasks").select(SELECT).eq("space_id", spaceId);
  if (since) query = query.gte("due_date", since);
  const { data } = await query.order("due_date", { ascending: true }).limit(400);
  return ((data ?? []) as unknown as Raw[]).map(toTask);
}

export async function getTask(id: string): Promise<Task | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("tasks").select(SELECT).eq("id", id).maybeSingle();
  return data ? toTask(data as unknown as Raw) : null;
}

/** One 📝 mark per day that has little things on it, for /calendar. */
export async function getTaskMonthMarks(
  spaceId: string,
  year: number,
  month: number,
  memberIds: string[],
): Promise<Map<string, { total: number; open: number }>> {
  const supabase = await createClient();
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;

  const { data } = await supabase
    .from("tasks")
    .select("id, due_date, assigned_to, due_time, started_at, task_completions(user_id)")
    .eq("space_id", spaceId)
    .gte("due_date", first)
    .lte("due_date", last);

  const marks = new Map<string, { total: number; open: number }>();
  for (const row of (data ?? []) as unknown as Raw[]) {
    const entry = marks.get(row.due_date) ?? { total: 0, open: 0 };
    entry.total += 1;
    if (!isFullyComplete(toTask(row), memberIds)) entry.open += 1;
    marks.set(row.due_date, entry);
  }
  return marks;
}

export type Nudge = {
  reminderId: string;
  task: Task;
  remindAt: string;
};

/**
 * The nudges that have come due and haven't been waved away — the 🔔 reminder
 * center. Purely derived from `remind_at`: showing a nudge never consumes it,
 * so a reminder can't be missed by having been rendered once.
 */
export async function getDueNudges(
  spaceId: string,
  memberIds: string[],
  now: Date = new Date(),
): Promise<Nudge[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_reminders")
    .select(`id, remind_at, tasks!inner(${SELECT})`)
    .eq("space_id", spaceId)
    .lte("remind_at", now.toISOString())
    .is("dismissed_at", null)
    .order("remind_at", { ascending: false })
    .limit(40);

  const seen = new Set<string>();
  const nudges: Nudge[] = [];
  for (const row of (data ?? []) as unknown as {
    id: string;
    remind_at: string;
    tasks: Raw;
  }[]) {
    if (!row.tasks) continue;
    const task = toTask(row.tasks);
    // One nudge per task — the most recent one that came due.
    if (seen.has(task.id)) continue;
    if (isFullyComplete(task, memberIds)) continue;
    seen.add(task.id);
    nudges.push({ reminderId: row.id, task, remindAt: row.remind_at });
  }
  return nudges;
}
