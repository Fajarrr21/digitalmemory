import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp } from "@/lib/notify/whatsapp";

type RatingSummary = {
  score: number;
  mood: string | null;
  reason: string | null;
  note: string | null;
};

/**
 * Notify the OTHER member of the space, over WhatsApp, that a daily rating was
 * just saved. Bidirectional by construction: whoever saved is the sender, the
 * partner is the recipient. Uses the admin client so it can read the partner's
 * number without leaning on the caller's RLS view. Best-effort — any failure is
 * swallowed so the rating save is never affected.
 *
 * Returns true only when a message was actually accepted by the gateway, so the
 * caller can count real sends (and cap them per day).
 */
export async function notifyPartnerOfRating(args: {
  spaceId: string;
  senderId: string;
  rating: RatingSummary;
}): Promise<boolean> {
  try {
    const admin = createAdminClient();

    // The partner = the space member who isn't the sender.
    const { data: members } = await admin
      .from("space_members")
      .select("user_id")
      .eq("space_id", args.spaceId)
      .neq("user_id", args.senderId);

    const partnerId = members?.[0]?.user_id;
    if (!partnerId) return false;

    const { data: partner } = await admin
      .from("profiles")
      .select("whatsapp")
      .eq("id", partnerId)
      .maybeSingle();

    const to = partner?.whatsapp?.trim();
    if (!to) return false; // partner hasn't set a number — nothing to do

    return await sendWhatsApp(to, buildMessage(args.rating));
  } catch {
    // Never let a notification failure surface to the user.
    return false;
  }
}

function buildMessage(r: RatingSummary): string {
  // Addressed to the recipient, so a warm role-agnostic label reads right both
  // ways ("your love") — no dependency on messy display names/nicknames.
  const lines = [
    "💌 Your love baru mengisi rating hari ini",
    "",
    `Skor: ${r.score}/10`,
  ];
  if (r.mood) lines.push(`Perasaan: ${r.mood}`);
  if (r.reason) lines.push(`Cerita: ${r.reason}`);
  if (r.note) lines.push(`Catatan: ${r.note}`);
  lines.push("", "— A little place made for you");
  return lines.join("\n");
}
