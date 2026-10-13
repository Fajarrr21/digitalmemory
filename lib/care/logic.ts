import type {
  CareKind,
  CareRedFlag,
  CareSeverity,
  CareStatus,
  CareSymptom,
  CareWant,
} from "@/lib/supabase/database.types";

/**
 * Little Care — the pure rules. No IO, so they're unit tested (logic.test.ts)
 * and shared by the server actions and the UI. The database (migration 0019)
 * enforces the same rules authoritatively; this mirror only keeps the screen
 * from offering a step the database would refuse.
 *
 * NOTHING here diagnoses. The safety level is not "how sick you are" — it is
 * only "should this screen point you to real medical help". Choosing a mild
 * severity never means it's safe; it only means we don't raise our voice.
 */

/** How loudly the screen should point to medical help. */
export type SafetyLevel = "none" | "check" | "urgent";

/**
 * Any warning sign → urgent (seek medical help now). A "severe" severity on
 * its own → check (please get it looked at). Nausea alongside a severe
 * severity is treated as urgent too: repeated vomiting with strong pain is
 * exactly what should never be waited out in an app.
 */
export function safetyLevel(args: {
  severity: CareSeverity | null;
  redFlags: readonly CareRedFlag[];
  symptoms?: readonly CareSymptom[];
}): SafetyLevel {
  if (args.redFlags.length > 0) return "urgent";
  if (args.severity === "severe") {
    return args.symptoms?.includes("nausea") ? "urgent" : "check";
  }
  return "none";
}

/** Drinks are only ever offered sip-by-sip when there's nausea/vomiting. */
export function sipGently(symptoms: readonly CareSymptom[] | null | undefined): boolean {
  return !!symptoms?.includes("nausea");
}

/** Statuses in which the session is still alive. */
export const LIVE: readonly CareStatus[] = ["open", "resting"];

export function isLive(status: CareStatus): boolean {
  return LIVE.includes(status);
}

/** Mirrors care_is_expired: a live session past its quiet window is over. */
export function effectiveStatus(
  s: { status: CareStatus; expires_at: string },
  now: Date = new Date(),
): CareStatus {
  if (isLive(s.status) && new Date(s.expires_at).getTime() <= now.getTime()) return "expired";
  return s.status;
}

/** The Care Orb's phase — symbolic only, never a health indicator. */
export type OrbPhase = "idle" | "waiting" | "cared" | "resting" | "ended";

export function orbPhase(status: CareStatus | null, hasCare: boolean): OrbPhase {
  if (status === null) return "idle";
  if (status === "closed" || status === "expired") return "ended";
  if (status === "resting") return "resting";
  return hasCare ? "cared" : "waiting";
}

/**
 * Is the carer being waited for? Before any care has arrived, or after the
 * sender asked for "a little longer" since the last care.
 */
export function waitingForCarer(s: {
  status: CareStatus;
  expires_at: string;
  last_care_at: string | null;
  after_choice: string | null;
  after_at: string | null;
}, now: Date = new Date()): boolean {
  if (!isLive(effectiveStatus(s, now))) return false;
  if (!s.last_care_at) return true;
  return s.after_choice === "longer" && !!s.after_at && s.after_at > s.last_care_at;
}

/** What the carer may do right now. Mirrors the checks in care_act. */
export function canCare(
  kind: CareKind,
  status: CareStatus,
  restNoteUsed: boolean,
): { ok: true } | { ok: false; reason: "ended" | "resting" | "rest_note_used" } {
  if (!isLive(status)) return { ok: false, reason: "ended" };
  if (status === "resting") {
    if (kind === "accompany") return { ok: false, reason: "resting" };
    if (kind === "message" && restNoteUsed) return { ok: false, reason: "rest_note_used" };
  }
  return { ok: true };
}

export type CareChoice = { kind: CareKind; variant: string | null };

/**
 * The carer's actions, best-fit first for what was asked. When the sender
 * agreed to say it may need a medical check, real help comes first of all.
 */
export function suggestedCare(wants: readonly CareWant[], needsCheck: boolean): CareChoice[] {
  const out: CareChoice[] = [];
  const push = (c: CareChoice) => {
    if (!out.some((o) => o.kind === c.kind && o.variant === c.variant)) out.push(c);
  };
  if (needsCheck) push({ kind: "help", variant: "medical" });
  for (const w of wants) {
    if (w === "warm") push({ kind: "gesture", variant: "glow" });
    if (w === "drink") push({ kind: "help", variant: "drink" });
    if (w === "stay") push({ kind: "accompany", variant: "chat" });
    if (w === "quiet") push({ kind: "rest", variant: null });
    if (w === "surprise") push({ kind: "gesture", variant: "hug" });
  }
  return out;
}

/**
 * The sender hears "someone is here" once per session, on the first care —
 * never while resting, never when they asked for quiet time, and never for
 * "I'll let you rest" (the point of that one is that nothing pings).
 */
export function shouldNotifySender(args: {
  first: boolean;
  kind: CareKind;
  status: CareStatus;
  wants: readonly CareWant[];
  alreadyNotified: boolean;
}): boolean {
  return (
    args.first &&
    !args.alreadyNotified &&
    args.kind !== "rest" &&
    args.status === "open" &&
    !args.wants.includes("quiet")
  );
}

/** Read the per-person opt-out from profiles.notif_prefs (default: on). */
export function careWhatsAppEnabled(prefs: Record<string, unknown> | null | undefined): boolean {
  return prefs?.care_whatsapp !== false;
}

/** Map a database refusal to something kind to say. */
export function careErrorMessage(raw: string | null | undefined): string {
  const m = raw ?? "";
  if (m.includes("care_active_exists")) return "Kamu masih punya satu Little Care yang terbuka. ♡";
  if (m.includes("care_closed")) return "Little Care ini sudah ditutup.";
  if (m.includes("care_expired")) return "Little Care ini sudah lewat waktunya.";
  if (m.includes("care_resting")) return "Dia sedang istirahat — tawaran ngobrol disimpan dulu ya.";
  if (m.includes("care_rest_note_used"))
    return "Selama dia istirahat, cukup satu pesan untuk dibaca nanti. ♡";
  if (m.includes("care_too_many")) return "Sudah banyak sekali perhatian di sini. Biarkan dia istirahat dulu. ♡";
  if (m.includes("care_no_partner")) return "Belum ada pasangan di ruang ini.";
  if (m.includes("care_forbidden")) return "Ruang ini bukan untukmu.";
  if (m.includes("care_bad_state")) return "Ruangnya sudah berubah. Muat ulang sebentar ya.";
  if (m.includes("care_invalid")) return "Ada pilihan yang belum lengkap. ♡";
  return "Ada yang tersendat. Coba lagi sebentar ya. ♡";
}
