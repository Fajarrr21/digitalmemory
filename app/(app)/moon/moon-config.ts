import type { MoonFlow, MoonMood, MoonNeed, MoonReminderKind } from "@/lib/supabase/database.types";
import type { Confidence } from "@/lib/moon/cycle";
import type { Symptom } from "@/lib/moon/insights";

/**
 * her little moon. — the words. Warm and plain, never clinical; honest about
 * what an estimate is. Nothing here diagnoses or promises a date.
 */

export const MOON_TITLE = "her little moon. ♡";
export const MOON_TAGLINE = "Mengenal tubuhmu sendiri, pelan-pelan.";

export const SYMPTOM_LABEL: Record<Symptom, { label: string; emoji: string }> = {
  cramps: { label: "Kram / nyeri perut", emoji: "🌸" },
  headache: { label: "Sakit kepala", emoji: "💫" },
  nausea: { label: "Mual", emoji: "🌧️" },
  vomiting: { label: "Muntah", emoji: "🫧" },
  fatigue: { label: "Lelah", emoji: "🌙" },
};

export const CRAMPS: { value: number; label: string }[] = [
  { value: 1, label: "ringan" },
  { value: 2, label: "sedang" },
  { value: 3, label: "berat" },
];

export const MOODS: { key: MoonMood; label: string; emoji: string }[] = [
  { key: "calm", label: "tenang", emoji: "🍃" },
  { key: "happy", label: "senang", emoji: "☀️" },
  { key: "sensitive", label: "sensitif", emoji: "🥺" },
  { key: "sad", label: "sedih", emoji: "🌧️" },
  { key: "irritable", label: "gampang kesal", emoji: "🌶️" },
  { key: "anxious", label: "cemas", emoji: "🌀" },
];

export const ENERGY: { value: number; label: string }[] = [
  { value: 1, label: "lemah" },
  { value: 2, label: "biasa" },
  { value: 3, label: "segar" },
];

export const FLOW: { key: MoonFlow; label: string; dots: number }[] = [
  { key: "spotting", label: "bercak", dots: 1 },
  { key: "light", label: "sedikit", dots: 2 },
  { key: "medium", label: "sedang", dots: 3 },
  { key: "heavy", label: "banyak", dots: 4 },
];

export const moodLabel = (k: string | null) => MOODS.find((m) => m.key === k);
export const flowLabel = (k: string | null) => FLOW.find((f) => f.key === k)?.label;

export const CONFIDENCE_TEXT: Record<Confidence, string> = {
  none: "",
  low: "Baru dari satu siklus — anggap ini tebakan kasar dulu.",
  limited: "Masih dari sedikit siklus, jadi rentangnya dibuat lebih lebar.",
  varied: "Siklusmu cukup bervariasi, jadi rentangnya lebih lebar. Itu wajar.",
  steady: "Berdasarkan beberapa siklus terakhirmu.",
};

export const NOT_MEDICAL =
  "Perkiraan ini dihitung dari catatanmu sendiri, bukan kepastian — dan bukan alat medis, kontrasepsi, atau penanda masa subur.";

export const CARE_NOTE_TEXT =
  "Kalau nyerinya berat atau nggak membaik, muntah berulang, atau susah minum, pertimbangkan untuk periksa ke tenaga kesehatan ya. Nyeri dan mual juga bisa datang dari hal lain, bukan selalu karena menstruasi.";

export const NEEDS: { key: MoonNeed; label: string; line: string; emoji: string }[] = [
  { key: "extra_care", label: "I need a little extra care.", line: "Aku butuh diperhatikan sedikit lebih.", emoji: "🤍" },
  { key: "company", label: "Please keep me company.", line: "Temani aku, ya.", emoji: "🕯️" },
  { key: "cheer", label: "I could use some cheering up.", line: "Hibur aku sedikit.", emoji: "🌼" },
  { key: "space", label: "I need some space today.", line: "Hari ini aku butuh ruang dulu.", emoji: "🌙" },
  { key: "help", label: "Could you help me with something?", line: "Bisa bantu aku sesuatu?", emoji: "🧺" },
  { key: "share", label: "I want to share how I feel.", line: "Aku mau cerita perasaanku.", emoji: "💬" },
];
export const needInfo = (k: MoonNeed) => NEEDS.find((n) => n.key === k)!;

export const REMINDER_KINDS: { key: MoonReminderKind; label: string }[] = [
  { key: "checkin", label: "Check-in harian" },
  { key: "period", label: "Mencatat siklus" },
  { key: "insights", label: "Melihat catatan & insight" },
  { key: "custom", label: "Pengingat lain (tulis sendiri)" },
];

export const SHARE_OPTIONS = [
  {
    key: "share_phase" as const,
    label: "Kabarkan kalau aku sedang menstruasi / perkiraannya sudah dekat",
    sees: "dia bisa melihat “sedang menstruasi” atau “perkiraan sekitar …”",
  },
  {
    key: "share_symptoms" as const,
    label: "Tunjukkan gejala yang kucatat hari ini",
    sees: "hanya nama gejalanya (mis. kram, lelah) — tidak pernah catatan, mood, atau perdarahan",
  },
  {
    key: "partner_heads_up" as const,
    label: "Ingatkan dia sehari sebelum perkiraan menstruasiku",
    sees: "satu pengingat lembut di aplikasinya (bukan WhatsApp), tanpa detail",
  },
];
