/**
 * Sejauh Ini, Kita — pure road maths. No I/O here so it's unit-testable.
 *
 * The road is never stored. Every footprint is derived on read from the tables
 * that already own it (letters, memories, photobooth, watch, flame…), so the
 * road grows by itself whenever either of you lives a little inside the app.
 * This module only decides which of those things become a footprint, in what
 * order, and what "how far we've come" adds up to.
 */

export type FootprintKind =
  | "start" // 🌱 the first day this little place was opened
  | "letter" // 💌 a direct letter (a sequence counts as one footprint)
  | "daily-letter" // ✉️ the first daily letter that was opened
  | "memory" // 🌷 an Our Little Universe memory
  | "photobooth" // 📸 a finished Both-of-Us booth session
  | "watch" // 🎬 a saved Watch Together memory
  | "album" // 🖼️ an album made
  | "voice" // 🎙️ the first voice note
  | "rating" // 📝 the first time a day was rated
  | "coloring" // 🎨 the first coloured day
  | "meanwhile" // 🌙 a Meanwhile moment that was shared
  | "song" // 🎧 a song shared in a Meanwhile moment
  | "flame"; // 🕯️ a flame milestone reached for the first time

export type FootprintPreview = {
  /** Signed image URL (a photo, a poster). */
  image?: string | null;
  /** A short excerpt to read in the little preview. */
  text?: string | null;
  /** Spotify track id → rendered as the official embed. */
  spotifyTrackId?: string | null;
  /** Signed audio URL (a voice note). */
  audio?: string | null;
  /** A letter still sealed for the viewer — the road keeps its secret too. */
  sealed?: boolean;
};

export type Footprint = {
  id: string;
  kind: FootprintKind;
  /** Plain calendar date, `YYYY-MM-DD`. */
  date: string;
  /** What the thing itself is called (a letter title, a memory title…). */
  label: string | null;
  /** Who left it — null when it belongs to both of you. */
  byId: string | null;
  /** Where "Open →" goes, inside the app. */
  href: string | null;
  preview?: FootprintPreview;
  /** First of its kind on the road — "The First Letter", "Our First Watch"… */
  first?: boolean;
  /** For a grouped footprint: how many things it stands for (a letter sequence). */
  count?: number;
};

/**
 * Kinds that would flood the road if every one became a footprint (a rating a
 * day for a year is 365 stones). For these only the first one walks onto the
 * road; the rest still count in "how far we've come".
 */
export const FIRST_ONLY: ReadonlySet<FootprintKind> = new Set<FootprintKind>([
  "start",
  "daily-letter",
  "voice",
  "rating",
  "coloring",
]);

/** Stable order for things that happened on the same day. */
const KIND_ORDER: FootprintKind[] = [
  "start",
  "rating",
  "daily-letter",
  "letter",
  "song",
  "voice",
  "meanwhile",
  "coloring",
  "memory",
  "album",
  "photobooth",
  "watch",
  "flame",
];

function kindRank(k: FootprintKind): number {
  const i = KIND_ORDER.indexOf(k);
  return i < 0 ? KIND_ORDER.length : i;
}

/** Chronological, oldest first; same-day ties broken by kind, then id. */
export function compareFootprints(a: Footprint, b: Footprint): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const k = kindRank(a.kind) - kindRank(b.kind);
  if (k !== 0) return k;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Candidates → the road. Sorts chronologically, keeps only the first of the
 * FIRST_ONLY kinds, and marks the first footprint of every kind.
 */
export function buildRoad(candidates: Footprint[]): Footprint[] {
  const sorted = [...candidates].sort(compareFootprints);
  const seen = new Set<FootprintKind>();
  const road: Footprint[] = [];
  for (const f of sorted) {
    const isFirst = !seen.has(f.kind);
    if (!isFirst && FIRST_ONLY.has(f.kind)) continue;
    seen.add(f.kind);
    road.push({ ...f, first: isFirst });
  }
  return road;
}

export type LetterRow = {
  id: string;
  batchId: string | null;
  sortIndex: number;
  date: string;
};

/**
 * A sequence of letters sent at once is one moment, not ten. Groups by
 * `batch_id` (singles stay single) and keeps the first letter of each group as
 * the representative, with `count` = how many letters it stands for.
 */
export function groupLetters<T extends LetterRow>(rows: T[]): { lead: T; count: number }[] {
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    const key = r.batchId ?? `single:${r.id}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  return [...groups.values()].map((list) => {
    const ordered = [...list].sort((a, b) => a.sortIndex - b.sortIndex);
    return { lead: ordered[0], count: list.length };
  });
}

function nextISO(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * The day each flame milestone was first reached. Mirrors Our Little Flame's
 * rules: a flame day (both showed up) adds one, a bridged (restored) day lets
 * the streak carry across without adding, anything else puts it out.
 * Each milestone is reported once — the first time it was ever reached.
 */
export function flameMilestoneDates(
  flameDays: string[],
  bridgedDays: string[],
  milestones: number[],
): { day: number; date: string }[] {
  const flame = new Set(flameDays);
  const bridged = new Set(bridgedDays);
  const all = [...flame, ...bridged].sort();
  if (all.length === 0) return [];

  const wanted = [...milestones].sort((a, b) => a - b);
  const reached = new Map<number, string>();
  const last = all[all.length - 1];
  let streak = 0;

  for (let d = all[0]; d <= last; d = nextISO(d)) {
    if (flame.has(d)) {
      streak += 1;
      for (const m of wanted) {
        if (streak === m && !reached.has(m)) reached.set(m, d);
      }
    } else if (!bridged.has(d)) {
      streak = 0;
    }
  }

  return wanted.filter((m) => reached.has(m)).map((m) => ({ day: m, date: reached.get(m)! }));
}

/** Calendar days from `start` to `today`, counting both ends (same day = 1). */
export function daysTogether(start: string | null, today: string): number {
  if (!start || start > today) return 0;
  const a = Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1, +start.slice(8, 10));
  const b = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Footprints added on or after `sinceISO` — "the road grew this week". */
export function footprintsSince(road: Footprint[], sinceISO: string): Footprint[] {
  return road.filter((f) => f.date >= sinceISO);
}

export type JourneyStatKey =
  | "days"
  | "letters"
  | "memories"
  | "watch"
  | "photobooth"
  | "moments"
  | "flame"
  | "songs"
  | "voice";

export type JourneyStat = { key: JourneyStatKey; value: number };

/**
 * The numbers for "Look how far we've come". Not achievements — only the ones
 * that are actually more than zero, in the order they should be read.
 */
export function journeyStats(counts: Partial<Record<JourneyStatKey, number>>): JourneyStat[] {
  const order: JourneyStatKey[] = [
    "days",
    "letters",
    "memories",
    "watch",
    "photobooth",
    "flame",
    "songs",
    "voice",
    "moments",
  ];
  return order
    .map((key) => ({ key, value: Math.max(0, Math.floor(counts[key] ?? 0)) }))
    .filter((s) => s.value > 0);
}
