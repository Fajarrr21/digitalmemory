import type {
  HoldAction,
  HoldAfter,
  HoldFeeling,
  HoldGesture,
  HoldNeed,
  HoldTiming,
} from "@/lib/supabase/database.types";
import type { HoldObject } from "@/lib/hold/logic";

/**
 * If I Could Hold Your Feelings — all the words. The rules live in
 * lib/hold/logic.ts; the database (0018) is the final say.
 */

export const HOLD_TITLE = "If I Could Hold Your Feelings";
export const HOLD_TAGLINE = "Let me be here with you.";
export const HOLD_PHILOSOPHY = "Kamu nggak harus baik-baik saja untuk tetap disayang.";
export const HOLD_INTRO =
  "Kamu nggak harus menemukan kata-kata yang tepat. Cukup tunjukkan sedikit tentang apa yang kamu rasakan.";

export const FEELINGS: {
  key: HoldFeeling;
  label: string;
  hint: string;
  emoji: string;
}[] = [
  { key: "overwhelmed", label: "Everything feels too much", hint: "Semuanya datang bersamaan.", emoji: "☁️" },
  { key: "alone", label: "I feel a little alone", hint: "Rasanya agak sendirian.", emoji: "✦" },
  { key: "tired", label: "I'm emotionally tired", hint: "Hatiku capek.", emoji: "☾" },
  { key: "racing", label: "My mind won't slow down", hint: "Pikiranku ramai sekali.", emoji: "〰" },
  { key: "miss_you", label: "I miss you", hint: "Aku cuma kangen kamu.", emoji: "✧" },
  { key: "comfort", label: "I just need comfort", hint: "Aku cuma butuh dipeluk.", emoji: "♡" },
];

export function feelingInfo(key: HoldFeeling) {
  return FEELINGS.find((f) => f.key === key)!;
}

export const INTENSITY: { value: number; label: string }[] = [
  { value: 1, label: "sedikit" },
  { value: 2, label: "lumayan" },
  { value: 3, label: "berat" },
  { value: 4, label: "berat sekali" },
];

export const NEEDS: { key: HoldNeed; label: string; line: string }[] = [
  { key: "stay", label: "Just stay with me", line: "Cukup temani aku. Nggak perlu tanya kenapa." },
  { key: "loved", label: "Remind me I'm loved", line: "Ingatkan aku kalau aku disayang." },
  { key: "space", label: "Give me a little space", line: "Aku butuh tenang dulu — tapi jangan pergi jauh." },
  { key: "vent", label: "Let me get it out", line: "Dengarkan aku cerita. Nggak usah dikasih solusi dulu." },
];

export function needInfo(key: HoldNeed) {
  return NEEDS.find((n) => n.key === key)!;
}

export const TIMINGS: { key: HoldTiming; label: string; line: string }[] = [
  {
    key: "whenever",
    label: "When you have a moment",
    line: "Datang kalau kamu sempat. Ruangnya akan menunggu di sini.",
  },
  {
    key: "soon",
    label: "I'd like you here soon",
    line: "Aku ingin ditemani agak cepat — dia akan dapat kabar kecil lewat WhatsApp.",
  },
];

export const TIMING_NOTE =
  "Dua-duanya bukan janji balasan instan. Kadang orang yang kita sayang sedang sibuk, tidur, atau jauh — dan itu bukan berarti mereka nggak peduli.";

export function timingInfo(key: HoldTiming) {
  return TIMINGS.find((t) => t.key === key)!;
}

/** What the recipient reads first — "Someone you love is carrying…". */
export const OBJECT_COPY: Record<
  HoldObject,
  { name: string; carrying: string; reassure: string }
> = {
  cloud: {
    name: "The Heavy Cloud",
    carrying: "sedang membawa awan kecil hari ini.",
    reassure: "Kamu nggak harus menghilangkan awan itu. Kamu cukup hadir di sisinya.",
  },
  star: {
    name: "The Little Star",
    carrying: "sedang merasa seperti bintang kecil di langit yang luas.",
    reassure: "Kamu nggak harus mendekat sekarang juga. Cukup menyala di dekatnya.",
  },
  heart: {
    name: "The Tender Heart",
    carrying: "sedang membawa hati yang lembut hari ini.",
    reassure: "Nggak perlu kata-kata besar. Kehangatan kecil sudah cukup.",
  },
  moon: {
    name: "The Quiet Moon",
    carrying: "sedang lelah, seperti bulan yang tertutup awan.",
    reassure: "Nggak harus ramai. Cahaya kecil yang tetap di sana sudah berarti.",
  },
};

export const ACTIONS: Record<
  HoldAction,
  {
    label: string;
    purpose: string;
    presets: string[];
    /** Shown when this gesture isn't the one they asked for. */
    okNote?: string;
  }
> = {
  stay: {
    label: "Stay Beside Me",
    purpose: "Hadir tanpa menuntut penjelasan.",
    presets: ["Kamu nggak harus menjelaskan apa pun. Aku di sini.", "Aku duduk di sebelahmu, ya."],
  },
  warmth: {
    label: "Give Me Warmth",
    purpose: "Kehangatan dan penguatan kecil.",
    presets: [
      "Kamu disayang. Hari ini juga, apa pun rasanya.",
      "Sini, aku selimuti dulu. Kamu nggak sendirian.",
    ],
  },
  listening: {
    label: "I'm Listening",
    purpose: "Siap mendengarkan, tanpa langsung memberi nasihat.",
    presets: [
      "Ceritain aja, sepelan apa pun. Aku dengerin, nggak akan menghakimi.",
      "Aku di sini buat dengerin, bukan buat benerin.",
    ],
    okNote: "Pastikan ini undangan, bukan tuntutan untuk bercerita.",
  },
  space: {
    label: "Give You Gentle Space",
    purpose: "Menghormati kebutuhan untuk tenang, sambil tetap ada.",
    presets: [
      "Pelan-pelan aja, sayang. Kamu nggak harus membalas sekarang.",
      "Aku kasih kamu ruang. Lampunya tetap kunyalakan di sini.",
    ],
  },
};

export const GESTURES: { key: HoldGesture; label: string; emoji: string }[] = [
  { key: "wrap", label: "Menyelimuti", emoji: "🧣" },
  { key: "glow", label: "Cahaya hangat", emoji: "🕯️" },
  { key: "hand", label: "Menggenggam", emoji: "🤲" },
];

export function fitNote(need: HoldNeed, action: HoldAction): string | null {
  if (need === action || (need === "loved" && action === "warmth") || (need === "vent" && action === "listening")) {
    return "Ini yang dia minta.";
  }
  return ACTIONS[action].okNote ?? "Bukan yang dia minta persis — tapi tetap lembut.";
}

/** What the sender sees once the gesture has arrived. */
export const RECEIVED_LINE: Record<HoldAction, string> = {
  stay: "Ada cahaya kedua di sampingmu sekarang.",
  warmth: "Kamu sedang diselimuti sesuatu yang hangat.",
  listening: "Seseorang sedang mendengarkan.",
  space: "Ruangmu dijaga. Satu cahaya kecil tetap di sini.",
};

export const AFTER: { key: HoldAfter; label: string; line: string }[] = [
  { key: "less_alone", label: "I feel a little less alone", line: "Aku merasa sedikit lebih ditemani." },
  { key: "longer", label: "Stay with me a little longer", line: "Temani aku sedikit lebih lama." },
  { key: "quiet", label: "I'm ready for some quiet", line: "Aku ingin tenang dulu." },
];

/** What the recipient reads once the sender has chosen. Never "fixed". */
export const AFTER_FOR_PARTNER: Record<HoldAfter, string> = {
  less_alone: "Dia merasa sedikit lebih ditemani. Terima kasih sudah hadir. ♡",
  longer: "Dia ingin ditemani sedikit lebih lama.",
  quiet: "Dia ingin tenang dulu. Kamu nggak perlu membalas apa-apa.",
};

export const STATUS_LABEL: Record<string, string> = {
  pending: "menunggu",
  opened: "sudah dibuka",
  responded: "sudah ditemani",
  continued: "ditemani lebih lama",
  closed: "selesai",
  expired: "berlalu",
};
