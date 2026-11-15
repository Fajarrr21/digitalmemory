/**
 * Ular Tangga — the 30-square board (6 × 5, snaking up from bottom-left).
 * A snake head, a ladder foot or a ♥ square deals a challenge card.
 * Landing on/over 30 finishes (no exact roll needed — keeps it short).
 */

export const BOARD_SIZE = 30;
export const BOARD_COLS = 6;
export const BOARD_ROWS = 5;

export const LADDERS: Record<number, number> = { 3: 11, 9: 16, 14: 24, 19: 27 };
export const SNAKES: Record<number, number> = { 17: 6, 22: 12, 26: 15, 29: 20 };
export const HEARTS = [5, 7, 13, 18, 23, 25];

export type BoardEvent = "snake" | "ladder" | "heart" | "plain" | "finish";

export type BoardMove = {
  id: string;
  by: string;
  face: number;
  from: number;
  /** where the die put the pawn */
  landed: number;
  /** where it ends up (ladder top / snake tail / same) */
  to: number;
  event: BoardEvent;
};

/** Resolve one roll. Pure. */
export function stepOn(from: number, face: number): Pick<BoardMove, "landed" | "to" | "event"> {
  const landed = Math.min(BOARD_SIZE, from + face);
  if (landed === BOARD_SIZE) return { landed, to: landed, event: "finish" };
  if (LADDERS[landed]) return { landed, to: LADDERS[landed], event: "ladder" };
  if (SNAKES[landed]) return { landed, to: SNAKES[landed], event: "snake" };
  if (HEARTS.includes(landed)) return { landed, to: landed, event: "heart" };
  return { landed, to: landed, event: "plain" };
}

/** Grid cell (col, row-from-top) of square n, boustrophedon from bottom-left. */
export function cellOf(n: number): { col: number; row: number } {
  const r = Math.floor((n - 1) / BOARD_COLS);
  const i = (n - 1) % BOARD_COLS;
  return { col: r % 2 === 0 ? i : BOARD_COLS - 1 - i, row: BOARD_ROWS - 1 - r };
}

/** Prizes for whoever reaches 30 second — sweet, a little silly, never mean. */
export const PRIZES = [
  "Kirim voice note berisi lima alasan kenapa kamu sayang dia.",
  "Tulis satu paragraf surat cinta untuknya (boleh lewat Letters ♡).",
  "Berikan sepuluh pujian tanpa mengulang kata.",
  "Buat playlist kecil untuknya, minimal 5 lagu.",
  "Nyanyikan reff lagu pilihannya lewat voice note.",
  "Kirim selfie dengan ekspresi paling absurd.",
  "Buat pantun cinta spontan, sekarang juga.",
  "Ganti nama kontaknya jadi pilihan dia selama 24 jam.",
  "Ceritakan momen pertama kamu sadar suka sama dia.",
  "Gambar dia (sejelek apa pun), lalu kirim fotonya.",
  "Traktir dia satu hal kecil di pertemuan berikutnya.",
  "Ucapkan selamat pagi duluan selama tiga hari ke depan.",
];

export function drawPrize(rand: () => number, not?: string | null): string {
  const pool = PRIZES.filter((p) => p !== not);
  return pool[Math.floor(rand() * pool.length)];
}
