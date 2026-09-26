/**
 * Meanwhile… — the Moment pool.
 *
 * Every visit draws ONE Moment from these. Random, personal, lightweight —
 * done in 10 seconds to a few minutes. Skipping is always free ("Not feeling
 * it →", no confirm, no penalty), and one visit = one main Moment.
 *
 * ✏️ FROM_ME and MICRO_LETTERS are *your* voice — edit/extend them so they
 * sound like you, not like an app. (Same rule as the letter pool: no runtime
 * AI text.)
 */

import type { AwayKind } from "@/lib/supabase/database.types";

// ---- Away status ------------------------------------------------------------

export const AWAY_KINDS: { kind: AwayKind; emoji: string; label: string; doing: string }[] = [
  { kind: "working", emoji: "💻", label: "Working", doing: "is working" },
  { kind: "playing", emoji: "🎮", label: "Playing", doing: "is out playing" },
  { kind: "outside", emoji: "🚗", label: "Outside", doing: "is outside" },
  { kind: "sleeping", emoji: "😴", label: "Sleeping", doing: "is sleeping" },
  { kind: "busy", emoji: "🫥", label: "Just busy", doing: "is a little busy" },
];

export function awayInfo(kind: AwayKind) {
  return AWAY_KINDS.find((k) => k.kind === kind) ?? AWAY_KINDS[4];
}

// ---- 💭 Tiny Question ---------------------------------------------------------

export const TINY_QUESTIONS: string[] = [
  "What's one thing that made you smile today?",
  "What's your current mood in one word?",
  "What are you craving right now?",
  "What's something you want to do this weekend?",
  "If today had a color, what would it be?",
  "What's the most random thing you've seen today?",
  "Lagu apa yang nyangkut di kepalamu hari ini?",
  "Kalau sekarang bisa teleport ke satu tempat, ke mana?",
  "Apa hal kecil yang bikin kamu tenang hari ini?",
  "What's one tiny win you had today?",
  "Kalau hari ini adalah cuaca, cuacanya apa?",
  "Apa yang pengen kamu ceritain nanti kalau kita ketemu?",
];

// ---- 🎲 Pick One ---------------------------------------------------------------

export type PickOption = { emoji: string; label: string };
export type PickOne = { prompt: string; a: PickOption; b: PickOption; quip: string };

export const PICK_ONES: PickOne[] = [
  {
    prompt: "Don't think. Pick one.",
    a: { emoji: "☕", label: "Coffee" },
    b: { emoji: "🍵", label: "Tea" },
    quip: "Good choice. I'll pretend I knew you'd pick that. 😌",
  },
  {
    prompt: "Tonight?",
    a: { emoji: "🌙", label: "Stay home" },
    b: { emoji: "🌃", label: "Go outside" },
    quip: "Noted. Sounds exactly like you.",
  },
  {
    prompt: "Choose your energy.",
    a: { emoji: "🐰", label: "Soft" },
    b: { emoji: "🐈", label: "Chaotic" },
    quip: "Ya, kelihatan kok dari jauh. 😂",
  },
  {
    prompt: "Right now you need…",
    a: { emoji: "🤗", label: "A hug" },
    b: { emoji: "🍜", label: "A snack" },
    quip: "Both is also a valid answer, by the way.",
  },
  {
    prompt: "Pilih satu. Cepat.",
    a: { emoji: "🌧️", label: "Hujan + selimut" },
    b: { emoji: "🌤️", label: "Cerah + jalan-jalan" },
    quip: "Setuju. Nggak ada debat.",
  },
  {
    prompt: "Sweet or savory?",
    a: { emoji: "🍰", label: "Sweet" },
    b: { emoji: "🍟", label: "Savory" },
    quip: "I had a feeling. ♡",
  },
  {
    prompt: "Weekend ideal:",
    a: { emoji: "🛋️", label: "Rebahan total" },
    b: { emoji: "📸", label: "Bikin memori" },
    quip: "Oke, dicatat buat nanti. 😉",
  },
  {
    prompt: "Pagi ini kamu tim…",
    a: { emoji: "⏰", label: "Bangun langsung gerak" },
    b: { emoji: "😴", label: "Snooze lima kali" },
    quip: "Jujur itu bagus. 😂",
  },
];

// ---- 😈 Silly ------------------------------------------------------------------

export type SillyPick = {
  prompt: string;
  options: PickOption[];
  quip: string;
};

export const SILLY_PICKS: SillyPick[] = [
  {
    prompt: "Important question. Kalau kamu jadi hewan selama satu hari:",
    options: [
      { emoji: "🐱", label: "Kucing" },
      { emoji: "🐶", label: "Anjing" },
      { emoji: "🦦", label: "Berang-berang" },
      { emoji: "🐢", label: "Kura-kura" },
    ],
    quip: "Interesting. I will remember this.",
  },
  {
    prompt: "You have 10 seconds. Pick a random emoji.",
    options: [
      { emoji: "🫠", label: "🫠" },
      { emoji: "🦖", label: "🦖" },
      { emoji: "🧋", label: "🧋" },
      { emoji: "🌵", label: "🌵" },
    ],
    quip: "Interesting. Sangat mencurigakan. Dicatat.",
  },
  {
    prompt: "Kamu cuma boleh makan SATU ini selamanya:",
    options: [
      { emoji: "🍜", label: "Mie" },
      { emoji: "🍚", label: "Nasi goreng" },
      { emoji: "🍕", label: "Pizza" },
      { emoji: "🧋", label: "Boba (iya, minum dihitung)" },
    ],
    quip: "Bold choice. Aku hormat.",
  },
];

export type SillyRate = { prompt: string; thing: string };

export const SILLY_RATES: SillyRate[] = [
  { prompt: "Rate this extremely important thing.", thing: "🍜 Indomie jam 2 pagi" },
  { prompt: "Rate this extremely important thing.", thing: "🌧️ Suara hujan pas mau tidur" },
  { prompt: "Rate this extremely important thing.", thing: "🛏️ Kasur yang baru diganti sepreinya" },
  { prompt: "Rate this extremely important thing.", thing: "🧊 Es teh manis pas lagi panas-panasnya" },
];

// ---- 🫶 From Me ----------------------------------------------------------------
// ✏️ Ini suaramu. Tulis ulang / tambah sesukamu — biar kedengarannya kayak kamu.

export const FROM_ME: string[][] = [
  [
    "Kalau kamu lagi buka ini,",
    "mungkin aku lagi sibuk.",
    "Jadi jangan nungguin aku ya.",
    "Jalanin aja harimu.",
    "Nanti kalau aku sudah selesai,",
    "aku cari kamu lagi. ♡",
  ],
  [
    "Kalau kamu buka ini karena bosan…",
    "yaudah sini kukasih kerjaan.",
    "Senyum dulu.",
    "Nah. Gitu.",
  ],
  [
    "Aku mungkin lagi nggak bisa ngobrol sekarang.",
    "Tapi aku tetap pengen kamu tahu:",
    "aku senang kamu ada.",
  ],
  [
    "Lagi ngapain kamu?",
    "Apapun itu, jangan lupa minum.",
    "Iya, sekarang.",
    "Aku tungguin. ♡",
  ],
  [
    "Kita lagi sibuk masing-masing,",
    "dan itu nggak apa-apa.",
    "Tempat kecil ini tetap di sini.",
    "Aku juga.",
  ],
];

// ---- ✉️ A Letter I Left Here (very rare) ---------------------------------------
// Micro-letters, bukan Direct Letter — cuma pesan kecil yang ketinggalan di sini.

export const MICRO_LETTERS: string[][] = [
  [
    "Aku tahu mungkin sekarang aku lagi nggak ada di samping kamu.",
    "Tapi aku ninggalin ini di sini,",
    "biar kalau kamu nemu,",
    "kamu tahu aku mikirin kamu",
    "bahkan sebelum hari ini terjadi. ♡",
  ],
  [
    "Surat kecil ini kutulis jauh sebelum kamu menemukannya.",
    "Kalau hari ini berat — pelan-pelan aja.",
    "Kalau hari ini ringan — syukurlah.",
    "Dua-duanya tetap kutemani dari sini.",
  ],
  [
    "Suatu hari kamu bakal nemu pesan ini,",
    "dan aku nggak tahu kapan.",
    "Tapi kapan pun itu,",
    "semoga harimu sedang baik.",
    "Dan kalau belum — nanti kubaikin. ♡",
  ],
];

// ---- 🧩 Mini games --------------------------------------------------------------

export const MEMORY_EMOJI_POOL = [
  "🍓", "🌙", "☕", "🐱", "🌷", "🧸", "🍞", "⭐", "🎈", "🐟", "🍋", "🌈",
];

export const FIND_DECOYS = ["🤎", "🩶", "🤍", "💤", "🫧", "🌫️", "🕊️", "🪨"];

export type ReactionPrompt = { prompt: string; options: string[]; quip: string };

export const REACTIONS: ReactionPrompt[] = [
  {
    prompt: "Kamu buka kulkas, dan makanan yang kamu simpan… hilang.",
    options: ["😭", "😂", "😐", "🫠"],
    quip: "Valid. Semua jawaban valid.",
  },
  {
    prompt: "Ada orang asing dadah ke kamu. Ternyata bukan ke kamu.",
    options: ["😭", "😂", "😐", "🫠"],
    quip: "Pernah. Kita semua pernah.",
  },
  {
    prompt: "Kamu bilang 'kamu juga!' padahal dia bilang 'selamat makan'.",
    options: ["😭", "😂", "😐", "🫠"],
    quip: "There's no wrong answer. Only trauma. 😂",
  },
];

// ---- 🌱 Slow Down ---------------------------------------------------------------

export const SLOWDOWN = {
  beats: ["Take a breath.", "Put your phone down for 10 seconds.", "Look around.", "You're here."],
  after: ["Okay.", "You can go back to your day now. ♡"],
  seconds: 10,
};

// ---- Collection milestones -------------------------------------------------------

export function collectionLine(count: number): string | null {
  if (count >= 25) return "Look how much life happened here.";
  if (count >= 10) return "Turns out ordinary days aren't so ordinary.";
  if (count >= 7) return `You've collected ${count} pieces of ordinary days.`;
  return null;
}
