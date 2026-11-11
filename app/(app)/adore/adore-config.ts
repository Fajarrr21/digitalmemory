import type { AdoreReaction, AdoreType, WishState } from "@/lib/supabase/database.types";

/**
 * All copy for "the way i adore you." lives here, in Indonesian. The feature
 * name itself stays as-is, like the app's other named spaces. `slug` is the
 * URL segment under /adore (never shown).
 */
export const KINDS: Record<AdoreType, { slug: string; label: string; tagline: string; emoji: string }> = {
  reason: {
    slug: "reasons",
    label: "Hal-Hal yang Kukagumi Darimu",
    tagline: "Seribu alasan kecil, semuanya tentang kamu.",
    emoji: "♡",
  },
  open_when: {
    slug: "open-when",
    label: "Buka Saat Kamu…",
    tagline: "Surat untuk setiap versi dirimu.",
    emoji: "✉️",
  },
  through_my_eyes: {
    slug: "eyes",
    label: "Lewat Mataku",
    tagline: "Kalau kamu bisa melihat dirimu lewat mataku, kamu akan mengerti.",
    emoji: "👁️",
  },
  thousand: {
    slug: "thousand",
    label: "Seribu Kali, Kamu",
    tagline: "Setiap angka punya alasannya.",
    emoji: "∞",
  },
  surprise: {
    slug: "surprise",
    label: "Malam Ini, Aku Memilihmu",
    tagline: "Kejutan kecil, di saat yang tepat.",
    emoji: "🎁",
  },
  remembered: {
    slug: "remember",
    label: "Aku Ingat Itu",
    tagline: "Aku ingat hal-hal kecil yang kamu ceritakan.",
    emoji: "📌",
  },
  another_universe: {
    slug: "universe",
    label: "Di Semesta Lain",
    tagline: "Di semesta mana pun, aku tetap akan menemukanmu.",
    emoji: "🪐",
  },
  reasons_i_stay: {
    slug: "stay",
    label: "Alasan Aku Bertahan",
    tagline: "Bukan karena semuanya sempurna, tapi karena kamu berarti.",
    emoji: "⚓",
  },
  future_wish: {
    slug: "future",
    label: "Masa Depan Bersamamu",
    tagline: "Mimpi-mimpi kecil, pelan-pelan jadi rencana.",
    emoji: "🌱",
  },
  name_page: {
    slug: "name",
    label: "Namamu, Kata Favoritku",
    tagline: "Satu halaman kecil untuk namamu.",
    emoji: "✍️",
  },
  notification: {
    slug: "notes",
    label: "Notifikasi Favoritku",
    tagline: "Notifikasi yang ditulis khusus untukmu.",
    emoji: "🔔",
  },
};

/** The main collections (big cards on /adore). */
export const KIND_ORDER: AdoreType[] = ["reason", "open_when", "through_my_eyes", "thousand", "surprise"];
/** "Hal kecil lainnya" (smaller links). */
export const MORE_KINDS: AdoreType[] = [
  "remembered",
  "another_universe",
  "reasons_i_stay",
  "future_wish",
  "name_page",
  "notification",
];
export const ALL_KINDS: AdoreType[] = [...KIND_ORDER, ...MORE_KINDS];

/** Link straight to one item (the name page has no list, so no id). */
export function itemHref(kind: AdoreType, id: string): string {
  return kind === "name_page" ? `/adore/${KINDS[kind].slug}` : `/adore/${KINDS[kind].slug}?id=${id}`;
}

export function kindFromSlug(slug: string): AdoreType | null {
  return ALL_KINDS.find((k) => KINDS[k].slug === slug) ?? null;
}

const REASON_CATEGORIES = [
  { key: "personality", label: "Kepribadianmu" },
  { key: "habits", label: "Kebiasaan Kecilmu" },
  { key: "speak", label: "Caramu Berbicara" },
  { key: "kindness", label: "Kebaikanmu" },
  { key: "details", label: "Detail Kecil tentangmu" },
  { key: "things", label: "Hal-Hal yang Kamu Lakukan" },
  { key: "simply", label: "Kamu Apa Adanya" },
];

/** Per-kind categories (keys are stored in the DB — never rename a key, only its label). */
export const CATEGORIES: Record<AdoreType, { key: string; label: string }[]> = {
  reason: REASON_CATEGORIES,
  thousand: REASON_CATEGORIES,
  remembered: [
    { key: "drink", label: "Minuman favorit" },
    { key: "food", label: "Makanan favorit" },
    { key: "dislikes", label: "Yang nggak dia suka" },
    { key: "songs", label: "Lagu yang dia suka" },
    { key: "habits", label: "Kebiasaan kecilnya" },
    { key: "dates", label: "Tanggal penting" },
    { key: "happy", label: "Yang bikin dia senang" },
    { key: "uncomfortable", label: "Yang bikin dia nggak nyaman" },
    { key: "interests", label: "Yang lagi dia suka sekarang" },
    { key: "goals", label: "Yang ingin dia capai" },
  ],
  another_universe: [
    { key: "city", label: "Kalau Kita Satu Kota" },
    { key: "morning", label: "Pagi Biasa Pertama Kita" },
    { key: "nodistance", label: "Sehari Tanpa Jarak" },
    { key: "places", label: "Tempat yang Ingin Kukunjungi Bersamamu" },
    { key: "day", label: "Kalau Kita Bisa Seharian Bersama" },
    { key: "little", label: "Hal-Hal Kecil yang Ingin Kualami Bersamamu" },
  ],
  reasons_i_stay: [
    { key: "appreciate", label: "Yang Kuhargai dari Kita" },
    { key: "worth", label: "Yang Membuat Ini Berarti" },
    { key: "protect", label: "Yang Ingin Kujaga" },
    { key: "learned", label: "Yang Kupelajari Darimu" },
    { key: "choosing", label: "Kenapa Aku Terus Memilihmu" },
    { key: "forget", label: "Yang Kuharap Nggak Pernah Kita Lupakan" },
  ],
  future_wish: [
    { key: "places", label: "Tempat untuk dikunjungi" },
    { key: "experiences", label: "Hal untuk dialami" },
    { key: "food", label: "Makanan untuk dicoba bareng" },
    { key: "movies", label: "Film untuk ditonton" },
    { key: "activities", label: "Kegiatan untuk dilakukan" },
    { key: "milestones", label: "Pencapaian pribadi" },
    { key: "dreams", label: "Mimpi bersama" },
  ],
  name_page: [
    { key: "cream", label: "Krem (terang)" },
    { key: "blush", label: "Merah muda lembut" },
    { key: "grey", label: "Abu-abu lembut" },
    { key: "night", label: "Malam (gelap)" },
  ],
  notification: [
    { key: "proud", label: "Bangga sama kamu" },
    { key: "care", label: "Jaga diri" },
    { key: "remind", label: "Sekadar mengingatkan" },
    { key: "adore", label: "Aku sayang kamu" },
  ],
  surprise: [
    { key: "morning", label: "Kejutan Pagi" },
    { key: "midnight", label: "Kejutan Tengah Malam" },
    { key: "special", label: "Kejutan Tanggal Spesial" },
    { key: "random", label: "Kejutan Acak" },
    { key: "unscheduled", label: "Kejutan Tanpa Jadwal" },
  ],
  open_when: [
    { key: "sad", label: "Buka saat kamu sedih" },
    { key: "miss", label: "Buka saat kamu kangen aku" },
    { key: "sleep", label: "Buka saat kamu nggak bisa tidur" },
    { key: "doubt", label: "Buka saat kamu ragu sama dirimu" },
    { key: "overwhelmed", label: "Buka saat kamu kewalahan" },
    { key: "happy", label: "Buka saat kamu bahagia" },
    { key: "hug", label: "Buka saat kamu butuh pelukan" },
    { key: "angry", label: "Buka saat kamu lagi marah" },
    { key: "lonely", label: "Buka saat kamu merasa sendirian" },
    { key: "remember", label: "Buka saat kamu perlu mengingat kita" },
  ],
  through_my_eyes: [
    { key: "see", label: "Caraku Melihatmu" },
    { key: "beautiful", label: "Yang Membuatmu Indah" },
    { key: "notice", label: "Yang Nggak Kamu Sadari tentang Dirimu" },
    { key: "wish", label: "Yang Ingin Kamu Tahu" },
    { key: "version", label: "Versi Dirimu yang Paling Kusuka" },
    { key: "stay", label: "Hal-Hal Kecil yang Selalu Kuingat" },
  ],
};

export function categoryLabel(kind: AdoreType, key: string | null): string | null {
  return CATEGORIES[kind].find((c) => c.key === key)?.label ?? null;
}

export const REACTIONS: { key: AdoreReaction; emoji: string; label: string }[] = [
  { key: "loved", emoji: "♡", label: "Suka banget" },
  { key: "emotional", emoji: "🥺", label: "Bikin terharu" },
  { key: "smile", emoji: "🥰", label: "Bikin senyum" },
  { key: "appreciated", emoji: "🫶", label: "Merasa dihargai" },
  { key: "favorite", emoji: "✨", label: "Favoritku" },
];

/** Studio time presets per surprise moment (author's wall clock). */
export const MOMENT_TIME: Record<string, string> = { morning: "06:00", midnight: "00:00" };

/** What the button gives when the pool is empty. */
export const DEFAULT_SURPRISE = {
  title: "kotaknya belum ada isi baru",
  body: "Tapi ada satu hal yang nggak pernah habis: aku senang kamu jadi dirimu sendiri. Mampir lagi nanti ya. ♡",
};

export const WISH_STATES: { key: WishState; label: string }[] = [
  { key: "someday", label: "Suatu hari" },
  { key: "planned", label: "Direncanakan" },
  { key: "in_progress", label: "Sedang jalan" },
  { key: "fulfilled", label: "Terwujud ♡" },
];

/** WhatsApp frequency she can choose for Notifikasi Favoritku (0 = off, the default). */
export const NOTIF_FREQ = [0, 1, 2, 3] as const;

export const STATUS_LABEL: Record<string, string> = {
  draft: "draf",
  published: "terbit",
  scheduled: "terjadwal",
  archived: "arsip",
};
