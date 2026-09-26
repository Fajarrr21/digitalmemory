/**
 * Our Little Flame — pure streak math. No I/O here so it's unit-testable.
 *
 * A "flame day" is a day BOTH members were present. A recovery "bridges" one
 * missed day so the streak continues across it (the bridged day itself adds
 * nothing to the count). Everything below is derived from three sets of ISO
 * dates — presence of each member and the bridged days.
 */

export type FlameStatus =
  /** Both showed up today — the flame is lit. */
  | "lit"
  /** The flame is alive (through yesterday) and today isn't complete yet. */
  | "waiting"
  /** The streak just broke (one missed day) and can still be restored. */
  | "quiet"
  /** No live flame — a new one can be lit. */
  | "out";

export type FlameRun = { start: string; end: string; length: number };

export type FlameState = {
  status: FlameStatus;
  /** Current streak (0 when quiet/out). */
  streak: number;
  todayYou: boolean;
  todayPartner: boolean;
  /**
   * When exactly one missed day separates today from a previous streak, that
   * streak can be brought back by patching `gapDay`. Present even when a new
   * Day-1 spark already started today.
   */
  restorable: { gapDay: string; priorStreak: number } | null;
  /** All completed + current runs, newest first. */
  runs: FlameRun[];
};

export function prevDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function nextDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function computeFlame(input: {
  today: string;
  you: Set<string>;
  partner: Set<string>;
  bridged: Set<string>;
}): FlameState {
  const { today, you, partner, bridged } = input;
  const isFlame = (d: string) => you.has(d) && partner.has(d);
  const isBridge = (d: string) => bridged.has(d);

  /** Streak of flame days ending at `d`, walking back across bridges. */
  function streakEndingAt(d: string): number {
    let count = 0;
    let cur = d;
    for (let i = 0; i < 4000; i++) {
      if (isFlame(cur)) count++;
      else if (!isBridge(cur)) break;
      cur = prevDay(cur);
    }
    return count;
  }

  const todayYou = you.has(today);
  const todayPartner = partner.has(today);
  const yesterday = prevDay(today);

  // Restorable: yesterday is a hole (not flame, not yet bridged) but the day
  // before it closes out a real streak.
  const restorable =
    !isFlame(yesterday) && !isBridge(yesterday) && streakEndingAt(prevDay(yesterday)) > 0
      ? { gapDay: yesterday, priorStreak: streakEndingAt(prevDay(yesterday)) }
      : null;

  let status: FlameStatus;
  let streak: number;
  if (isFlame(today)) {
    status = "lit";
    streak = streakEndingAt(today);
  } else if (isFlame(yesterday) || (isBridge(yesterday) && streakEndingAt(yesterday) > 0)) {
    status = "waiting";
    streak = streakEndingAt(yesterday);
  } else if (restorable) {
    status = "quiet";
    streak = 0;
  } else {
    status = "out";
    streak = 0;
  }

  return {
    status,
    streak,
    todayYou,
    todayPartner,
    restorable,
    runs: buildRuns(today, isFlame, isBridge, you, partner),
  };
}

/** Group flame days (joined across bridges) into runs, newest first. */
function buildRuns(
  today: string,
  isFlame: (d: string) => boolean,
  isBridge: (d: string) => boolean,
  you: Set<string>,
  partner: Set<string>,
): FlameRun[] {
  const all = [...you, ...partner].sort();
  if (all.length === 0) return [];
  const first = all[0];

  const runs: FlameRun[] = [];
  let run: FlameRun | null = null;

  let cur = first;
  for (let i = 0; i < 4000 && cur <= today; i++) {
    if (isFlame(cur)) {
      if (run) {
        run.end = cur;
        run.length++;
      } else {
        run = { start: cur, end: cur, length: 1 };
      }
    } else if (!(isBridge(cur) && run)) {
      // A plain hole closes the run; a bridge keeps it open.
      if (run) runs.push(run);
      run = null;
    }
    cur = nextDay(cur);
  }
  if (run) runs.push(run);
  return runs.reverse();
}
