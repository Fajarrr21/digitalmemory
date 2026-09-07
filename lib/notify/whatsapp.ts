import "server-only";
import { serverEnv } from "@/lib/env";

/**
 * Send a WhatsApp message via the Fonnte gateway (https://fonnte.com).
 * Fire-and-forget by nature: callers should never let a failed notification
 * break the primary action (saving a rating). Returns whether it was accepted.
 *
 * `to` must be digits in international form, no "+" — e.g. 6285600889551.
 */
export async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  const token = serverEnv.fonnteToken;
  if (!token) return false; // gateway not configured — skip silently

  const target = to.replace(/[^\d]/g, "");
  if (!target) return false;

  try {
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ target, message }),
      // Never hang the request on a slow gateway.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const json = (await res.json().catch(() => null)) as { status?: boolean } | null;
    // Fonnte returns { status: true } when the message is queued/sent.
    return json?.status === true;
  } catch {
    return false;
  }
}
