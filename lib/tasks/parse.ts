/**
 * Quick Add — turn "PR matematika besok jam 8" into a little thing to do.
 *
 * Deliberately NOT AI: a small, predictable Indonesian/English parser that runs
 * in the browser, offline, instantly. It only ever *suggests* — the parsed date
 * and time land in the form and the user confirms before anything is saved
 * (PLAN §13). If it understands nothing, the whole text becomes the title and
 * the due date falls back to today.
 */

import { addDaysISO } from "@/lib/date";

export type ParsedTask = {
  title: string;
  dueDate: string;
  dueTime: string | null;
  emoji: string;
  /** Which parts were actually understood — the UI only claims these. */
  matched: { date: boolean; time: boolean };
};

const WEEKDAYS: Record<string, number> = {
  minggu: 0, ahad: 0, sunday: 0,
  senin: 1, monday: 1,
  selasa: 2, tuesday: 2,
  rabu: 3, wednesday: 3,
  kamis: 4, thursday: 4,
  jumat: 5, "jum'at": 5, friday: 5,
  sabtu: 6, saturday: 6,
};

const MONTHS: Record<string, number> = {
  januari: 1, january: 1, jan: 1,
  februari: 2, february: 2, feb: 2,
  maret: 3, march: 3, mar: 3,
  april: 4, apr: 4,
  mei: 5, may: 5,
  juni: 6, june: 6, jun: 6,
  juli: 7, july: 7, jul: 7,
  agustus: 8, august: 8, agu: 8, agt: 8, ags: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  oktober: 10, october: 10, okt: 10, oct: 10,
  november: 11, nov: 11,
  desember: 12, december: 12, des: 12, dec: 12,
};

/** A little icon guessed from what the thing actually is. */
const EMOJI_HINTS: [RegExp, string][] = [
  [/\b(pr|tugas|homework|assignment|essay|skripsi|makalah)\b/i, "\u{1F4DA}"],
  [/\b(presentasi|presentation|meeting|rapat|kelas|class|janji)\b/i, "\u{1F4C5}"],
  [/\b(beli|belanja|buy|shop|groceries)\b/i, "\u{1F6CD}️"],
  [/\b(bayar|pay|tagihan|bill|transfer)\b/i, "\u{1F4B3}"],
  [/\b(obat|medicine|vitamin|minum air|drink water)\b/i, "\u{1F48A}"],
  [/\b(ulang ?tahun|ultah|birthday|anniversary)\b/i, "\u{1F382}"],
  [/\b(balas|reply|kirim|send|surat|letter|chat)\b/i, "\u{1F48C}"],
  [/\b(foto|photo|upload|album)\b/i, "\u{1F4F8}"],
  [/\b(packing|berangkat|pergi|trip|travel|kereta|pesawat)\b/i, "\u{1F9F3}"],
  [/\b(kerja|kerjaan|work|deadline|laporan|report)\b/i, "\u{1F4BC}"],
];

/** The plain little default — a note to self. */
export const DEFAULT_EMOJI = "\u{1F4DD}";

function guessEmoji(text: string): string {
  for (const [re, emoji] of EMOJI_HINTS) if (re.test(text)) return emoji;
  return DEFAULT_EMOJI;
}

/** Remove one matched phrase from the text, keeping the rest readable. */
function cut(text: string, match: string): string {
  const i = text.toLowerCase().indexOf(match.toLowerCase());
  if (i < 0) return text;
  return `${text.slice(0, i)} ${text.slice(i + match.length)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function weekdayOf(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

/**
 * Bare hours ("jam 8") are taken literally — 08:00. A period word shifts them:
 * sore/malam/pm push to the afternoon side, pagi keeps the morning.
 */
function toHour24(hour: number, period: string | undefined): number {
  // Compared whole-word: "malam" contains "am", so a substring test lies.
  const p = (period ?? "").toLowerCase();
  if (p === "pagi" || p === "am") return hour === 12 ? 0 : hour;
  if (p === "siang") return hour < 11 ? hour + 12 : hour;
  if (p === "sore" || p === "malam" || p === "pm") return hour < 12 ? hour + 12 : hour;
  return hour % 24;
}

type TimeMatch = { text: string; hour: number; minute: number; period?: string };

function matchTime(text: string): TimeMatch | null {
  const keyed =
    /\b(?:jam|pukul|at)\s*(\d{1,2})(?:[.:](\d{2}))?\s*(pagi|siang|sore|malam|am|pm)?\b/i.exec(
      text,
    );
  const clocked = /\b(\d{1,2})[.:](\d{2})\s*(pagi|siang|sore|malam|am|pm)?\b/i.exec(text);
  const m = keyed ?? clocked;
  if (m) {
    return { text: m[0], hour: Number(m[1]), minute: m[2] ? Number(m[2]) : 0, period: m[3] };
  }
  const periodOnly = /\b(\d{1,2})\s*(pagi|siang|sore|malam|am|pm)\b/i.exec(text);
  if (periodOnly) {
    return {
      text: periodOnly[0],
      hour: Number(periodOnly[1]),
      minute: 0,
      period: periodOnly[2],
    };
  }
  return null;
}

/** "30 september" anywhere in the text — the first one that names a real month. */
function matchDayMonth(text: string): { text: string; day: number; month: number } | null {
  for (const m of text.matchAll(/\b(?:tanggal\s*)?(\d{1,2})\s+([a-z']+)\b/gi)) {
    const month = MONTHS[m[2].toLowerCase()];
    const day = Number(m[1]);
    if (month && day >= 1 && day <= 31) return { text: m[0], day, month };
  }
  return null;
}

export function parseQuickAdd(input: string, today: string): ParsedTask {
  let rest = input.trim();
  let dueDate: string | null = null;
  let dueTime: string | null = null;

  // ---- time -----------------------------------------------------------------
  const time = matchTime(rest);
  if (time && time.hour <= 24 && time.minute < 60) {
    dueTime = `${pad(toHour24(time.hour, time.period) % 24)}:${pad(time.minute)}`;
    rest = cut(rest, time.text);
  }

  // ---- explicit dates -------------------------------------------------------
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(rest);
  const dayMonth = matchDayMonth(rest);
  const numeric = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(rest);
  const dayOnly = /\btanggal\s*(\d{1,2})\b/i.exec(rest);

  if (iso) {
    dueDate = `${iso[1]}-${iso[2]}-${iso[3]}`;
    rest = cut(rest, iso[0]);
  } else if (dayMonth) {
    dueDate = resolveDayMonth(today, dayMonth.day, dayMonth.month);
    rest = cut(rest, dayMonth.text);
  } else if (numeric && Number(numeric[1]) <= 31 && Number(numeric[2]) <= 12) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const year = numeric[3]
      ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3])
      : null;
    dueDate = year
      ? `${year}-${pad(month)}-${pad(day)}`
      : resolveDayMonth(today, day, month);
    rest = cut(rest, numeric[0]);
  } else if (dayOnly && Number(dayOnly[1]) <= 31) {
    dueDate = resolveDayMonth(today, Number(dayOnly[1]), Number(today.slice(5, 7)));
    rest = cut(rest, dayOnly[0]);
  }

  // ---- relative words -------------------------------------------------------
  if (!dueDate) {
    const relatives: [RegExp, number][] = [
      [/\b(hari ini|today)\b/i, 0],
      [/\b(besok lusa|lusa)\b/i, 2],
      [/\b(besok|bsk|tomorrow)\b/i, 1],
      [/\b(minggu depan|pekan depan|next week)\b/i, 7],
      [/\b(bulan depan|next month)\b/i, 30],
    ];
    for (const [re, days] of relatives) {
      const m = re.exec(rest);
      if (m) {
        dueDate = addDaysISO(today, days);
        rest = cut(rest, m[0]);
        break;
      }
    }
  }

  // ---- weekday names --------------------------------------------------------
  if (!dueDate) {
    const m =
      /\b(?:hari\s+)?(minggu|ahad|senin|selasa|rabu|kamis|jumat|jum'at|sabtu|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b(\s+depan)?/i.exec(
        rest,
      );
    if (m) {
      const target = WEEKDAYS[m[1].toLowerCase()];
      // Same weekday means today: landing a reminder early is kinder than
      // landing it a week after the thing was due.
      let delta = (target - weekdayOf(today) + 7) % 7;
      if (m[2]) delta += 7; // "sabtu depan"
      dueDate = addDaysISO(today, delta);
      rest = cut(rest, m[0]);
    }
  }

  const title = tidyTitle(rest);
  return {
    title: title || tidyTitle(input) || input.trim(),
    dueDate: dueDate ?? today,
    dueTime,
    emoji: guessEmoji(input),
    matched: { date: dueDate !== null, time: dueTime !== null },
  };
}

/** A day+month with no year: this year, or next if it's already behind us. */
function resolveDayMonth(today: string, day: number, month: number): string {
  const year = Number(today.slice(0, 4));
  const candidate = `${year}-${pad(month)}-${pad(day)}`;
  return candidate >= today ? candidate : `${year + 1}-${pad(month)}-${pad(day)}`;
}

const FILLER =
  /^(?:jangan lupa|jgn lupa|inget(?:in)?|ingatkan|remind me to|remember to|aku harus|harus|tolong|please|mau|nanti|ada)\b[\s,:-]*/i;

function tidyTitle(raw: string): string {
  let text = raw.replace(/\s+/g, " ").trim();
  // Peel off leading filler ("jangan lupa beli charger" → "Beli charger").
  for (let i = 0; i < 3; i++) {
    const next = text.replace(FILLER, "").trim();
    if (next === text) break;
    text = next;
  }
  text = text.replace(/^[,\-–—:.\s]+|[,\-–—:.\s]+$/g, "").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}
