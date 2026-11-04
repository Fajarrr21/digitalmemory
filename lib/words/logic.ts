/**
 * little words. — pure logic, unit-tested in logic.test.ts.
 *   - diffWords:        word-level diff for Compare Versions
 *   - spliceSelection:  rewrite one sentence without touching the rest
 *   - deliveryState:    locked / waiting-to-be-chosen / new / opened
 *   - filterLibrary:    categories, search, sort
 *   - nextBirthdayISO:  "Open on your birthday" suggests the real date
 */

import type { OpenWhen, WorkStatus, WorkType } from "@/lib/supabase/database.types";

/* ------------------------------------------------------------------ diff -- */

export type DiffPart = { type: "same" | "add" | "del"; text: string };

function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? [];
}

/**
 * LCS over word+whitespace tokens. Above ~2.5k tokens per side the table gets
 * heavy for a phone, so we fall back to "all removed / all added" — the
 * comparison still shows both versions, just without inline highlights.
 */
export function diffWords(a: string, b: string): DiffPart[] {
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.length * B.length > 6_000_000) {
    return [
      ...(a ? [{ type: "del" as const, text: a }] : []),
      ...(b ? [{ type: "add" as const, text: b }] : []),
    ];
  }
  const n = A.length;
  const m = B.length;
  // dp[i][j] = LCS length of A[i..] and B[j..], as flat Uint16/32 rows.
  const dp = new Uint32Array((n + 1) * (m + 1));
  const w = m + 1;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = A[i] === B[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    }
  }
  const out: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      push("same", A[i]);
      i++;
      j++;
    } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) {
      push("del", A[i++]);
    } else {
      push("add", B[j++]);
    }
  }
  while (i < n) push("del", A[i++]);
  while (j < m) push("add", B[j++]);

  // Whitespace-only changes between two kept words read as noise: fold them.
  return out.map((p) => (p.type !== "same" && !p.text.trim() ? { ...p, type: "same" as const } : p)).reduce<DiffPart[]>(
    (acc, p) => {
      const last = acc[acc.length - 1];
      if (last && last.type === p.type) last.text += p.text;
      else acc.push({ ...p });
      return acc;
    },
    [],
  );
}

/** How much changed, 0–1, by words — "kept 82% of your words". */
export function keptRatio(original: string, revised: string): number {
  const parts = diffWords(original, revised);
  const count = (t: string) => (t.match(/[^\s]+/g) ?? []).length;
  const same = parts.filter((p) => p.type === "same").reduce((s, p) => s + count(p.text), 0);
  const total = count(original);
  return total ? same / total : 0;
}

/* ------------------------------------------------------------- selection -- */

export function spliceSelection(text: string, start: number, end: number, replacement: string): string {
  const s = Math.max(0, Math.min(start, end, text.length));
  const e = Math.min(text.length, Math.max(start, end));
  return text.slice(0, s) + replacement + text.slice(e);
}

/**
 * Widen a raw text selection to whole words, so "ndah sek" becomes
 * "indah sekali" before it is sent to be refined.
 */
export function expandToWords(text: string, start: number, end: number): { start: number; end: number } {
  let s = Math.max(0, Math.min(start, end));
  let e = Math.min(text.length, Math.max(start, end));
  // Trim whitespace the user dragged across first, so a selection that
  // starts on a space doesn't widen into the previous word.
  while (s < e && /\s/.test(text[s])) s++;
  while (e > s && /\s/.test(text[e - 1])) e--;
  if (s === e) return { start: s, end: e };
  while (s > 0 && /\S/.test(text[s - 1])) s--;
  while (e < text.length && /\S/.test(text[e])) e++;
  return { start: s, end: e };
}

/* ------------------------------------------------------------ deliveries -- */

export type DeliveryState = "locked" | "sealed" | "new" | "opened";

/**
 * - locked: has an unlock time in the future — words not readable yet
 * - sealed: an "Open when…" envelope, unlocked, unopened — the recipient
 *           chooses the moment (we never guess how anyone feels)
 * - new:    a plain gift, unopened
 * - opened
 */
export function deliveryState(
  d: { unlock_at: string | null; opened_at: string | null; open_when: OpenWhen | null },
  now: Date = new Date(),
): DeliveryState {
  if (d.unlock_at && new Date(d.unlock_at).getTime() > now.getTime()) return "locked";
  if (d.opened_at) return "opened";
  return d.open_when ? "sealed" : "new";
}

/** The next time `birthday` (YYYY-MM-DD, any year) comes round, from `todayISO`. */
export function nextBirthdayISO(birthday: string | null | undefined, todayISO: string): string | null {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}/.test(birthday)) return null;
  const [, mm, dd] = birthday.slice(0, 10).split("-");
  const year = Number(todayISO.slice(0, 4));
  let candidate = `${year}-${mm}-${dd}`;
  // Feb 29 in a non-leap year → Feb 28.
  const valid = (iso: string) => {
    const d = new Date(`${iso}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
  };
  if (!valid(candidate)) candidate = `${year}-${mm}-28`;
  if (candidate < todayISO) {
    candidate = `${year + 1}-${mm}-${dd}`;
    if (!valid(candidate)) candidate = `${year + 1}-${mm}-28`;
  }
  return candidate;
}

/* --------------------------------------------------------------- library -- */

export type LibraryItem = {
  /** "work" = mine; "received" = given to me through To You. */
  source: "work" | "received";
  id: string;
  title: string;
  content: string;
  work_type: WorkType;
  genre: string | null;
  mood: string | null;
  status: WorkStatus | "received";
  favorite: boolean;
  /** "me" or the partner's name. */
  author: string;
  mine: boolean;
  /** created (work) or delivered (received). */
  date: string;
  updated: string;
  /** Times I've given this work to my partner. */
  sentCount: number;
  href: string;
};

export type LibraryCategory = "all" | "poetry" | "prose" | "letter" | "quote" | "for_you" | "favorites" | "drafts";

export const LIBRARY_CATEGORIES: { key: LibraryCategory; label: string }[] = [
  { key: "all", label: "All Works" },
  { key: "poetry", label: "My Poetry" },
  { key: "prose", label: "My Prose" },
  { key: "letter", label: "Love Letters" },
  { key: "quote", label: "Short Quotes" },
  { key: "for_you", label: "For You" },
  { key: "favorites", label: "Favorites" },
  { key: "drafts", label: "Drafts" },
];

export type LibrarySort = "newest" | "oldest" | "favorites";

export type LibraryFilter = {
  category: LibraryCategory;
  query?: string;
  genre?: string | null;
  workType?: WorkType | null;
  author?: "me" | "partner" | null;
  /** YYYY-MM — a month, matched against `date`. */
  month?: string | null;
  sort?: LibrarySort;
};

/** Lowercase, strip accents, collapse spaces — "Rindu" finds "rindú". */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function filterLibrary(items: LibraryItem[], f: LibraryFilter): LibraryItem[] {
  const q = f.query ? normalize(f.query) : "";
  const terms = q ? q.split(" ") : [];
  const out = items.filter((it) => {
    switch (f.category) {
      case "poetry":
      case "prose":
      case "letter":
      case "quote":
        if (!it.mine || it.work_type !== f.category) return false;
        break;
      case "for_you":
        if (it.source !== "received") return false;
        break;
      case "favorites":
        if (!it.favorite) return false;
        break;
      case "drafts":
        if (it.status !== "draft") return false;
        break;
    }
    if (f.genre && it.genre !== f.genre) return false;
    if (f.workType && it.work_type !== f.workType) return false;
    if (f.author === "me" && !it.mine) return false;
    if (f.author === "partner" && it.mine) return false;
    if (f.month && !it.date.startsWith(f.month)) return false;
    if (terms.length) {
      const hay = normalize(`${it.title} ${it.content} ${it.genre ?? ""} ${it.mood ?? ""} ${it.author}`);
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });

  const sort = f.sort ?? "newest";
  return out.sort((a, b) => {
    if (sort === "favorites" && a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    if (sort === "oldest") return a.date.localeCompare(b.date);
    return b.date.localeCompare(a.date);
  });
}

/* ---------------------------------------------------------------- bits -- */

export function excerpt(text: string, max = 140): string {
  const flat = text.replace(/\s*\n\s*/g, " / ").replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${cut.slice(0, at > max * 0.6 ? at : max).replace(/[\s/,.;:]+$/, "")}…`;
}

/** A title for an untitled piece: its first few words. */
export function fallbackTitle(content: string): string {
  const first = content.trim().split(/\r?\n/)[0] ?? "";
  const ws = first.split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
  return ws ? ws.replace(/[,.;:!?…]+$/, "") : "Tanpa judul";
}
