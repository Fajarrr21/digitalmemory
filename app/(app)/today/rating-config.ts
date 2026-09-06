/** Plain module — safe to import from both client and server-action files. */

export const MOODS = [
  "senang",
  "tenang",
  "biasa",
  "lelah",
  "sedih",
  "cemas",
  "bersyukur",
  "kesal",
] as const;

export type Mood = (typeof MOODS)[number];

/** Contextual prompt shown after a score is picked (PLAN §7). */
export function promptFor(score: number): string {
  if (score <= 3) return "Hari ini terasa berat ya. Mau cerita apa yang terjadi?";
  if (score <= 6) return "Hari ini biasa aja? Cerita dikit dong.";
  if (score <= 8) return "Kayaknya hari ini cukup menyenangkan. Apa yang bikin kamu tersenyum?";
  return "What a day! Apa yang bikin hari ini spesial?";
}

/** A soft word for each band, used as a heading. */
export function bandLabel(score: number): string {
  if (score <= 3) return "Hari yang berat";
  if (score <= 6) return "Hari yang biasa";
  if (score <= 8) return "Hari yang manis";
  return "Hari yang spesial";
}

function bandKey(score: number): "hard" | "meh" | "sweet" | "special" {
  if (score <= 3) return "hard";
  if (score <= 6) return "meh";
  if (score <= 8) return "sweet";
  return "special";
}

const ENCOURAGEMENT: Record<ReturnType<typeof bandKey>, string[]> = {
  hard: [
    "Kamu udah melewati hari yang berat, dan kamu masih di sini. Itu lebih dari cukup. ♡",
    "Nggak apa-apa kalau hari ini nggak baik-baik aja. Besok kita coba lagi, pelan-pelan. ♡",
    "Aku bangga kamu tetap bertahan hari ini. Istirahat ya, kamu pantas dapet itu. ♡",
  ],
  meh: [
    "Hari yang biasa pun tetap berharga, karena kamu yang menjalaninya. ♡",
    "Nggak setiap hari harus istimewa. Kamu udah cukup dengan melewatinya. ♡",
    "Terima kasih udah menjalani hari ini. Semoga besok sedikit lebih cerah. ♡",
  ],
  sweet: [
    "Senang banget lihat harimu manis. Simpan senyum ini ya. ♡",
    "Hari yang baik buat orang baik. Kamu pantas dapet lebih banyak hari kayak gini. ♡",
    "Semoga besok sehangat hari ini. Aku ikut senang. ♡",
  ],
  special: [
    "Hari yang spesial! Aku ikut bahagia bacanya. ♡",
    "Wah, hari yang luar biasa — simpan rasa ini baik-baik ya. ♡",
    "Kamu bersinar hari ini. Aku bangga dan ikut berbahagia. ♡",
  ],
};

/** Warm affirmation for a saved score. Deterministic per `seed` (use the
 *  date) so it stays the same all day but can vary across days. */
export function encouragementFor(score: number, seed = ""): string {
  const options = ENCOURAGEMENT[bandKey(score)];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return options[hash % options.length];
}
