/**
 * her little moon. — cycle maths. Pure (plain `YYYY-MM-DD` strings in, no IO,
 * no clock): every number comes from what she actually logged, and every
 * estimate says how sure it is. Unit tested in cycle.test.ts.
 *
 * Deliberately NOT here: a 28-day default, ovulation, fertility, or anything
 * that sounds like a diagnosis. With one logged period there is no prediction
 * at all — only "log one more and I can start estimating".
 */

export type Period = { id: string; start: string; end: string | null };

/** Cycles outside this range are shown in history but left out of averages. */
export const MIN_CYCLE = 15;
export const MAX_CYCLE = 90;
export const MAX_PERIOD_DAYS = 21;
/** How many recent cycles the averages look at — patterns change over time. */
export const RECENT = 6;

export function diffDays(fromISO: string, toISO: string): number {
  const a = Date.UTC(+fromISO.slice(0, 4), +fromISO.slice(5, 7) - 1, +fromISO.slice(8, 10));
  const b = Date.UTC(+toISO.slice(0, 4), +toISO.slice(5, 7) - 1, +toISO.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** The last day a period covers, as far as we know (an ongoing one runs to today). */
export function periodEnd(p: Period, today: string): string {
  if (p.end) return p.end;
  return p.start > today ? p.start : today;
}

export type Cycle = { from: string; to: string; length: number; counted: boolean };

export type Confidence = "none" | "low" | "limited" | "varied" | "steady";

export type Prediction = {
  /** Most likely first day of the next period. */
  start: string;
  /** The honest range around it. */
  windowFrom: string;
  windowTo: string;
  /** Expected period days (only when we know her usual length). */
  days: { from: string; to: string } | null;
  confidence: Confidence;
  /** Today is past the expected start and no new period was logged. */
  daysLate: number;
};

export type CycleSummary = {
  periods: Period[]; // ascending
  cycles: Cycle[];
  periodLengths: { start: string; days: number }[];
  /** Counted cycles used for the averages (most recent first). */
  usedCycles: number[];
  avgCycle: number | null;
  avgPeriod: number | null;
  /** Shortest → longest of the recent counted cycles. */
  range: { min: number; max: number } | null;
  /** The recent cycles differ by more than a week. Shown as "varies", never as a problem. */
  varied: boolean;
  current: Period | null;
  onPeriod: boolean;
  /** Day N of the current cycle (day 1 = first day of the last period). */
  cycleDay: number | null;
  prediction: Prediction | null;
  /** Logged periods so far — how much the estimates can lean on. */
  dataPoints: number;
};

export function summarize(input: readonly Period[], today: string): CycleSummary {
  const periods = [...input].filter((p) => p.start <= today).sort((a, b) => (a.start < b.start ? -1 : 1));

  const cycles: Cycle[] = [];
  for (let i = 1; i < periods.length; i++) {
    const length = diffDays(periods[i - 1].start, periods[i].start);
    cycles.push({ from: periods[i - 1].start, to: periods[i].start, length, counted: length >= MIN_CYCLE && length <= MAX_CYCLE });
  }

  const periodLengths = periods
    .filter((p) => p.end && p.end <= today)
    .map((p) => ({ start: p.start, days: diffDays(p.start, p.end!) + 1 }));

  const usedCycles = cycles
    .filter((c) => c.counted)
    .slice(-RECENT)
    .map((c) => c.length)
    .reverse();
  const recentPeriods = periodLengths.slice(-RECENT).map((p) => p.days);

  const avgCycle = usedCycles.length ? Math.round(mean(usedCycles)) : null;
  const avgPeriod = recentPeriods.length ? Math.round(mean(recentPeriods)) : null;
  const range = usedCycles.length >= 2 ? { min: Math.min(...usedCycles), max: Math.max(...usedCycles) } : null;
  const varied = usedCycles.length >= 3 && !!range && range.max - range.min > 7;

  const current = periods.at(-1) ?? null;
  const onPeriod = !!current && today >= current.start && today <= periodEnd(current, today);
  const sinceStart = current ? diffDays(current.start, today) + 1 : null;
  const cycleDay = sinceStart !== null && sinceStart <= MAX_CYCLE + 30 ? sinceStart : null;

  let prediction: Prediction | null = null;
  if (current && avgCycle) {
    const start = addDays(current.start, avgCycle);
    const confidence: Confidence =
      usedCycles.length === 1 ? "low" : usedCycles.length < 3 ? "limited" : varied ? "varied" : "steady";
    const half =
      confidence === "low" ? 4 : confidence === "limited" ? 3 : Math.min(7, Math.max(2, Math.ceil(((range?.max ?? 0) - (range?.min ?? 0)) / 2)));
    const late = !onPeriod && today > start ? diffDays(start, today) : 0;
    prediction = {
      start,
      windowFrom: addDays(start, -half),
      windowTo: addDays(start, half),
      days: avgPeriod ? { from: start, to: addDays(start, avgPeriod - 1) } : null,
      confidence,
      daysLate: late,
    };
  }

  return {
    periods,
    cycles,
    periodLengths,
    usedCycles,
    avgCycle,
    avgPeriod,
    range,
    varied,
    current,
    onPeriod,
    cycleDay,
    prediction,
    dataPoints: periods.length,
  };
}

export type DayKind = "period" | "predicted" | "window" | null;

/**
 * What a calendar day shows. Logged days always win; predictions are only
 * drawn from today forward (a past guess that didn't happen isn't history).
 */
export function dayKind(iso: string, s: CycleSummary, today: string): DayKind {
  for (const p of s.periods) {
    if (iso >= p.start && iso <= periodEnd(p, today)) return "period";
  }
  const pr = s.prediction;
  if (!pr || iso < today || s.onPeriod) return null;
  if (pr.days && iso >= pr.days.from && iso <= pr.days.to) return "predicted";
  if (iso >= pr.windowFrom && iso <= pr.windowTo) return "window";
  return null;
}

export type PeriodProblem = "future_start" | "future_end" | "end_before_start" | "too_long" | "overlap" | "ongoing_exists";

/** Validate a new or edited period against the others (the DB checks overlap again). */
export function periodProblem(
  candidate: { id?: string; start: string; end: string | null },
  others: readonly Period[],
  today: string,
): PeriodProblem | null {
  if (candidate.start > today) return "future_start";
  if (candidate.end) {
    if (candidate.end > today) return "future_end";
    if (candidate.end < candidate.start) return "end_before_start";
    if (diffDays(candidate.start, candidate.end) + 1 > MAX_PERIOD_DAYS) return "too_long";
  }
  const rest = others.filter((o) => o.id !== candidate.id);
  if (!candidate.end && rest.some((o) => !o.end)) return "ongoing_exists";
  const cEnd = candidate.end ?? (candidate.start > today ? candidate.start : today);
  for (const o of rest) {
    const oEnd = periodEnd(o, today);
    if (candidate.start <= oEnd && o.start <= cEnd) return "overlap";
  }
  return null;
}

export const PERIOD_PROBLEM_TEXT: Record<PeriodProblem, string> = {
  future_start: "Tanggal mulainya belum terjadi. Catat saat sudah dimulai, ya.",
  future_end: "Tanggal selesainya belum terjadi — biarkan “masih berlangsung” dulu.",
  end_before_start: "Tanggal selesai harus sesudah tanggal mulai.",
  too_long: `Lebih dari ${MAX_PERIOD_DAYS} hari — coba cek lagi tanggalnya.`,
  overlap: "Tanggal ini bertumpuk dengan catatan menstruasi lain.",
  ongoing_exists: "Masih ada menstruasi yang belum ditandai selesai. Tandai dulu yang itu.",
};

/** A very long "still going" period is usually a forgotten end date. */
export function looksForgotten(s: CycleSummary, today: string): boolean {
  return !!s.current && !s.current.end && diffDays(s.current.start, today) + 1 > 10;
}

/** "Expected soon" — a day before up to the expected start (heads-up for the partner). */
export function headsUpToday(s: CycleSummary, today: string): boolean {
  const pr = s.prediction;
  if (!pr || s.onPeriod || pr.daysLate > 0) return false;
  const d = diffDays(today, pr.start);
  return d >= 0 && d <= 1;
}
