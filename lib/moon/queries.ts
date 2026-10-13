import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { localDateISO } from "@/lib/date";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { headsUpToday, summarize, type CycleSummary, type Period } from "@/lib/moon/cycle";
import { inAppDue, reminderTitle, type Reminder } from "@/lib/moon/reminders";

/**
 * her little moon. — reads. Everything of hers goes through the normal
 * (RLS-on) client, so the owner-only policies are what decide; the partner's
 * side is ONLY ever moon_partner_view() + the care requests she sent.
 */

type CheckinRow = Database["public"]["Tables"]["moon_checkins"]["Row"];
type ShareRow = Database["public"]["Tables"]["moon_share"]["Row"];
type ReminderRow = Database["public"]["Tables"]["moon_reminders"]["Row"];
type CareRow = Database["public"]["Tables"]["moon_care_requests"]["Row"];

export type MoonCheckin = CheckinRow;
export type MoonReminder = ReminderRow;
export type MoonCare = CareRow;
export type MoonShare = Pick<ShareRow, "share_phase" | "share_symptoms" | "partner_heads_up">;

export const NO_SHARE: MoonShare = { share_phase: false, share_symptoms: false, partner_heads_up: false };

/** A care request stays "current" for this long unless she closes it sooner. */
export const CARE_ACTIVE_HOURS = 48;

export function nowHM(timezone?: string | null): string {
  return format(new TZDate(Date.now(), timezone || "Asia/Jakarta"), "HH:mm");
}

const CHECKIN_COLS = "id, user_id, space_id, day, cramps, headache, nausea, vomiting, fatigue, mood, energy, flow, note, created_at, updated_at";

export type MoonData = {
  ready: boolean;
  today: string;
  periods: Period[];
  summary: CycleSummary;
  checkins: CheckinRow[];
  todayCheckin: CheckinRow | null;
  share: MoonShare;
  reminders: ReminderRow[];
  care: CareRow[];
};

export async function getMoonData(userId: string, timezone: string | null): Promise<MoonData> {
  const supabase = await createClient();
  const today = localDateISO(timezone);
  const [periods, checkins, share, reminders, care] = await Promise.all([
    supabase.from("moon_periods").select("id, start_date, end_date").eq("user_id", userId).order("start_date", { ascending: false }).limit(36),
    supabase.from("moon_checkins").select(CHECKIN_COLS).eq("user_id", userId).order("day", { ascending: false }).limit(240),
    supabase.from("moon_share").select("share_phase, share_symptoms, partner_heads_up").eq("user_id", userId).maybeSingle(),
    supabase.from("moon_reminders").select("*").eq("user_id", userId).order("at_time", { ascending: true }),
    supabase.from("moon_care_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(12),
  ]);
  const ps: Period[] = (periods.data ?? []).map((p) => ({ id: p.id, start: p.start_date, end: p.end_date }));
  const cs = checkins.data ?? [];
  return {
    ready: !periods.error,
    today,
    periods: ps,
    summary: summarize(ps, today),
    checkins: cs,
    todayCheckin: cs.find((c) => c.day === today) ?? null,
    share: share.data ?? NO_SHARE,
    reminders: reminders.data ?? [],
    care: care.data ?? [],
  };
}

export function isCareActive(c: Pick<CareRow, "closed_at" | "created_at">, now = Date.now()): boolean {
  return !c.closed_at && now - new Date(c.created_at).getTime() < CARE_ACTIVE_HOURS * 3600_000;
}

// ---- The partner's side ------------------------------------------------------

type PartnerViewRaw = {
  today: string;
  share_phase: boolean;
  share_symptoms: boolean;
  heads_up: boolean;
  periods?: { start: string; end: string | null }[];
  symptoms?: { cramps: number | null; headache: boolean; nausea: boolean; vomiting: boolean; fatigue: boolean } | null;
};

export type PartnerMoon = {
  /** What she allows, right now. All false → nothing is shown anywhere. */
  sharePhase: boolean;
  shareSymptoms: boolean;
  headsUp: boolean;
  onPeriod: boolean | null;
  expectedAround: { from: string; to: string } | null;
  /** True only on the day before / the expected day, and only with heads-up on. */
  headsUpNow: boolean;
  symptomsToday: PartnerViewRaw["symptoms"] | null;
  care: CareRow[];
};

/** Everything the partner may see. Never throws; with no sharing → only her requests. */
export async function getPartnerMoon(spaceId: string, userId: string): Promise<{ ready: boolean; view: PartnerMoon }> {
  const empty: PartnerMoon = {
    sharePhase: false,
    shareSymptoms: false,
    headsUp: false,
    onPeriod: null,
    expectedAround: null,
    headsUpNow: false,
    symptomsToday: null,
    care: [],
  };
  try {
    const supabase = await createClient();
    const [{ data: raw, error }, { data: care, error: careErr }] = await Promise.all([
      supabase.rpc("moon_partner_view", { p_space: spaceId }),
      supabase
        .from("moon_care_requests")
        .select("*")
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);
    if (careErr) return { ready: false, view: empty };
    const view: PartnerMoon = { ...empty, care: care ?? [] };
    if (error || !raw) return { ready: true, view };
    const r = raw as PartnerViewRaw;
    const summary = r.periods
      ? summarize(
          r.periods.map((p, i) => ({ id: String(i), start: p.start, end: p.end })),
          r.today,
        )
      : null;
    return {
      ready: true,
      view: {
        ...view,
        sharePhase: r.share_phase,
        shareSymptoms: r.share_symptoms,
        headsUp: r.heads_up,
        onPeriod: r.share_phase && summary ? summary.onPeriod : null,
        expectedAround:
          r.share_phase && summary?.prediction && !summary.onPeriod
            ? { from: summary.prediction.windowFrom, to: summary.prediction.windowTo }
            : null,
        headsUpNow: r.heads_up && !!summary && headsUpToday(summary, r.today),
        symptomsToday: r.share_symptoms ? (r.symptoms ?? null) : null,
      },
    };
  } catch {
    return { ready: false, view: empty };
  }
}

// ---- 🔔 notices (both sides). Cheap; never throws. ------------------------------

export type MoonNotice = {
  id: string;
  title: string;
  detail: string | null;
  href: string;
  at: string;
  reminderId?: string;
};

export async function getMoonNotices(
  spaceId: string,
  userId: string,
  timezone: string | null,
  role: "keeper" | "author",
): Promise<MoonNotice[]> {
  try {
    const supabase = await createClient();
    const today = localDateISO(timezone);
    const out: MoonNotice[] = [];

    // Her own reminders (owner-only rows — the partner's query returns none).
    const [{ data: reminders }, { data: todayCheck }] = await Promise.all([
      supabase.from("moon_reminders").select("*").eq("user_id", userId).eq("enabled", true),
      supabase.from("moon_checkins").select("id").eq("user_id", userId).eq("day", today).maybeSingle(),
    ]);
    const hm = nowHM(timezone);
    for (const r of (reminders ?? []) as Reminder[]) {
      if (!inAppDue(r, today, hm, !!todayCheck)) continue;
      out.push({
        id: `moon-r-${r.id}`,
        title: reminderTitle(r),
        detail: null,
        href: r.kind === "insights" ? "/moon/insights" : r.kind === "period" ? "/moon/calendar" : "/moon",
        at: new Date().toISOString(),
        reminderId: r.id,
      });
    }

    // His side: only what she sent or allowed.
    if (role === "author") {
      const { view } = await getPartnerMoon(spaceId, userId);
      for (const c of view.care) {
        if (!isCareActive(c) || c.acked_at) continue;
        out.push({ id: `moon-c-${c.id}`, title: "Dia ingin sedikit perhatianmu.", detail: null, href: "/moon", at: c.created_at });
      }
      if (view.headsUpNow) {
        out.push({
          id: "moon-heads-up",
          title: "Mungkin beberapa hari ini dia butuh sedikit perhatian lebih.",
          detail: "Dia sendiri yang mengizinkan pengingat ini.",
          href: "/moon",
          at: `${today}T00:00:00.000Z`,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}
