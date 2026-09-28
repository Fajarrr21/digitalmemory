import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp } from "@/lib/notify/whatsapp";
import { localDateISO } from "@/lib/date";
import { daysBetween } from "@/lib/tasks/logic";

/**
 * WhatsApp for Little Things. Two kinds of message, both deliberately quiet
 * (PLAN §14): a heads-up when someone writes a little thing FOR you, and the
 * reminder itself when it comes due. Never "🚨 DEADLINE!!!" — it should read
 * like a person nudging you, not an app chasing you.
 *
 * Always best-effort: a failure here must never affect saving a task.
 */

export type TaskNote = {
  title: string;
  emoji: string | null;
  note: string | null;
  dueDate: string;
  dueTime: string | null;
  /** True when the other person wrote this one for you. */
  fromPartner: boolean;
};

type Recipient = { id: string; whatsapp: string | null; timezone: string };

/** Numbers + timezones for a set of members, read past RLS. */
async function loadRecipients(ids: string[]): Promise<Recipient[]> {
  if (ids.length === 0) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, whatsapp, timezone")
    .in("id", ids);
  return (data ?? []).map((p) => ({
    id: p.id,
    whatsapp: p.whatsapp,
    timezone: p.timezone,
  }));
}

function whenLine(task: TaskNote, today: string): string {
  const days = daysBetween(today, task.dueDate);
  const at = task.dueTime ? ` jam ${task.dueTime}` : "";
  if (days === 0) return `Hari ini${at}.`;
  if (days === 1) return `Besok${at}.`;
  if (days < 0) return `Harusnya ${Math.abs(days)} hari yang lalu — masih nunggu kamu.`;
  return `${days} hari lagi${at}.`;
}

export function buildReminderMessage(task: TaskNote, today: string): string {
  const lines = [
    "\u{1F4DD} Sedikit pengingat dari space kita ♡",
    "",
    `${task.emoji ?? "\u{1F4DD}"} ${task.title}`,
    whenLine(task, today),
  ];
  if (task.note) lines.push("", `"${task.note}"`);
  if (task.fromPartner) lines.push("", "Dari your love ♡");
  lines.push(
    "",
    "Nggak buru-buru — cuma biar nggak kelupaan. Kamu pasti bisa. ♡",
    "",
    "— A little place made for you",
  );
  return lines.join("\n");
}

export function buildAssignedMessage(task: TaskNote, today: string): string {
  const lines = [
    "\u{1F4DD} Your love nitip satu hal kecil buat kamu ♡",
    "",
    `${task.emoji ?? "\u{1F4DD}"} ${task.title}`,
    whenLine(task, today),
  ];
  if (task.note) lines.push("", `"${task.note}"`);
  lines.push("", "Nanti diingetin lagi kok. ♡", "", "— A little place made for you");
  return lines.join("\n");
}

/**
 * Send a message to each member who should get it. `build` receives that
 * person's own local "today" so "besok" means tomorrow *for them*.
 * Returns how many the gateway accepted.
 */
async function notifyMembers(
  memberIds: string[],
  build: (today: string) => string,
): Promise<number> {
  try {
    const recipients = await loadRecipients(memberIds);
    let sent = 0;
    for (const person of recipients) {
      const to = person.whatsapp?.trim();
      if (!to) continue; // no number set — nothing to do
      const ok = await sendWhatsApp(to, build(localDateISO(person.timezone)));
      if (ok) sent += 1;
    }
    return sent;
  } catch {
    return 0;
  }
}

/** "Your love just left you a little thing to remember." */
export async function notifyTaskAssigned(args: {
  recipientIds: string[];
  task: TaskNote;
}): Promise<number> {
  return notifyMembers(args.recipientIds, (today) =>
    buildAssignedMessage(args.task, today),
  );
}

/** The reminder itself, when its moment arrives. */
export async function notifyTaskReminder(args: {
  recipientIds: string[];
  task: TaskNote;
}): Promise<number> {
  return notifyMembers(args.recipientIds, (today) =>
    buildReminderMessage(args.task, today),
  );
}
