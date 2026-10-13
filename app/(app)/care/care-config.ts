import type {
  CareAfter,
  CareRedFlag,
  CareSeverity,
  CareSymptom,
  CareWant,
} from "@/lib/supabase/database.types";

/**
 * Little Care — all the words. The rules live in lib/care/logic.ts; the
 * database (0019) is the final say.
 *
 * Copy rule: comfort, never treatment. No diagnosis, no medicine, no dosage,
 * no "this will make it go away". Warmth + a clear way to real medical help.
 */

export const CARE_TITLE = "Little Care";
export const CARE_TAGLINE = "A little comfort, from someone who loves you.";
export const CARE_QUOTE =
  "Kalau aku belum bisa menghilangkan rasa sakitmu, setidaknya aku ingin membuatmu merasa nggak sendirian.";
export const CARE_HEADLINE = "Aku di sini, untuk kamu.";
export const CARE_INTRO =
  "Kalau perutmu lagi nggak nyaman atau badanmu lagi nggak enak, kamu bisa bilang ke aku apa yang kamu rasakan. Kita mulai dari hal kecil yang mungkin kamu butuhkan.";

export const NOT_MEDICAL =
  "Little Care bukan alat medis. Pilihan di sini hanya membantu pasanganmu memahami keadaanmu — bukan diagnosis, dan bukan tanda bahwa kondisimu aman.";

export const SYMPTOMS: { key: CareSymptom; label: string; emoji: string }[] = [
  { key: "stomach", label: "Sakit perut", emoji: "🫧" },
  { key: "nausea", label: "Mual atau muntah", emoji: "🌧️" },
  { key: "cramps", label: "Kram menstruasi", emoji: "🌸" },
  { key: "dizzy", label: "Pusing", emoji: "💫" },
  { key: "weak", label: "Lemas atau kelelahan", emoji: "🌙" },
  { key: "other", label: "Keluhan lainnya", emoji: "🤍" },
];

export function symptomInfo(key: CareSymptom) {
  return SYMPTOMS.find((s) => s.key === key)!;
}

export const SEVERITY: { key: CareSeverity; label: string; dots: number }[] = [
  { key: "mild", label: "Ringan", dots: 1 },
  { key: "moderate", label: "Sedang", dots: 2 },
  { key: "severe", label: "Berat", dots: 3 },
];

export function severityLabel(key: CareSeverity | null | undefined) {
  return SEVERITY.find((s) => s.key === key)?.label ?? "—";
}

/** Warning signs — any one of these points straight to medical help. */
export const RED_FLAGS: { key: CareRedFlag; label: string }[] = [
  { key: "severe_pain", label: "Nyerinya hebat, atau makin lama makin parah" },
  { key: "repeated_vomiting", label: "Muntah berulang kali" },
  { key: "no_fluids", label: "Nggak bisa menahan minum — langsung keluar lagi" },
  { key: "dehydrated", label: "Sangat lemas, susah minum, jarang buang air kecil, atau mulut sangat kering" },
  { key: "fainted", label: "Pingsan atau hampir pingsan" },
  { key: "heavy_bleeding", label: "Perdarahan banyak" },
  { key: "pregnant_pain", label: "Mungkin sedang hamil, dan perutnya nyeri" },
];

export function redFlagLabel(key: CareRedFlag) {
  return RED_FLAGS.find((r) => r.key === key)?.label ?? key;
}

export const WANTS: { key: CareWant; label: string; emoji: string; line: string; note?: string }[] = [
  {
    key: "warm",
    label: "Warm Comfort",
    emoji: "🕯️",
    line: "Temani aku sambil istirahat. Boleh juga ingatkan kompres hangat kalau rasanya cocok.",
    note: "Kompres hangat bisa terasa nyaman, tapi bukan obat — dan nggak menghilangkan penyebab sakitnya.",
  },
  {
    key: "drink",
    label: "A Little Drink",
    emoji: "🍵",
    line: "Tawarkan aku minum, atau bantu siapkan kalau bisa.",
  },
  {
    key: "stay",
    label: "Stay With Me",
    emoji: "🤍",
    line: "Tetap ada lewat pesan singkat — atau telepon kalau aku mau. Nggak perlu ngobrol panjang.",
  },
  {
    key: "quiet",
    label: "Quiet Time",
    emoji: "🌙",
    line: "Aku mau istirahat tenang, tanpa notifikasi berulang. Tinggalkan pesan untuk kubaca nanti.",
  },
  {
    key: "surprise",
    label: "Surprise Me Gently",
    emoji: "✨",
    line: "Kamu yang pilih satu perhatian kecil — pesan pendek, pelukan, atau cahaya hangat.",
  },
];

export function wantInfo(key: CareWant) {
  return WANTS.find((w) => w.key === key)!;
}

export const DRINK_SIP_NOTE =
  "Kalau masih mual atau muntah: sedikit demi sedikit, hanya kalau bisa ditelan. Jangan dipaksa.";

/** The carer's side. Labels + what the sender reads when it arrives. */
export const GESTURES: { key: "hug" | "glow" | "star"; label: string; emoji: string; received: string }[] = [
  { key: "hug", label: "Pelukan virtual", emoji: "🫂", received: "mengirim pelukan." },
  { key: "glow", label: "Cahaya hangat", emoji: "🕯️", received: "menyalakan cahaya hangat di dekatmu." },
  { key: "star", label: "Bintang penemani", emoji: "⭐", received: "menitipkan bintang kecil untuk menemanimu." },
];

export const ACCOMPANY: { key: "chat" | "call"; label: string; offer: string }[] = [
  { key: "chat", label: "Temani lewat chat", offer: "ingin menemanimu lewat chat — singkat saja, nggak perlu panjang." },
  { key: "call", label: "Tawarkan telepon", offer: "menawarkan telepon sebentar, kalau kamu mau." },
];

export const HELP: { key: "drink" | "family" | "medical" | "close"; label: string; offer: string }[] = [
  { key: "drink", label: "Siapkan / antar minum", offer: "menawarkan untuk menyiapkan atau mengantarkan minum." },
  { key: "medical", label: "Bantu cari pertolongan medis", offer: "menawarkan bantuan untuk mencari pertolongan medis atau menghubungi tenaga kesehatan." },
  { key: "family", label: "Bantu hubungi keluarga", offer: "menawarkan bantuan untuk menghubungi keluargamu." },
  { key: "close", label: "Bantu hubungi orang terdekat", offer: "menawarkan bantuan untuk menghubungi orang terdekat yang bisa datang." },
];

export const REST_RECEIVED =
  "akan membiarkanmu istirahat, tanpa terus menanyakan kabarmu. Tetap di sini kalau kamu butuh.";

export const MESSAGE_PRESETS = [
  "Sayang, kamu nggak perlu maksa diri buat ngobrol sama aku. Fokus istirahat dulu, ya. Aku di sini kalau kamu butuh aku. 🤍",
  "Pelan-pelan aja. Aku nggak ke mana-mana.",
  "Kalau sakitnya makin parah, bilang ke orang terdekat supaya kamu bisa segera diperiksa, ya.",
];

export const AFTER: { key: CareAfter; label: string; line: string }[] = [
  { key: "better", label: "Aku merasa sedikit lebih nyaman.", line: "Little Care ini ditutup dengan lembut." },
  { key: "longer", label: "Temani aku sedikit lebih lama.", line: "Ruangnya tetap terbuka, dan dia diberi tahu di app." },
  { key: "rest", label: "Aku mau istirahat dulu.", line: "Mode istirahat: nggak ada yang menuntut balasanmu." },
];

/** What the carer reads after the sender chose. */
export const AFTER_FOR_CARER: Record<CareAfter, string> = {
  better: "Dia merasa sedikit lebih nyaman. Terima kasih sudah merawatnya. ♡",
  longer: "Dia ingin ditemani sedikit lebih lama.",
  rest: "Dia sedang istirahat. Biarkan tenang dulu — satu pesan untuk dibaca nanti masih boleh.",
};

/** Emergency numbers (Indonesia): 112 general emergency, 119 medical / ambulance. */
export const EMERGENCY = [
  { tel: "119", label: "119 · Ambulans / medis" },
  { tel: "112", label: "112 · Darurat" },
];
