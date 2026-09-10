import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp } from "@/lib/notify/whatsapp";

/**
 * Notify the recipient, over WhatsApp, that a direct letter was just sent to
 * them. Uses the admin client so it can read the recipient's number regardless
 * of the sender's RLS view. Best-effort — any failure is swallowed so sending
 * the letter is never affected. Returns true only when the gateway accepted it.
 */
export async function notifyDirectLetter(args: {
  recipientId: string;
  title: string | null;
  songTitle?: string | null;
  count?: number;
}): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data: recipient } = await admin
      .from("profiles")
      .select("whatsapp")
      .eq("id", args.recipientId)
      .maybeSingle();

    const to = recipient?.whatsapp?.trim();
    if (!to) return false; // recipient hasn't set a number — nothing to do

    return await sendWhatsApp(
      to,
      buildMessage(args.title, args.songTitle ?? null, args.count ?? 1),
    );
  } catch {
    return false;
  }
}

function buildMessage(title: string | null, songTitle: string | null, count: number): string {
  // Role-agnostic ("your love") so it reads right in either direction, without
  // leaning on display names/nicknames.
  const lines =
    count > 1
      ? [`💌 Your love baru menulis ${count} surat berurutan untukmu`]
      : ["💌 Your love baru menulis surat untukmu"];
  if (title) lines.push("", `"${title}"`);
  if (songTitle) lines.push("", `♪ dengan sebuah lagu: ${songTitle}`);
  lines.push(
    "",
    count > 1 ? "Buka berurutan ya, satu per satu. ♡" : "Buka untuk membacanya. ♡",
    "",
    "— A little place made for you",
  );
  return lines.join("\n");
}
