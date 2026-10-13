import { periodEnd, type Period } from "@/lib/moon/cycle";

/**
 * her little moon. — what her check-ins say over time. Pure + tested
 * (insights.test.ts). Only counts and comparisons of what she actually
 * logged; below the thresholds it says "not enough yet" instead of a number.
 * Never a cause ("this is because of your period") — only "this showed up".
 */

export type Checkin = {
  day: string;
  cramps: number | null;
  headache: boolean;
  nausea: boolean;
  vomiting: boolean;
  fatigue: boolean;
  mood: string | null;
  energy: number | null;
  flow: string | null;
  note: string | null;
};

export type Symptom = "cramps" | "headache" | "nausea" | "vomiting" | "fatigue";
export const SYMPTOMS: readonly Symptom[] = ["cramps", "headache", "nausea", "vomiting", "fatigue"];

export function has(c: Checkin, s: Symptom): boolean {
  return s === "cramps" ? c.cramps !== null : c[s];
}

/** Below this many check-ins, frequencies aren't shown as patterns. */
export const MIN_CHECKINS = 5;
/** Each side of a comparison needs at least this many check-ins. */
export const MIN_PER_SIDE = 3;

export function symptomFrequency(checkins: readonly Checkin[]) {
  const total = checkins.length;
  return SYMPTOMS.map((s) => {
    const count = checkins.filter((c) => has(c, s)).length;
    return { symptom: s, count, share: total ? count / total : 0 };
  })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function moodCounts(checkins: readonly Checkin[]) {
  const m = new Map<string, number>();
  for (const c of checkins) if (c.mood) m.set(c.mood, (m.get(c.mood) ?? 0) + 1);
  return [...m.entries()].map(([mood, count]) => ({ mood, count })).sort((a, b) => b.count - a.count);
}

/** The cycle a day belongs to = the latest period start on or before it. */
export function cycleStartFor(day: string, periods: readonly Period[]): string | null {
  let found: string | null = null;
  for (const p of periods) if (p.start <= day && (!found || p.start > found)) found = p.start;
  return found;
}

export type CycleChange = { symptom: Symptom; previous: number; current: number };

/**
 * This cycle vs the one before, per symptom, as "days it was logged". Only
 * when both cycles have enough check-ins to compare fairly.
 */
export function cycleChanges(checkins: readonly Checkin[], periods: readonly Period[]): CycleChange[] | null {
  const starts = [...periods].map((p) => p.start).sort();
  if (starts.length < 2) return null;
  const currentStart = starts.at(-1)!;
  const previousStart = starts.at(-2)!;
  const cur = checkins.filter((c) => cycleStartFor(c.day, periods) === currentStart);
  const prev = checkins.filter((c) => cycleStartFor(c.day, periods) === previousStart);
  if (cur.length < MIN_PER_SIDE || prev.length < MIN_PER_SIDE) return null;
  return SYMPTOMS.map((s) => ({
    symptom: s,
    previous: prev.filter((c) => has(c, s)).length,
    current: cur.filter((c) => has(c, s)).length,
  })).filter((x) => x.previous > 0 || x.current > 0);
}

/**
 * How often each symptom appeared on period days vs other days — "this
 * tends to show up during your period", never "this is caused by it".
 */
export function duringVsOther(checkins: readonly Checkin[], periods: readonly Period[], today: string) {
  const onPeriod = (day: string) => periods.some((p) => day >= p.start && day <= periodEnd(p, today));
  const during = checkins.filter((c) => onPeriod(c.day));
  const other = checkins.filter((c) => !onPeriod(c.day));
  if (during.length < MIN_PER_SIDE || other.length < MIN_PER_SIDE) return null;
  return SYMPTOMS.map((s) => ({
    symptom: s,
    during: during.filter((c) => has(c, s)).length / during.length,
    other: other.filter((c) => has(c, s)).length / other.length,
  })).filter((x) => x.during > 0 || x.other > 0);
}

/**
 * Proportional safety: strong cramps or vomiting → a calm suggestion to
 * consider medical help. Says nothing about the cause.
 */
export function needsCareNote(c: Pick<Checkin, "cramps" | "vomiting">): boolean {
  return c.cramps === 3 || c.vomiting;
}

/** Vomiting on two or more of the last three logged days → a firmer note. */
export function repeatedVomiting(checkins: readonly Checkin[]): boolean {
  const recent = [...checkins].sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 3);
  return recent.filter((c) => c.vomiting).length >= 2;
}

/** A check-in needs at least one thing in it (mirrors moon_checkin_not_empty). */
export function isEmptyCheckin(c: Omit<Checkin, "day">): boolean {
  return (
    c.cramps === null &&
    !c.headache &&
    !c.nausea &&
    !c.vomiting &&
    !c.fatigue &&
    !c.mood &&
    c.energy === null &&
    !c.flow &&
    !(c.note && c.note.trim())
  );
}
