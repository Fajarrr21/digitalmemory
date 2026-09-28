import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyTaskReminder } from "@/lib/notify/task";
import { trimTime } from "@/lib/date";

/**
 * Send the WhatsApp reminders whose moment has arrived.
 *
 * There is no always-on worker behind this little app, so it runs from two
 * places, and both are safe to call as often as you like:
 *   1. the authed layout, whenever either of you opens the app; and
 *   2. /api/cron/reminders, for the days nobody does.
 *
 * Safety comes from claiming: a row is claimed by setting `sent_at` in a
 * conditional update that only matches while it's still null, so two callers
 * racing can never both win the same reminder. `sent_at` means *only* "the
 * WhatsApp went out" — the in-app nudge is derived from `remind_at` alone, so
 * nothing is ever consumed by being sent (or by failing to send).
 */

/** Don't blast stale messages after a quiet week — the in-app nudge remains. */
const MAX_AGE_HOURS = 72;
const BATCH = 20;

type DueRow = {
  id: string;
  task_id: string;
  space_id: string;
  remind_at: string;
  tasks: {
    title: string;
    emoji: string | null;
    note: string | null;
    due_date: string;
    due_time: string | null;
    assigned_to: string | null;
    created_by: string;
    notify_whatsapp: boolean;
  };
};

export async function dispatchDueReminders(now: Date = new Date()): Promise<number> {
  try {
    const admin = createAdminClient();
    const oldest = new Date(now.getTime() - MAX_AGE_HOURS * 3600_000).toISOString();

    const { data } = await admin
      .from("task_reminders")
      .select(
        "id, task_id, space_id, remind_at, tasks!inner(title, emoji, note, due_date, due_time, assigned_to, created_by, notify_whatsapp)",
      )
      .is("sent_at", null)
      .lte("remind_at", now.toISOString())
      .gte("remind_at", oldest)
      .eq("tasks.notify_whatsapp", true)
      .order("remind_at", { ascending: true })
      .limit(BATCH);

    const rows = (data ?? []) as unknown as DueRow[];
    if (rows.length === 0) return 0;

    let sent = 0;
    for (const row of rows) {
      // Claim it first: only one caller can flip sent_at from null.
      const { data: claimed } = await admin
        .from("task_reminders")
        .update({ sent_at: now.toISOString() })
        .eq("id", row.id)
        .is("sent_at", null)
        .select("id");
      if (!claimed || claimed.length === 0) continue; // someone else got it

      const recipients = await recipientsFor(row);
      if (recipients.length === 0) continue;

      sent += await notifyTaskReminder({
        recipientIds: recipients,
        task: {
          title: row.tasks.title,
          emoji: row.tasks.emoji,
          note: row.tasks.note,
          dueDate: row.tasks.due_date,
          dueTime: trimTime(row.tasks.due_time),
          // Only meaningful for a solo task; for a shared one nobody "sent" it.
          fromPartner:
            row.tasks.assigned_to !== null &&
            row.tasks.assigned_to !== row.tasks.created_by,
        },
      });
    }
    return sent;
  } catch {
    // A reminder that couldn't go out is a quiet miss, never a broken page.
    return 0;
  }
}

/** Who this reminder is for — minus anyone who has already ticked it off. */
async function recipientsFor(row: DueRow): Promise<string[]> {
  const admin = createAdminClient();

  let targets: string[];
  if (row.tasks.assigned_to) {
    targets = [row.tasks.assigned_to];
  } else {
    const { data: members } = await admin
      .from("space_members")
      .select("user_id")
      .eq("space_id", row.space_id);
    targets = (members ?? []).map((m) => m.user_id);
  }

  const { data: done } = await admin
    .from("task_completions")
    .select("user_id")
    .eq("task_id", row.task_id);
  const finished = new Set((done ?? []).map((d) => d.user_id));

  return targets.filter((id) => !finished.has(id));
}

/**
 * Fire-and-forget wrapper for the app shell: never throws, never awaited for
 * anything the page needs.
 */
export async function dispatchDueRemindersQuietly(): Promise<void> {
  try {
    await dispatchDueReminders();
  } catch {
    // ignored by design
  }
}
