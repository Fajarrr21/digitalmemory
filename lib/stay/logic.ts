import type { StayGiftKind, StayObjectKind } from "@/lib/supabase/database.types";

/**
 * stay, my love. — the rules that aren't furniture. Pure + unit tested
 * (logic.test.ts); the database (0020) is the final say.
 */

export type GiftLike = {
  id: string;
  kind: StayGiftKind;
  opened_at: string | null;
  put_away_at: string | null;
  created_at: string;
};

/** How many gifts sit on the bedside table at once; the rest live in the little box. */
export const TABLE_SLOTS = 4;

/**
 * What's on the table vs. in the little box. The table holds the newest
 * gifts that haven't been put away — unopened first, so nothing new can be
 * pushed off the table by older things.
 */
export function arrangeTable<T extends GiftLike>(gifts: readonly T[]): { table: T[]; box: T[] } {
  const out = gifts.filter((g) => !g.put_away_at);
  const sorted = [...out].sort((a, b) => {
    const ua = a.opened_at ? 1 : 0;
    const ub = b.opened_at ? 1 : 0;
    if (ua !== ub) return ua - ub;
    return a.created_at < b.created_at ? 1 : -1;
  });
  const table = sorted.slice(0, TABLE_SLOTS);
  const onTable = new Set(table.map((g) => g.id));
  const box = gifts
    .filter((g) => !onTable.has(g.id))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return { table, box };
}

/**
 * The little light beside the bed. Accurate, never hopeful:
 *   together — the other person really is in their room right now (Realtime presence)
 *   warm     — something was left for you and you haven't opened it yet
 *   quiet    — nothing waiting; the light just stays on
 */
export type LightState = "together" | "warm" | "quiet";

export function presenceLight(args: { partnerHere: boolean; unopened: number }): LightState {
  if (args.partnerHere) return "together";
  if (args.unopened > 0) return "warm";
  return "quiet";
}

/** The comfort message the "you can rest here" scene ends with — the newest one still out. */
export function latestComfort<T extends GiftLike & { body: string | null }>(gifts: readonly T[]): T | null {
  return (
    [...gifts]
      .filter((g) => g.kind === "comfort" && !g.put_away_at && g.body)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0] ?? null
  );
}

export const LIMITS = {
  note: 1000,
  comfort: 300,
  line: 140,
} as const;

export type GiftDraft =
  | { kind: "note"; body: string }
  | { kind: "comfort"; body: string }
  | { kind: "object"; objectKind: StayObjectKind; body: string }
  | { kind: "voice"; body: string; seconds: number };

/** Validate a draft before anything is uploaded or sent. Returns an error key or null. */
export function giftProblem(d: GiftDraft): "empty" | "too_long" | "no_voice" | null {
  const body = d.body.trim();
  switch (d.kind) {
    case "note":
      if (!body) return "empty";
      return body.length > LIMITS.note ? "too_long" : null;
    case "comfort":
      if (!body) return "empty";
      return body.length > LIMITS.comfort ? "too_long" : null;
    case "object":
      return body.length > LIMITS.line ? "too_long" : null;
    case "voice":
      if (!(d.seconds >= 1)) return "no_voice";
      return body.length > LIMITS.line ? "too_long" : null;
  }
}

/** Gifts that were just left (arrived after `since`) — for the soft glow. */
export function arrivedSince<T extends GiftLike>(gifts: readonly T[], since: string | null): T[] {
  if (!since) return [];
  return gifts.filter((g) => g.created_at > since && !g.opened_at);
}

/** Read the per-person WhatsApp opt-out from profiles.notif_prefs (default: on). */
export function stayWhatsAppEnabled(prefs: Record<string, unknown> | null | undefined): boolean {
  return prefs?.stay_whatsapp !== false;
}

/**
 * At most one WhatsApp heads-up per few hours, however many little things
 * are left — a room shouldn't buzz someone's phone like a chat.
 */
export const NOTIFY_QUIET_HOURS = 3;

export function shouldNotify(args: { lastNotifiedAt: string | null; now?: Date; optedOut: boolean }): boolean {
  if (args.optedOut) return false;
  if (!args.lastNotifiedAt) return true;
  const now = (args.now ?? new Date()).getTime();
  return now - new Date(args.lastNotifiedAt).getTime() >= NOTIFY_QUIET_HOURS * 3600 * 1000;
}

export function stayErrorMessage(raw: string | null | undefined): string {
  const m = raw ?? "";
  if (m.includes("stay_room_full")) return "Kamarnya sudah penuh hadiah. Minta dia menyimpan sebagian dulu, ya. ♡";
  if (m.includes("stay_forbidden") || m.includes("row-level security")) return "Ini bukan untukmu.";
  if (m.includes("stay_invalid")) return "Ada yang belum lengkap. ♡";
  return "Ada yang tersendat. Coba lagi sebentar ya. ♡";
}
