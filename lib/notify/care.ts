import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp } from "@/lib/notify/whatsapp";
import { careWhatsAppEnabled } from "@/lib/care/logic";

/**
 * Little Care notifications — deliberately generic. NEVER a symptom, a
 * severity, a note or a message: only that a little care room exists. Health
 * details stay inside the app, behind RLS. Best-effort: every failure is
 * swallowed so the session itself is never affected. No reminders, ever — at
 * most one message per session per person, each claimed before it's sent.
 */

const SIGNOFF = "— A little place made for you";

export const CARE_INVITE_TEXT = [
  "Ada seseorang yang butuh sedikit perhatianmu di Little Care. ♡",
  "",
  "Buka app kalau kamu sempat.",
  "",
  SIGNOFF,
].join("\n");

export const CARE_ARRIVED_TEXT = [
  "Seseorang sedang menemanimu di Little Care. ♡",
  "",
  "Nggak perlu dibalas — istirahat saja.",
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
  if (!data || !careWhatsAppEnabled(data.notif_prefs)) return null;
  return data.whatsapp?.trim() || null;
}

/** Tell the carer a session is waiting. Claims `notified_at` first. */
export async function notifyCareInvite(sessionId: string, recipientId: string): Promise<boolean> {
  try {
    const to = await numberOf(recipientId);
    if (!to) return false;
    const admin = createAdminClient();
    const { data: claimed } = await admin
      .from("care_sessions")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", sessionId)
      .is("notified_at", null)
      .select("id");
    if (!claimed?.length) return false;
    return await sendWhatsApp(to, CARE_INVITE_TEXT);
  } catch {
    return false;
  }
}

/**
 * Tell the sender someone is here — once per session. Claims
 * `sender_notified_at`, and re-checks rest mode at send time so a sender who
 * just went to rest is never pinged.
 */
export async function notifyCareArrived(sessionId: string, senderId: string): Promise<boolean> {
  try {
    const to = await numberOf(senderId);
    if (!to) return false;
    const admin = createAdminClient();
    const { data: claimed } = await admin
      .from("care_sessions")
      .update({ sender_notified_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("status", "open")
      .is("sender_notified_at", null)
      .select("id");
    if (!claimed?.length) return false;
    return await sendWhatsApp(to, CARE_ARRIVED_TEXT);
  } catch {
    return false;
  }
}
