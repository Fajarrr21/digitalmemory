import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp } from "@/lib/notify/whatsapp";
import { shouldNotify, stayWhatsAppEnabled } from "@/lib/stay/logic";

/**
 * stay, my love. — the one WhatsApp heads-up. Generic on purpose: never the
 * note, never what kind of gift. At most one every few hours per person
 * however many little things are left (`shouldNotify`), and the gift row is
 * claimed (`notified_at … where notified_at is null`) before sending, so a
 * retry can never send twice. Best-effort; every failure is swallowed.
 */

export const STAY_GIFT_TEXT = [
  "Ada sesuatu yang ditinggalkan untukmu di kamar kecilmu. ♡",
  "",
  "Buka kalau kamu sempat — nggak harus sekarang.",
  "",
  "— stay, my love.",
].join("\n");

export async function notifyStayGift(giftId: string, recipientId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const [{ data: profile }, { data: last }] = await Promise.all([
      admin.from("profiles").select("whatsapp, notif_prefs").eq("id", recipientId).maybeSingle(),
      admin
        .from("stay_gifts")
        .select("notified_at")
        .eq("recipient_id", recipientId)
        .not("notified_at", "is", null)
        .order("notified_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const to = profile?.whatsapp?.trim();
    if (!to) return false;
    if (
      !shouldNotify({
        lastNotifiedAt: last?.notified_at ?? null,
        optedOut: !stayWhatsAppEnabled(profile?.notif_prefs),
      })
    ) {
      return false;
    }
    const { data: claimed } = await admin
      .from("stay_gifts")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", giftId)
      .is("notified_at", null)
      .select("id");
    if (!claimed?.length) return false;
    return await sendWhatsApp(to, STAY_GIFT_TEXT);
  } catch {
    return false;
  }
}
