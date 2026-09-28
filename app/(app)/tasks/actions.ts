"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { localDateISO, zonedDateTimeToUTC } from "@/lib/date";
import { notifyTaskAssigned } from "@/lib/notify/task";
import {
  DEFAULT_REMINDER_TIME,
  isFullyComplete,
  nextOccurrence,
  reminderDateFor,
} from "@/lib/tasks/logic";
import type { TaskRepeat } from "@/lib/supabase/database.types";

export type TaskState = { ok?: boolean; error?: string; id?: string };

const SESSION_GONE = "Sesi kamu habis. Masuk lagi ya.";

/** One chosen nudge: a preset offset, or a custom absolute day. */
const ReminderSchema = z.object({
  offsetDays: z.number().int().min(0).max(365).nullable(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default(DEFAULT_REMINDER_TIME),
});

const TaskSchema = z.object({
  title: z.string().trim().min(1, "Tulis dulu hal kecilnya ya. ♡").max(160),
  note: z.string().trim().max(2000).optional(),
  emoji: z.string().trim().max(16).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggalnya belum kebaca."),
  due_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  assignee: z.enum(["me", "partner", "both"]),
  repeat: z.enum(["none", "daily", "weekly", "monthly"]),
  notify_whatsapp: z.coerce.boolean().default(false),
  reminders: z.string().max(4000).optional(),
});

function parseReminders(raw: string | undefined) {
  if (!raw) return [];
  try {
    const parsed = z.array(ReminderSchema).max(6).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

type ReminderChoice = z.infer<typeof ReminderSchema>;

/** Turn the chosen nudges into rows, pinned to the user's own wall clock. */
function reminderRows(args: {
  taskId: string;
  spaceId: string;
  dueDate: string;
  timezone: string;
  choices: ReminderChoice[];
}) {
  return args.choices.map((choice) => {
    const day =
      choice.offsetDays === null
        ? (choice.date ?? args.dueDate)
        : reminderDateFor(args.dueDate, choice.offsetDays);
    return {
      task_id: args.taskId,
      space_id: args.spaceId,
      remind_at: zonedDateTimeToUTC(day, choice.time, args.timezone),
      offset_days: choice.offsetDays,
      remind_time: choice.time,
    };
  });
}

/** Add a little thing. Either of you may write one for the other. */
export async function createTask(
  _prev: TaskState,
  formData: FormData,
): Promise<TaskState> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };

  const parsed = TaskSchema.safeParse({
    title: formData.get("title"),
    note: (formData.get("note") as string) || undefined,
    emoji: (formData.get("emoji") as string) || undefined,
    due_date: formData.get("due_date"),
    due_time: (formData.get("due_time") as string) || undefined,
    assignee: (formData.get("assignee") as string) || "me",
    repeat: (formData.get("repeat") as string) || "none",
    notify_whatsapp: formData.get("notify_whatsapp") === "on",
    reminders: (formData.get("reminders") as string) || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Coba lagi sebentar ya. ♡" };
  }
  const d = parsed.data;

  const partner = await getPartner(ctx.spaceId, ctx.userId);
  if (d.assignee === "partner" && !partner) {
    return { error: "Belum ada pasangan di space ini." };
  }
  const assignedTo =
    d.assignee === "both" ? null : d.assignee === "me" ? ctx.userId : partner!.id;

  const supabase = await createClient();
  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      space_id: ctx.spaceId,
      created_by: ctx.userId,
      assigned_to: assignedTo,
      title: d.title,
      note: d.note ?? null,
      emoji: d.emoji ?? null,
      due_date: d.due_date,
      due_time: d.due_time ?? null,
      repeat_kind: d.repeat as TaskRepeat,
      notify_whatsapp: d.notify_whatsapp,
    })
    .select("id")
    .single();
  if (error || !task) return { error: "Gagal menyimpan. Coba lagi ya. ♡" };

  const rows = reminderRows({
    taskId: task.id,
    spaceId: ctx.spaceId,
    dueDate: d.due_date,
    timezone: ctx.profile.timezone,
    choices: parseReminders(d.reminders),
  });
  if (rows.length > 0) await supabase.from("task_reminders").insert(rows);

  // A heads-up only when it's for the other person AND WhatsApp was asked for.
  if (d.notify_whatsapp && partner && d.assignee !== "me") {
    await notifyTaskAssigned({
      recipientIds: [partner.id],
      task: {
        title: d.title,
        emoji: d.emoji ?? null,
        note: d.note ?? null,
        dueDate: d.due_date,
        dueTime: d.due_time ?? null,
        fromPartner: true,
      },
    });
  }

  revalidateTasks();
  return { ok: true, id: task.id };
}

const idSchema = z.string().uuid();

/** Tick (or un-tick) your own box. Only ever your own. */
export async function toggleMine(taskId: string): Promise<TaskState> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!idSchema.safeParse(taskId).success) return { error: "Hal kecilnya nggak ketemu." };

  const supabase = await createClient();
  const { data: mine } = await supabase
    .from("task_completions")
    .select("task_id")
    .eq("task_id", taskId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (mine) {
    const { error } = await supabase
      .from("task_completions")
      .delete()
      .eq("task_id", taskId)
      .eq("user_id", ctx.userId);
    if (error) return { error: "Gagal menyimpan. Coba lagi ya." };
    revalidateTasks();
    return { ok: true, id: taskId };
  }

  const { error } = await supabase
    .from("task_completions")
    .insert({ task_id: taskId, user_id: ctx.userId });
  if (error) return { error: "Gagal menyimpan. Coba lagi ya." };

  await rollRepeatingTask(taskId, ctx.spaceId, ctx.userId, ctx.profile.timezone);
  revalidateTasks();
  return { ok: true, id: taskId };
}

/**
 * A repeating little thing doesn't edit itself — once it's fully done, the
 * next one is born beside it, so the finished one stays in history.
 */
async function rollRepeatingTask(
  taskId: string,
  spaceId: string,
  userId: string,
  timezone: string,
) {
  const supabase = await createClient();
  // Embedded selects aren't described by the hand-written Database types, so
  // the shape is asserted here (same pattern as lib/tasks/queries.ts).
  const { data } = await supabase
    .from("tasks")
    .select(
      "id, space_id, created_by, assigned_to, title, note, emoji, due_date, due_time, repeat_kind, notify_whatsapp, task_completions(user_id), task_reminders(offset_days, remind_time)",
    )
    .eq("id", taskId)
    .maybeSingle();

  const task = data as unknown as
    | {
        id: string;
        assigned_to: string | null;
        title: string;
        note: string | null;
        emoji: string | null;
        due_date: string;
        due_time: string | null;
        repeat_kind: TaskRepeat;
        notify_whatsapp: boolean;
        task_completions: { user_id: string }[] | null;
        task_reminders: { offset_days: number | null; remind_time: string }[] | null;
      }
    | null;
  if (!task || task.repeat_kind === "none") return;

  const { data: members } = await supabase
    .from("space_members")
    .select("user_id")
    .eq("space_id", spaceId);
  const memberIds = (members ?? []).map((m) => m.user_id);

  const completions = (task.task_completions ?? []) as { user_id: string }[];
  const done = isFullyComplete(
    {
      id: task.id,
      dueDate: task.due_date,
      dueTime: task.due_time,
      startedAt: null,
      assignedTo: task.assigned_to,
      completedBy: completions.map((c) => c.user_id),
    },
    memberIds,
  );
  if (!done) return;

  const nextDue = nextOccurrence(task.due_date, task.repeat_kind);
  if (!nextDue) return;

  // Don't pile up duplicates if it somehow gets ticked twice.
  const { data: existing } = await supabase
    .from("tasks")
    .select("id")
    .eq("space_id", spaceId)
    .eq("title", task.title)
    .eq("due_date", nextDue)
    .maybeSingle();
  if (existing) return;

  const { data: created } = await supabase
    .from("tasks")
    .insert({
      space_id: spaceId,
      created_by: userId,
      assigned_to: task.assigned_to,
      title: task.title,
      note: task.note,
      emoji: task.emoji,
      due_date: nextDue,
      due_time: task.due_time,
      repeat_kind: task.repeat_kind,
      notify_whatsapp: task.notify_whatsapp,
    })
    .select("id")
    .single();
  if (!created) return;

  const offsets = ((task.task_reminders ?? []) as {
    offset_days: number | null;
    remind_time: string;
  }[]).filter((r) => r.offset_days !== null);

  if (offsets.length > 0) {
    await supabase.from("task_reminders").insert(
      reminderRows({
        taskId: created.id,
        spaceId,
        dueDate: nextDue,
        timezone,
        choices: offsets.map((r) => ({
          offsetDays: r.offset_days,
          time: r.remind_time.slice(0, 5),
        })),
      }),
    );
  }
}

/** "I've started" — the ◐ state. Tapping again puts it back to ○. */
export async function toggleStarted(taskId: string): Promise<TaskState> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!idSchema.safeParse(taskId).success) return { error: "Hal kecilnya nggak ketemu." };

  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("started_at")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return { error: "Hal kecilnya nggak ketemu." };

  const { error } = await supabase
    .from("tasks")
    .update({ started_at: task.started_at ? null : new Date().toISOString() })
    .eq("id", taskId);
  if (error) return { error: "Gagal menyimpan. Coba lagi ya." };

  revalidateTasks();
  return { ok: true, id: taskId };
}

const RescheduleSchema = z.object({
  id: z.string().uuid(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
});

/**
 * Move a little thing to another day. Its preset reminders move with it (and
 * are un-sent, so a moved thing nudges again); custom ones stay where they are.
 */
export async function rescheduleTask(
  _prev: TaskState,
  formData: FormData,
): Promise<TaskState> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };

  const parsed = RescheduleSchema.safeParse({
    id: formData.get("id"),
    due_date: formData.get("due_date"),
    due_time: (formData.get("due_time") as string) || undefined,
  });
  if (!parsed.success) return { error: "Tanggalnya belum kebaca." };
  const { id, due_date, due_time } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ due_date, due_time: due_time ?? null })
    .eq("id", id);
  if (error) return { error: "Gagal memindahkan. Coba lagi ya." };

  const { data: reminders } = await supabase
    .from("task_reminders")
    .select("id, offset_days, remind_time")
    .eq("task_id", id)
    .not("offset_days", "is", null);

  for (const r of reminders ?? []) {
    const day = reminderDateFor(due_date, r.offset_days ?? 0);
    await supabase
      .from("task_reminders")
      .update({
        remind_at: zonedDateTimeToUTC(day, r.remind_time.slice(0, 5), ctx.profile.timezone),
        sent_at: null,
        dismissed_at: null,
      })
      .eq("id", r.id);
  }

  revalidateTasks();
  return { ok: true, id };
}

/** Remove a little thing entirely (its reminders go with it). */
export async function deleteTask(taskId: string): Promise<TaskState> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!idSchema.safeParse(taskId).success) return { error: "Hal kecilnya nggak ketemu." };

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { error: "Gagal menghapus. Coba lagi ya." };

  revalidateTasks();
  return { ok: true };
}

/** "Okay, I've seen it" — clears one nudge from the reminder center. */
export async function dismissNudge(reminderId: string): Promise<TaskState> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!idSchema.safeParse(reminderId).success) return { error: "Pengingatnya nggak ketemu." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("task_reminders")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", reminderId);
  if (error) return { error: "Gagal menyimpan. Coba lagi ya." };

  revalidateTasks();
  return { ok: true };
}

/** Quick Add uses today's date in the user's own timezone. */
export async function todayForMe(): Promise<string> {
  const ctx = await getSpaceContext();
  return localDateISO(ctx?.profile.timezone);
}

function revalidateTasks() {
  revalidatePath("/tasks");
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/notifications");
}
