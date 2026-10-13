import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp } from "@/lib/notify/whatsapp";
import { localDateISO } from "@/lib/date";
import { MOON_WHATSAPP_TEXT, whatsappDue, type Reminder } from "@/lib/moon/reminders";
import { nowHM } from "@/lib/moon/queries";

/**
 * her little moon. — the optional WhatsApp half of her reminders. Runs from
 * the same two places as Little Things (the authed layout via `after()`, and
 * the daily cron), so it's "around" the chosen time, not to the minute; the
 * in-app 🔔 reminder is the dependable one.
 *
 * Each reminder is claimed for its local day (`sent_on`) with a conditional
 * update before sending, so two callers can never both send it. The text is
 * always the same generic line — never a period, a symptom, or her label.
 */
export async function dispatchMoonReminders(): Promise<number> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("moon_reminders")
    .select("id, user_id, kind, label, at_time, enabled, whatsapp, dismissed_on, sent_on")
    .eq("whatsapp", true)
    .eq("enabled", true)
    .limit(50);
  if (!rows?.length) return 0;

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = await admin.from("profiles").select("id, timezone, whatsapp").in("id", userIds);
  let sent = 0;

  for (const r of rows) {
    const profile = profiles?.find((p) => p.id === r.user_id);
    const to = profile?.whatsapp?.trim();
    if (!to) continue;
    const today = localDateISO(profile?.timezone);
    const { data: checkin } = await admin
      .from("moon_checkins")
      .select("id")
      .eq("user_id", r.user_id)
      .eq("day", today)
      .maybeSingle();
    if (!whatsappDue(r as Reminder, today, nowHM(profile?.timezone), !!checkin)) continue;

    const { data: claimed } = await admin
      .from("moon_reminders")
      .update({ sent_on: today })
      .eq("id", r.id)
      .or(`sent_on.is.null,sent_on.neq.${today}`)
      .select("id");
    if (!claimed?.length) continue;
    if (await sendWhatsApp(to, MOON_WHATSAPP_TEXT)) sent++;
  }
  return sent;
}

export async function dispatchMoonRemindersQuietly(): Promise<void> {
  try {
    await dispatchMoonReminders();
  } catch {
    // Best-effort by design: the in-app reminder is the one that matters.
  }
}
