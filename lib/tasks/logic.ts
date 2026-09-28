/**
 * Little Things — pure task logic. No I/O, so it's unit-testable and the same
 * rules apply on the home card, the list, the detail page and the calendar.
 *
 * Completion is stored as rows ("who has ticked this off"), never as a flag:
 *  - a solo task is done when its one assignee has ticked it;
 *  - a shared task ("both of us") is done only when BOTH have.
 */

import { addDaysISO, formatShortDate } from "@/lib/date";
import type { TaskRepeat } from "@/lib/supabase/database.types";

export type TaskStatus = "completed" | "overdue" | "in-progress" | "upcoming";

/** How the list is grouped. Nothing is ever hidden — overdue waits at the top. */
export type TaskBucket =
  | "overdue"
  | "today"
  | "tomorrow"
  | "this-week"
  | "later"
  | "completed";

export const BUCKET_ORDER: TaskBucket[] = [
  "overdue",
  "today",
  "tomorrow",
  "this-week",
  "later",
  "completed",
];

export const BUCKET_LABEL: Record<TaskBucket, string> = {
  overdue: "WAITING FOR YOU",
  today: "TODAY",
  tomorrow: "TOMORROW",
  "this-week": "THIS WEEK",
  later: "LATER",
  completed: "COMPLETED ✓",
};

export type TaskLike = {
  id: string;
  dueDate: string;
  dueTime: string | null;
  startedAt: string | null;
  /** null = "both of us". */
  assignedTo: string | null;
  /** Member ids who have ticked their own box. */
  completedBy: string[];
};

/** Everyone who still has to tick this off before it's truly done. */
export function requiredMembers(task: TaskLike, memberIds: string[]): string[] {
  return task.assignedTo === null ? memberIds : [task.assignedTo];
}

export function isFullyComplete(task: TaskLike, memberIds: string[]): boolean {
  const required = requiredMembers(task, memberIds);
  if (required.length === 0) return false;
  return required.every((id) => task.completedBy.includes(id));
}

/** Has this particular person done their part? */
export function isMineComplete(task: TaskLike, userId: string): boolean {
  return task.completedBy.includes(userId);
}

export function taskStatus(
  task: TaskLike,
  memberIds: string[],
  today: string,
): TaskStatus {
  if (isFullyComplete(task, memberIds)) return "completed";
  if (task.dueDate < today) return "overdue";
  if (task.startedAt) return "in-progress";
  return "upcoming";
}

export function bucketOf(task: TaskLike, memberIds: string[], today: string): TaskBucket {
  const status = taskStatus(task, memberIds, today);
  if (status === "completed") return "completed";
  if (status === "overdue") return "overdue";
  if (task.dueDate === today) return "today";
  if (task.dueDate === addDaysISO(today, 1)) return "tomorrow";
  return task.dueDate <= addDaysISO(today, 7) ? "this-week" : "later";
}

/** Soonest first; within a day, a timed thing comes before an untimed one. */
export function compareTasks(a: TaskLike, b: TaskLike): number {
  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  const at = a.dueTime ?? "99:99";
  const bt = b.dueTime ?? "99:99";
  if (at !== bt) return at < bt ? -1 : 1;
  return a.id < b.id ? -1 : 1;
}

export function groupTasks<T extends TaskLike>(
  tasks: T[],
  memberIds: string[],
  today: string,
): { bucket: TaskBucket; tasks: T[] }[] {
  const byBucket = new Map<TaskBucket, T[]>();
  for (const task of tasks) {
    const bucket = bucketOf(task, memberIds, today);
    const list = byBucket.get(bucket);
    if (list) list.push(task);
    else byBucket.set(bucket, [task]);
  }
  return BUCKET_ORDER.flatMap((bucket) => {
    const list = byBucket.get(bucket);
    if (!list || list.length === 0) return [];
    // Completed reads best newest-done-first; everything else soonest-first.
    list.sort(bucket === "completed" ? (a, b) => -compareTasks(a, b) : compareTasks);
    return [{ bucket, tasks: list }];
  });
}

/** What still needs doing, soonest first — for the home card. */
export function upcomingTasks<T extends TaskLike>(
  tasks: T[],
  memberIds: string[],
  today: string,
): T[] {
  return tasks
    .filter((t) => taskStatus(t, memberIds, today) !== "completed")
    .sort(compareTasks);
}

/** A warm, never-shouty due label. */
export function dueLabel(dueDate: string, today: string): string {
  if (dueDate === today) return "Today";
  if (dueDate === addDaysISO(today, 1)) return "Tomorrow";
  if (dueDate === addDaysISO(today, -1)) return "Yesterday";
  const days = daysBetween(today, dueDate);
  if (days > 1 && days <= 6) return `In ${days} days`;
  if (days < -1 && days >= -13) return `${Math.abs(days)} days ago`;
  return formatShortDate(dueDate);
}

/** Whole days from `from` to `to` (negative when `to` is in the past). */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T12:00:00Z`);
  const b = Date.parse(`${to}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

// ---- Reminders --------------------------------------------------------------

/** The presets offered in the composer, plus "custom". */
export const REMINDER_PRESETS = [
  { offsetDays: 0, label: "On the day" },
  { offsetDays: 1, label: "1 day before" },
  { offsetDays: 2, label: "2 days before" },
  { offsetDays: 7, label: "1 week before" },
] as const;

export const DEFAULT_REMINDER_TIME = "19:00";

/** The calendar day a reminder with this offset lands on. */
export function reminderDateFor(dueDate: string, offsetDays: number): string {
  return addDaysISO(dueDate, -offsetDays);
}

/** The next due date of a repeating little thing, after it's been done. */
export function nextOccurrence(dueDate: string, repeat: TaskRepeat): string | null {
  if (repeat === "none") return null;
  if (repeat === "daily") return addDaysISO(dueDate, 1);
  if (repeat === "weekly") return addDaysISO(dueDate, 7);
  // Monthly: the same day-of-month, clamped to the end of a shorter month.
  const [y, m, d] = dueDate.split("-").map(Number);
  const year = m === 12 ? y + 1 : y;
  const month = m === 12 ? 1 : m + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
