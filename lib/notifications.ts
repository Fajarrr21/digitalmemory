import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getFlameData } from "@/lib/flame";
import { getDueNudges } from "@/lib/tasks/queries";
import { dueLabel } from "@/lib/tasks/logic";
import { localDateISO } from "@/lib/date";

/**
 * The 🔔 reminder center — everything that's quietly waiting for you, in one
 * place, so a nudge never gets lost between pages. Read-only and derived: it
 * counts what's already true elsewhere (task reminders, sealed letters, the
 * flame) rather than keeping a notification table of its own.
 */

export type NoticeKind = "task" | "letter" | "flame" | "done";

export type Notice = {
  id: string;
  kind: NoticeKind;
  emoji: string;
  /** Short label — "Reminder", "Letter", "Our Little Flame". */
  label: string;
  title: string;
  detail: string | null;
  href: string;
  /** Dismissable task nudges carry their reminder id. */
  reminderId?: string;
  at: string;
};

export type NotificationFeed = {
  /** What's waiting right now — the badge counts these. */
  now: Notice[];
  /** Quietly good news from the last few days. */
  earlier: Notice[];
};

export async function getNotifications(
  spaceId: string,
  userId: string,
  partnerId: string | null,
  timezone: string,
): Promise<NotificationFeed> {
  const supabase = await createClient();
  const today = localDateISO(timezone);
  const memberIds = [userId, ...(partnerId ? [partnerId] : [])];

  const [nudges, { data: sealed }, flame, { data: doneRows }] = await Promise.all([
    getDueNudges(spaceId, memberIds),
    supabase
      .from("direct_letters")
      .select("id, title, created_at")
      .eq("recipient_id", userId)
      .eq("status", "sealed")
      .order("created_at", { ascending: false })
      .limit(5),
    getFlameData(spaceId, userId, partnerId, timezone),
    supabase
      .from("task_completions")
      .select("task_id, user_id, completed_at, tasks!inner(title, emoji, space_id)")
      .eq("tasks.space_id", spaceId)
      .order("completed_at", { ascending: false })
      .limit(6),
  ]);

  const now: Notice[] = [];

  for (const nudge of nudges) {
    // A nudge is only yours if the thing is (a shared one is both of yours).
    const mine = nudge.task.assignedTo === null || nudge.task.assignedTo === userId;
    if (!mine) continue;
    if (nudge.task.completedBy.includes(userId)) continue;
    now.push({
      id: `task-${nudge.reminderId}`,
      kind: "task",
      emoji: nudge.task.emoji ?? "📝",
      label: "Reminder",
      title: nudge.task.title,
      detail: `${dueLabel(nudge.task.dueDate, today)}${
        nudge.task.dueTime ? ` · ${nudge.task.dueTime}` : ""
      }`,
      href: `/tasks/${nudge.task.id}`,
      reminderId: nudge.reminderId,
      at: nudge.remindAt,
    });
  }

  for (const letter of sealed ?? []) {
    now.push({
      id: `letter-${letter.id}`,
      kind: "letter",
      emoji: "💌",
      label: "Letter",
      title: letter.title ?? "Ada surat untukmu.",
      detail: "Belum dibuka.",
      href: "/letter",
      at: letter.created_at,
    });
  }

  if (flame.state.status === "waiting") {
    now.push({
      id: "flame-waiting",
      kind: "flame",
      emoji: "🕯️",
      label: "Our Little Flame",
      title: "Today's flame is waiting for one more.",
      detail: `Day ${flame.state.streak}`,
      href: "/flame",
      at: `${today}T00:00:00.000Z`,
    });
  }

  const earlier: Notice[] = ((doneRows ?? []) as unknown as {
    task_id: string;
    user_id: string;
    completed_at: string;
    tasks: { title: string; emoji: string | null };
  }[]).map((row) => ({
    id: `done-${row.task_id}-${row.user_id}`,
    kind: "done" as const,
    emoji: "✓",
    label: "Task completed",
    title: row.tasks.title,
    detail: row.user_id === userId ? "Kamu menyelesaikannya. ♡" : "Dia menyelesaikannya. ♡",
    href: `/tasks/${row.task_id}`,
    at: row.completed_at,
  }));

  now.sort((a, b) => (a.at < b.at ? 1 : -1));
  return { now, earlier };
}

/**
 * Just the badge number. The app shell renders on every page view, so this
 * stays deliberately cheap — two small queries, and no flame math (the flame
 * has its own card on Home).
 */
export async function countWaiting(
  spaceId: string,
  userId: string,
  partnerId: string | null,
): Promise<number> {
  try {
    const supabase = await createClient();
    const memberIds = [userId, ...(partnerId ? [partnerId] : [])];
    const [nudges, { count: sealed }] = await Promise.all([
      getDueNudges(spaceId, memberIds),
      supabase
        .from("direct_letters")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .eq("status", "sealed"),
    ]);
    const mine = nudges.filter(
      (n) =>
        (n.task.assignedTo === null || n.task.assignedTo === userId) &&
        !n.task.completedBy.includes(userId),
    );
    return mine.length + (sealed ?? 0);
  } catch {
    return 0;
  }
}
