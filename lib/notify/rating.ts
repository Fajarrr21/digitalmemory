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
 */
export async function notifyPartnerOfRating(args: {
  spaceId: string;
  senderId: string;
  senderName: string;
  rating: RatingSummary;
}): Promise<void> {
  try {
    const admin = createAdminClient();

    // The partner = the space member who isn't the sender.
    const { data: members } = await admin
      .from("space_members")
      .select("user_id")
      .eq("space_id", args.spaceId)
      .neq("user_id", args.senderId);

    const partnerId = members?.[0]?.user_id;
    if (!partnerId) return;

    const { data: partner } = await admin
      .from("profiles")
      .select("whatsapp")
      .eq("id", partnerId)
      .maybeSingle();

    const to = partner?.whatsapp?.trim();
    if (!to) return; // partner hasn't set a number — nothing to do

    await sendWhatsApp(to, buildMessage(args.senderName, args.rating));
  } catch {
    // Never let a notification failure surface to the user.
  }
}

function buildMessage(senderName: string, r: RatingSummary): string {
  const lines = [
    `💌 ${senderName} baru mengisi rating hari ini`,
    "",
    `Skor: ${r.score}/10`,
  ];
  if (r.mood) lines.push(`Perasaan: ${r.mood}`);
  if (r.reason) lines.push(`Cerita: ${r.reason}`);
  if (r.note) lines.push(`Catatan: ${r.note}`);
  lines.push("", "— A little place made for you");
  return lines.join("\n");
}
