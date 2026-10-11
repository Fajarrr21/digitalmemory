import type {
  HoldAction,
  HoldFeeling,
  HoldNeed,
  HoldStatus,
} from "@/lib/supabase/database.types";

/**
 * If I Could Hold Your Feelings — the pure rules. No IO, so they're unit
 * tested (logic.test.ts) and shared by the server actions and the UI.
 *
 * The database (migration 0018) enforces the same rules authoritatively; this
 * mirror exists so the screen never offers a step the database would refuse.
 */

/** The four visual objects a feeling can become. */
export type HoldObject = "cloud" | "star" | "heart" | "moon";

const OBJECT_OF: Record<HoldFeeling, HoldObject> = {
  overwhelmed: "cloud", // everything feels too much → the heavy cloud
  racing: "cloud", //      a mind that won't slow down → a busier cloud
  alone: "star", //        a little alone → one small star in a big sky
  miss_you: "star", //     missing you → a star waiting for a second one
  comfort: "heart", //     just need comfort → the tender heart
  tired: "moon", //        emotionally tired → the quiet moon
};

export function objectFor(feeling: HoldFeeling): HoldObject {
  return OBJECT_OF[feeling];
}

/** Statuses in which the session is still "live" (not yet ended). */
export const LIVE_STATUSES: readonly HoldStatus[] = ["pending", "opened", "responded", "continued"];
/** Statuses in which the recipient may still offer a gesture. */
const AWAITING_SUPPORT: readonly HoldStatus[] = ["pending", "opened", "continued"];

/**
 * The status as it is *now*: a live session past its quiet window counts as
 * expired even before the lazy tidy writes it down. Mirrors hold_is_expired.
 */
export function effectiveStatus(
  s: { status: HoldStatus; expires_at: string },
  now: Date = new Date(),
): HoldStatus {
  if (AWAITING_SUPPORT.includes(s.status) && new Date(s.expires_at).getTime() <= now.getTime()) {
    return "expired";
  }
  return s.status;
}

export function isLive(status: HoldStatus): boolean {
  return LIVE_STATUSES.includes(status);
}

/** The visual state an object is drawn in. */
export type ObjectState = "initial" | "waiting" | "held" | "ended";

export function objectState(status: HoldStatus): ObjectState {
  switch (status) {
    case "pending":
    case "opened":
    case "continued":
      return "waiting";
    case "responded":
      return "held";
    case "closed":
    case "expired":
      return "ended";
  }
}

/**
 * How well a gesture fits what was asked for.
 *   best  — what they asked for; offered first.
 *   ok    — fine, gently explained.
 *   avoid — goes against the boundary they set; never offered (and the
 *           database refuses it too: someone who asked for space is never
 *           answered with "tell me about it").
 */
export type Fit = "best" | "ok" | "avoid";

const FIT: Record<HoldNeed, Record<HoldAction, Fit>> = {
  stay: { stay: "best", warmth: "ok", listening: "ok", space: "ok" },
  loved: { warmth: "best", stay: "ok", listening: "ok", space: "ok" },
  space: { space: "best", stay: "ok", warmth: "ok", listening: "avoid" },
  vent: { listening: "best", stay: "ok", warmth: "ok", space: "ok" },
};

export function actionFit(need: HoldNeed, action: HoldAction): Fit {
  return FIT[need][action];
}

/** Gestures ordered best-fit first, with the ones to avoid left out. */
export function orderedActions(need: HoldNeed): { action: HoldAction; fit: Fit }[] {
  const order: HoldAction[] = ["stay", "warmth", "listening", "space"];
  const rank: Record<Fit, number> = { best: 0, ok: 1, avoid: 2 };
  return order
    .map((action) => ({ action, fit: actionFit(need, action) }))
    .filter((a) => a.fit !== "avoid")
    .sort((a, b) => rank[a.fit] - rank[b.fit]);
}

export type Viewer = "sender" | "recipient";

/** What the person looking at a session may do right now. */
export function allowedMoves(viewer: Viewer, status: HoldStatus) {
  return {
    respond: viewer === "recipient" && AWAITING_SUPPORT.includes(status),
    after: viewer === "sender" && status === "responded",
    close: viewer === "sender" && isLive(status),
    keep: viewer === "sender" && (status === "closed" || status === "expired"),
  };
}

/**
 * Only hand out the gentle WhatsApp heads-up when the sender would like
 * someone soon, the recipient hasn't turned Hold messages off, and it hasn't
 * gone out already. "When you have a moment" stays in-app (the 🔔 center).
 */
export function shouldNotifyRecipient(args: {
  timing: "whenever" | "soon";
  alreadyNotified: boolean;
  recipientOptedOut: boolean;
}): boolean {
  return args.timing === "soon" && !args.alreadyNotified && !args.recipientOptedOut;
}

/**
 * Whether the sender hears that a gesture arrived. Never for "gentle space" —
 * the whole point of that one is that nothing pings.
 */
export function shouldNotifySender(action: HoldAction, senderOptedOut: boolean): boolean {
  return action !== "space" && !senderOptedOut;
}

/** Read the per-person opt-out from profiles.notif_prefs (default: on). */
export function holdWhatsAppEnabled(prefs: Record<string, unknown> | null | undefined): boolean {
  return prefs?.hold_whatsapp !== false;
}

/** Map a database refusal to something kind to say. */
export function holdErrorMessage(raw: string | null | undefined): string {
  const m = raw ?? "";
  if (m.includes("hold_active_exists")) return "Kamu masih punya satu ruang yang terbuka. ♡";
  if (m.includes("hold_closed")) return "Ruang kecil ini sudah ditutup.";
  if (m.includes("hold_expired")) return "Ruang kecil ini sudah lewat waktunya.";
  if (m.includes("hold_already_responded")) return "Kamu sudah hadir di ruang ini. ♡";
  if (m.includes("hold_action_unfit")) return "Dia sedang butuh ruang — coba pilih yang lebih tenang.";
  if (m.includes("hold_no_partner")) return "Belum ada pasangan di ruang ini.";
  if (m.includes("hold_forbidden")) return "Ruang ini bukan untukmu.";
  if (m.includes("hold_bad_state")) return "Ruangnya sudah berubah. Muat ulang sebentar ya.";
  return "Ada yang tersendat. Coba lagi sebentar ya. ♡";
}
