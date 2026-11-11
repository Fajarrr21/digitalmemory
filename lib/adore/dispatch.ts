import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp } from "@/lib/notify/whatsapp";
import { localDateISO, zonedDateTimeToUTC } from "@/lib/date";
import { adoreWhatsAppDue, adoreWhatsAppPerDay } from "@/lib/adore/logic";

/**
 * My Favorite Notification — the optional WhatsApp half. The in-app 🔔 notice
 * is the dependable one; this only runs for her when she opted in, from the
 * authed layout via `after()` and the daily cron (so "around" the time).
 * Each note is claimed (`notified_at` null → now) before sending, so two
 * callers can never both send it.
 */
export async function dispatchAdoreNotifications(now: Date = new Date()): Promise<number> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("adore_contents")
    .select("id, space_id, body, publish_at")
    .eq("content_type", "notification")
    .eq("status", "published")
    .is("notified_at", null)
    .lte("publish_at", now.toISOString())
    .gte("publish_at", new Date(now.getTime() - 24 * 3600_000).toISOString())
    .order("publish_at", { ascending: true })
    .limit(20);
  if (!rows?.length) return 0;

  let sent = 0;
  for (const r of rows) {
    const { data: keeper } = await admin
      .from("space_members")
      .select("user_id")
      .eq("space_id", r.space_id)
      .eq("role", "keeper")
      .maybeSingle();
    if (!keeper) continue;
    const { data: profile } = await admin
      .from("profiles")
      .select("whatsapp, timezone, notif_prefs")
      .eq("id", keeper.user_id)
      .maybeSingle();
    const to = profile?.whatsapp?.trim();
    const perDay = adoreWhatsAppPerDay(profile?.notif_prefs);
    if (!to || perDay === 0) continue;

    const dayStart = zonedDateTimeToUTC(localDateISO(profile?.timezone, now), "00:00", profile?.timezone);
    const { count } = await admin
      .from("adore_contents")
      .select("id", { count: "exact", head: true })
      .eq("space_id", r.space_id)
      .eq("content_type", "notification")
      .gte("notified_at", dayStart);
    if (!adoreWhatsAppDue(perDay, count ?? 0, r.publish_at, now)) continue;

    const { data: claimed } = await admin
      .from("adore_contents")
      .update({ notified_at: now.toISOString() })
      .eq("id", r.id)
      .is("notified_at", null)
      .select("id");
    if (!claimed?.length) continue;
    if (await sendWhatsApp(to, `${r.body}\n\n— dari space kita ♡`)) sent++;
  }
  return sent;
}

export async function dispatchAdoreNotificationsQuietly(): Promise<void> {
  try {
    await dispatchAdoreNotifications();
  } catch {
    // Best-effort: the in-app notice is the one that matters.
  }
}
