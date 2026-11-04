/**
 * little words. — deterministic quality checks.
 *
 * The AI reviews its own work (relevance, genre, coherence, naturalness —
 * things only a reader can judge), but the rules a machine CAN check are
 * checked here, in plain code, on every result before it is shown:
 *
 *   cliché     — senja / rembulan / semesta / aksara / samudra & friends
 *   opener     — "Barangkali…", "Pada akhirnya…", "Di antara…"
 *   closing    — every alternative ending in "aku mencintaimu"
 *   repetition — the same phrase over and over
 *   shape      — a "poem" that's one paragraph; prose chopped into lines
 *   length     — far from what was asked
 *   pov        — point of view that drifts, aku/saya mixed
 *   language   — Indonesian piece full of English (or the reverse)
 *   sameness   — alternatives that are really one template twice
 *
 * Pure: no I/O. Severity "repair" means the AI layer sends ONE targeted
 * repair request; "note" is only shown. Messages are Indonesian (shown to
 * the writer), `detail` is English (sent to the model).
 */

import type { WordsLanguage, WorkType } from "@/lib/supabase/database.types";

export type IssueCode =
  | "cliche"
  | "opener"
  | "closing"
  | "repetition"
  | "shape"
  | "length"
  | "pov"
  | "language"
  | "sameness"
  | "empty";

export type Issue = {
  code: IssueCode;
  severity: "repair" | "note";
  /** Shown to the writer. */
  message: string;
  /** Sent to the model in a repair request. */
  detail: string;
};

export type Pov = "first" | "second" | "third" | "free";
export type LengthKey = "short" | "medium" | "long";

/* ------------------------------------------------------------ tokenising -- */

export function words(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}][\p{L}'’-]*/gu) ?? []).map((w) => w.replace(/[’]/g, "'"));
}

export function wordCount(text: string): number {
  return words(text).length;
}

function lines(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => /\p{L}/u.test(s));
}

const STOP_ID = new Set(
  "yang dan di ke dari itu ini dengan untuk pada dalam tidak akan sudah aku kamu kau engkau dia ia kita kami mereka saya juga atau tapi tetapi namun karena seperti lebih masih hanya bisa ada adalah jadi pun lagi telah sebuah satu semua setiap begitu sebab jika kalau agar supaya hingga sampai ketika saat yang mana nya mu ku pernah selalu bahkan".split(
    " ",
  ),
);
const STOP_EN = new Set(
  "the a an and or but of to in on at for with from by as is are was were be been i you he she it we they me my your our their his her them this that these those not no so if then than when while just still only into over under like".split(
    " ",
  ),
);

/* ---------------------------------------------------------------- clichés -- */

/** Words the brief bans from overuse. Stems so "senjanya", "semestaku" count. */
const CLICHE_ID = ["senja", "rembulan", "semesta", "aksara", "samudra", "samudera", "jingga", "purnama", "nirwana", "swastamita"];
const CLICHE_PHRASES_ID = [
  "separuh jiwaku",
  "belahan jiwa",
  "cinta sejati",
  "hingga akhir hayat",
  "sampai maut memisahkan",
  "kau adalah segalanya",
  "kamu adalah segalanya",
  "hatiku berdebar",
  "duniaku runtuh",
  "dunia terasa berhenti",
];
const CLICHE_PHRASES_EN = [
  "my other half",
  "soulmate",
  "you are my everything",
  "forever and always",
  "my heart skips a beat",
  "the stars aligned",
  "love of my life",
  "till the end of time",
  "you complete me",
];

export function clicheCounts(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  const ws = words(text);
  for (const stem of CLICHE_ID) {
    const n = ws.filter((w) => w.startsWith(stem)).length;
    if (n) out[stem] = n;
  }
  const lower = text.toLowerCase();
  for (const phrase of [...CLICHE_PHRASES_ID, ...CLICHE_PHRASES_EN]) {
    const n = lower.split(phrase).length - 1;
    if (n) out[phrase] = n;
  }
  return out;
}

/* ------------------------------------------------------------ the checks -- */

const OPENERS = [/^barangkali\b/i, /^pada akhirnya\b/i, /^di antara\b/i, /^mungkin\b/i, /^perhaps\b/i, /^in the end\b/i];
const LOVE_CLOSING = /(aku\s+(sangat\s+)?(men)?cinta(i)?\s*(mu|kamu)|aku\s+sayang\s+(kamu|padamu)|cintaku\s+padamu|i\s+love\s+you)[\s.!♡❤]*$/i;

function firstLine(text: string) {
  return lines(text)[0] ?? "";
}
function lastLine(text: string) {
  const ls = lines(text);
  return ls[ls.length - 1] ?? "";
}

/** Rough word-count bands per form & length. Generous on purpose. */
const LENGTH_BANDS: Record<WorkType, Record<LengthKey, [number, number]>> = {
  poetry: { short: [20, 90], medium: [50, 200], long: [110, 380] },
  prose: { short: [50, 180], medium: [120, 400], long: [250, 750] },
  letter: { short: [60, 220], medium: [130, 450], long: [260, 800] },
  quote: { short: [4, 40], medium: [8, 70], long: [15, 110] },
};

function povCounts(text: string) {
  const ws = words(text);
  const first = ws.filter(
    (w) =>
      ["aku", "saya", "daku", "ku", "i", "me", "my", "mine", "myself"].includes(w) ||
      (w.length > 4 && w.endsWith("ku") && !["tungku", "kuku", "buku", "saku", "laku", "suku", "paku", "kaku", "baku", "teluku"].includes(w)),
  ).length;
  const second = ws.filter(
    (w) =>
      ["kamu", "kau", "engkau", "dikau", "anda", "you", "your", "yours", "yourself"].includes(w) ||
      (w.length > 4 && w.endsWith("mu") && !["ilmu", "jemu", "tamu", "ramu", "jamu", "temu", "kalbu"].includes(w)),
  ).length;
  const third = ws.filter((w) => ["dia", "ia", "beliau", "mereka", "he", "she", "they", "him", "her", "them", "his", "their"].includes(w)).length;
  return { first, second, third, saya: ws.includes("saya"), aku: ws.includes("aku") || ws.some((w) => w.endsWith("ku") && w.length > 4) };
}

function repeatedPhrases(text: string): { phrase: string; n: number }[] {
  const ws = words(text);
  const counts = new Map<string, number>();
  for (let i = 0; i + 3 < ws.length; i++) {
    const gram = ws.slice(i, i + 4);
    // Ignore n-grams that are all function words.
    if (gram.every((w) => STOP_ID.has(w) || STOP_EN.has(w))) continue;
    const key = gram.join(" ");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n >= 3).map(([phrase, n]) => ({ phrase, n }));
}

function languageMix(text: string, language: WordsLanguage): number {
  const ws = words(text);
  if (ws.length < 12) return 0;
  const foreign = language === "id" ? STOP_EN : STOP_ID;
  // Words that exist in both lists ("di" vs nothing) are rare; good enough.
  const n = ws.filter((w) => foreign.has(w) && !(language === "id" ? STOP_ID : STOP_EN).has(w)).length;
  return n / ws.length;
}

export type CheckContext = {
  workType: WorkType;
  language: WordsLanguage;
  pov?: Pov;
  length?: LengthKey;
  /** For rewrites: only flag what the rewrite INTRODUCED. */
  original?: string;
};

/** Check one piece of writing. */
export function checkPiece(text: string, ctx: CheckContext): Issue[] {
  const issues: Issue[] = [];
  const trimmed = text.trim();
  if (!trimmed) {
    return [{ code: "empty", severity: "repair", message: "Hasilnya kosong.", detail: "The piece is empty." }];
  }

  // Clichés — overuse, or (for a rewrite) newly introduced ones.
  const cl = clicheCounts(trimmed);
  const before = ctx.original ? clicheCounts(ctx.original) : {};
  const introduced = Object.entries(cl).filter(([k, n]) => n > (before[k] ?? 0));
  const total = introduced.reduce((s, [, n]) => s + n, 0);
  const tooMany = ctx.original ? total >= 1 : total >= 2 || introduced.some(([, n]) => n >= 2);
  if (introduced.length && tooMany) {
    const list = introduced.map(([k]) => k).join(", ");
    issues.push({
      code: "cliche",
      severity: "repair",
      message: `Kata klise terlalu sering: ${list}.`,
      detail: `Overused or clichéd words/phrases: ${list}. Replace them with images specific to this piece's own context.`,
    });
  } else if (introduced.length) {
    issues.push({
      code: "cliche",
      severity: "note",
      message: `Ada satu kata yang sering dipakai penyair: ${introduced[0][0]}.`,
      detail: `Contains "${introduced[0][0]}".`,
    });
  }

  // Openers.
  const opening = firstLine(trimmed);
  const badOpener = OPENERS.find((re) => re.test(opening));
  if (badOpener && !(ctx.original && OPENERS.some((re) => re.test(firstLine(ctx.original!))))) {
    issues.push({
      code: "opener",
      severity: "repair",
      message: `Pembukaannya klise ("${opening.split(/\s+/).slice(0, 2).join(" ")}…").`,
      detail: `It opens with a stock opener ("${opening.slice(0, 40)}"). Open differently: with an image, an action, or a direct address.`,
    });
  }

  // Repetition (above what refrain-style repetition would justify).
  const reps = repeatedPhrases(trimmed);
  if (reps.length) {
    const worst = reps.sort((a, b) => b.n - a.n)[0];
    const deliberate = worst.n >= 3 && lines(trimmed).filter((l) => l.toLowerCase().startsWith(worst.phrase.split(" ")[0])).length >= worst.n;
    issues.push({
      code: "repetition",
      severity: worst.n >= 4 && !deliberate ? "repair" : "note",
      message: `Frasa "${worst.phrase}" muncul ${worst.n}×.`,
      detail: `The phrase "${worst.phrase}" appears ${worst.n} times. Keep repetition only where it builds rhythm; otherwise vary it.`,
    });
  }

  // Shape.
  const ls = lines(trimmed);
  const ws = wordCount(trimmed);
  if (ctx.workType === "poetry") {
    const avg = ws / Math.max(1, ls.length);
    if (ls.length < 4 || avg > 16) {
      issues.push({
        code: "shape",
        severity: "repair",
        message: "Bentuknya belum seperti puisi (baris terlalu panjang / tidak ada pemenggalan).",
        detail:
          "This is meant to be a poem, but it reads like a paragraph. Break it into purposeful lines and stanzas; each line break should create a pause, turn or emphasis.",
      });
    }
  } else if (ctx.workType === "prose" || ctx.workType === "letter") {
    const sentenceLines = ls.filter((l) => sentences(l).length <= 1 && words(l).length < 18).length;
    if (ls.length >= 6 && sentenceLines / ls.length > 0.7) {
      issues.push({
        code: "shape",
        severity: "repair",
        message: "Prosanya terpotong-potong per kalimat, belum mengalir sebagai paragraf.",
        detail:
          "This is prose, but it is chopped into one sentence per line. Write it in connected paragraphs where each sentence leads into the next.",
      });
    }
  } else if (ctx.workType === "quote" && (sentences(trimmed).length > 5 || ws > 120)) {
    issues.push({
      code: "shape",
      severity: "repair",
      message: "Terlalu panjang untuk sebuah kutipan.",
      detail: "Too long for a short literary quote; distil it to at most four sentences.",
    });
  }

  // Length (only when a target was given).
  if (ctx.length && !ctx.original) {
    const [lo, hi] = LENGTH_BANDS[ctx.workType][ctx.length];
    if (ws < lo * 0.6 || ws > hi * 1.6) {
      issues.push({
        code: "length",
        severity: ws < lo * 0.4 || ws > hi * 2.2 ? "repair" : "note",
        message: ws < lo ? "Lebih pendek dari yang diminta." : "Lebih panjang dari yang diminta.",
        detail: `It is ${ws} words; the requested length is roughly ${lo}–${hi} words.`,
      });
    }
  }

  // Point of view.
  const pv = povCounts(trimmed);
  if (ctx.language === "id" && pv.aku && pv.saya) {
    issues.push({
      code: "pov",
      severity: "repair",
      message: "Memakai \"aku\" dan \"saya\" bercampur.",
      detail: 'It mixes "aku" and "saya". Use one consistently (aku, unless the register clearly calls for saya).',
    });
  }
  if (ctx.pov === "first" && pv.first === 0) {
    issues.push({ code: "pov", severity: "repair", message: "Sudut pandang orang pertama belum terasa.", detail: "Requested first person (aku / I) but none is used." });
  } else if (ctx.pov === "second" && pv.second === 0) {
    issues.push({ code: "pov", severity: "repair", message: "Belum menyapa \"kamu\".", detail: 'Requested second person: address "kamu" / "you" directly.' });
  } else if (ctx.pov === "third" && pv.first + pv.second > 3) {
    issues.push({
      code: "pov",
      severity: "repair",
      message: "Sudut pandang orang ketiga bergeser ke aku/kamu.",
      detail: "Requested third person, but it drifts into aku/kamu (I/you). Keep a third-person point of view.",
    });
  }

  // Language.
  const mix = languageMix(trimmed, ctx.language);
  if (mix > 0.08) {
    issues.push({
      code: "language",
      severity: "repair",
      message: ctx.language === "id" ? "Tercampur bahasa Inggris." : "Mixed with Indonesian.",
      detail: `Write entirely in ${ctx.language === "id" ? "Indonesian" : "English"}.`,
    });
  }

  return issues;
}

/** Content-word set for similarity. */
function contentSet(text: string): Set<string> {
  return new Set(words(text).filter((w) => w.length >= 4 && !STOP_ID.has(w) && !STOP_EN.has(w)));
}

export function jaccard(a: string, b: string): number {
  const A = contentSet(a);
  const B = contentSet(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * Check a set of alternatives: each on its own, plus the set as a whole
 * (alternatives that are one template twice, every one ending in a love
 * declaration). Returns issues per index.
 */
export function checkAlternatives(texts: string[], ctx: CheckContext): Issue[][] {
  const out = texts.map((t) => checkPiece(t, ctx));

  for (let i = 1; i < texts.length; i++) {
    for (let j = 0; j < i; j++) {
      const sim = jaccard(texts[i], texts[j]);
      const sameStart =
        words(texts[i]).slice(0, 3).join(" ") === words(texts[j]).slice(0, 3).join(" ") && words(texts[i]).length > 3;
      if (sim > 0.45 || sameStart) {
        out[i].push({
          code: "sameness",
          severity: "repair",
          message: `Terlalu mirip dengan alternatif ${j + 1}.`,
          detail: `Too similar to alternative ${j + 1}${sameStart ? " (same opening)" : ""}. Take a genuinely different approach: different structure, central image, and entry point.`,
        });
        break;
      }
    }
  }

  if (texts.length >= 2) {
    const loveEnds = texts.map((t) => LOVE_CLOSING.test(lastLine(t)));
    if (loveEnds.filter(Boolean).length >= 2) {
      // Repair all but the first, so not every piece ends the same way.
      let seen = false;
      loveEnds.forEach((ends, i) => {
        if (!ends) return;
        if (!seen) {
          seen = true;
          return;
        }
        out[i].push({
          code: "closing",
          severity: "repair",
          message: "Penutupnya lagi-lagi pernyataan cinta.",
          detail: "It ends with a declaration of love like another alternative does. End on an image, a question, or a quiet turn instead.",
        });
      });
    }
  }

  return out;
}

export function needsRepair(issues: Issue[]): boolean {
  return issues.some((i) => i.severity === "repair");
}

/** The checks shown as ✓ / ! in the result card, in the brief's order. */
export const QUALITY_ROWS: { key: string; label: string; codes: IssueCode[] }[] = [
  { key: "relevance", label: "Relevan dengan gagasan", codes: [] },
  { key: "genre", label: "Konsisten dengan genre", codes: [] },
  { key: "language", label: "Ketepatan bahasa", codes: ["language"] },
  { key: "coherence", label: "Koheren & berbentuk", codes: ["shape", "length"] },
  { key: "metaphor", label: "Metafora segar, tanpa klise", codes: ["cliche", "opener", "closing"] },
  { key: "repetition", label: "Tanpa pengulangan berlebih", codes: ["repetition"] },
  { key: "natural", label: "Kalimat alami", codes: [] },
  { key: "original", label: "Orisinal & berbeda", codes: ["sameness"] },
  { key: "pov", label: "Sudut pandang konsisten", codes: ["pov"] },
];
