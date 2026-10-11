import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp } from "@/lib/notify/whatsapp";
import { holdWhatsAppEnabled } from "@/lib/hold/logic";

/**
 * Hold notifications — deliberately generic. Never the feeling, the
 * intensity, the context or a message: only that a little space exists.
 * Best-effort: every failure is swallowed so the session itself is never
 * affected. No reminders, ever — at most one message per event.
 */

const SIGNOFF = "— A little place made for you";

export const HOLD_INVITE_TEXT = [
  "Ada ruang kecil yang menunggumu di Hold. ♡",
  "",
  "Buka kalau kamu sempat — nggak harus sekarang.",
  "",
  SIGNOFF,
].join("\n");

export const HOLD_ARRIVED_TEXT = [
  "Seseorang sudah hadir di ruang kecilmu di Hold. ♡",
  "",
  SIGNOFF,
].join("\n");

async function numberOf(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("whatsapp, notif_prefs")
    .eq("id", userId)
    .maybeSingle();
  if (!data || !holdWhatsAppEnabled(data.notif_prefs)) return null;
  return data.whatsapp?.trim() || null;
}

/**
 * Tell the recipient a session is waiting. Claims `notified_at` first
 * (`… where notified_at is null`), so a refresh, a retry or a double submit
 * can never send it twice.
 */
export async function notifyHoldInvite(sessionId: string, recipientId: string): Promise<boolean> {
  try {
    const to = await numberOf(recipientId);
    if (!to) return false;
    const admin = createAdminClient();
    const { data: claimed } = await admin
      .from("hold_sessions")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", sessionId)
      .is("notified_at", null)
      .select("id");
    if (!claimed?.length) return false;
    return await sendWhatsApp(to, HOLD_INVITE_TEXT);
  } catch {
    return false;
  }
}

/** Tell the sender someone arrived. Callers only invoke this for a first, non-duplicate gesture. */
export async function notifyHoldArrived(senderId: string): Promise<boolean> {
  try {
    const to = await numberOf(senderId);
    if (!to) return false;
    return await sendWhatsApp(to, HOLD_ARRIVED_TEXT);
  } catch {
    return false;
  }
}
