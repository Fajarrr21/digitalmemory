import { FEEDBACK, POINTS, QUESTIONS, QUIZ_SIZE, TITLES, type QuizTone } from "./config";

/** One sheet row: the real answer + three decoys. */
export type SheetItem = { a: string; d: string[] };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Why a sheet can't be locked yet (null = ready). */
export function sheetProblem(items: SheetItem[]): string | null {
  if (items.length !== QUIZ_SIZE) return "Isian belum lengkap.";
  for (let i = 0; i < QUIZ_SIZE; i++) {
    const { a, d } = items[i];
    const no = `Pertanyaan ${i + 1}`;
    if (!a?.trim()) return `${no} belum dijawab.`;
    if (d?.length !== 3 || d.some((x) => !x?.trim())) return `${no} butuh 3 pilihan pengecoh.`;
    const all = [a, ...d].map(norm);
    if (new Set(all).size !== 4) return `${no}: jawaban & pengecoh harus berbeda semua.`;
  }
  return null;
}

/** A random permutation of [0,1,2,3] (0 = the real answer). */
export function randomOrder(rand: () => number = Math.random): number[] {
  const p = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

/** The four options as the guesser sees them, + which one is right. */
export function optionsFor(item: SheetItem, order: number[]) {
  return { options: order.map((k) => (k === 0 ? item.a : item.d[k - 1])), correctIdx: order.indexOf(0) };
}

export function titleFor(pct: number): string {
  return (TITLES.find((t) => pct >= t.min) ?? TITLES[TITLES.length - 1]).title;
}

/** Stable pick so both screens / a reload show the same line. */
export function feedbackFor(tone: QuizTone, correct: boolean, seed: string) {
  const pool = FEEDBACK[tone][correct ? "right" : "wrong"];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}

export type Guess = { idx: number; correct: boolean };

export function scoreOf(guesses: Guess[]) {
  const right = guesses.filter((g) => g.correct).length;
  const pct = Math.round((right / QUIZ_SIZE) * 100);
  let streak = 0;
  let best = 0;
  for (const g of [...guesses].sort((x, y) => x.idx - y.idx)) {
    streak = g.correct ? streak + 1 : 0;
    best = Math.max(best, streak);
  }
  const byCat = new Map<string, { right: number; total: number }>();
  for (const g of guesses) {
    const cat = QUESTIONS[g.idx].cat;
    const c = byCat.get(cat) ?? { right: 0, total: 0 };
    c.total++;
    if (g.correct) c.right++;
    byCat.set(cat, c);
  }
  const cats = [...byCat.entries()].map(([cat, c]) => ({ cat, rate: c.right / c.total }));
  const bestCat = cats.length ? cats.reduce((a, b) => (b.rate > a.rate ? b : a)).cat : null;
  const worstCat = cats.length ? cats.reduce((a, b) => (b.rate < a.rate ? b : a)).cat : null;
  return { right, wrong: guesses.length - right, points: right * POINTS, pct, title: titleFor(pct), streak: best, bestCat, worstCat };
}

/** "me" | "partner" | "tie" — same 25 questions each, so counts compare directly. */
export function winnerOf(myRight: number, partnerRight: number): "me" | "partner" | "tie" {
  return myRight === partnerRight ? "tie" : myRight > partnerRight ? "me" : "partner";
}
