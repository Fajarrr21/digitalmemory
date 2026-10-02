// 🌙 SEJAUH INI, KITA
// "A story of everything we've been, everything we are,
//  and everything we haven't reached yet."
//
// Bukan Diary ("apa yang terjadi hari ini?"), bukan Memories ("apa yang pernah
// kita lakukan?"). Ruang ini menjawab: "sebenarnya… sudah sejauh apa kita
// berjalan?"
//
// SEMUA teks ada di sini. Edit bebas tanpa menyentuh komponennya. `\n` = pindah
// baris di dalam satu blok. Jejak di jalan (💌 📸 🎬 🌷 🕯️ …) TIDAK ditulis di
// sini — semuanya diambil otomatis dari fitur lain (lib/journey/queries.ts),
// jadi jalannya memanjang sendiri setiap kali kalian menjalani sesuatu di app.

import type { JourneyStop } from "@/lib/supabase/database.types";
import type { FootprintKind, JourneyStatKey } from "@/lib/journey/logic";

// ── 🎵 Lagu — jiwa dari perjalanan ini ─────────────────────────────────────────
// Mulai pelan saat "Mulai perjalanan", berjalan terus sepanjang cerita, dan
// TIDAK diulang: perjalanan selesai ketika lagu selesai — tapi jalannya tidak.
// `youtubeId` dari link YouTube (youtu.be/XXXX → "XXXX"). "" = tanpa musik.
export const JOURNEY_SONG = {
  youtubeId: "__Pb1fO2H2A", // Overnight — Kita Lewati Berdua (Official Audio)
  startSeconds: 0,
  title: "Overnight — Kita Lewati Berdua",
};

// ── Awal cerita (ISI SENDIRI ✏️) ───────────────────────────────────────────────
// Tanggal kalian mulai — dipakai untuk "N days". `YYYY-MM-DD`. Kalau "", angka
// hari dihitung dari jejak paling awal di app ini.
export const STARTED_ON = "";

// "First"-nya kalian. Yang `value`-nya "" tidak ditampilkan — jadi isi yang
// memang kamu ingat saja. `spotify` (opsional) = link lagu Spotify → muncul
// player-nya saat kartu itu dibuka.
export type FirstFact = {
  emoji: string;
  label: string;
  value: string; // mis. "12 Januari 2025" atau "Jam 11 malam, lewat DM"
  note?: string; // satu kalimat kecil di bawahnya
  spotify?: string;
};

export const FIRSTS: FirstFact[] = [
  { emoji: "👋", label: "Pertama kenal", value: "", note: "" },
  { emoji: "💬", label: "First chat", value: "", note: "" },
  { emoji: "📞", label: "First call", value: "", note: "" },
  { emoji: "🏷️", label: "First nickname", value: "", note: "" },
  { emoji: "🎧", label: "First song", value: "", note: "", spotify: "" },
  { emoji: "✨", label: "Momen pertama yang terasa spesial", value: "", note: "" },
];

// Hari-hari yang tidak mudah — HANYA yang kamu sendiri anggap layak masuk
// cerita. Jangan pernah otomatis dari isi chat. Kosong = cukup prosa saja.
// `date` opsional (`YYYY-MM-DD`).
export const HARD_DAYS: { date?: string; line: string }[] = [];

// ── Pembuka ─────────────────────────────────────────────────────────────────────
export const OPENING = {
  title: "Sejauh Ini, Kita",
  tagline: "A story of how two people became “us”.",
  lines: [
    "Awalnya, kita cuma dua orang.",
    "Kamu dengan duniamu.\nAku dengan duniaku.",
    "Lalu entah bagaimana…\nkita menemukan satu sama lain.",
  ],
  beginLabel: "Mulai perjalanan →",
};

// ── Bab-bab ─────────────────────────────────────────────────────────────────────
// `beats` muncul satu per satu (ketuk untuk lanjut). `after` muncul setelah
// isi khusus bab itu (jejak, kartu, dsb). `stop` = titik tempat Presence Note
// ("aku pernah berhenti di sini") bisa ditinggalkan.
export type ChapterKind = "beginning" | "along" | "little" | "hard" | "far" | "learned";

export type Chapter = {
  kind: ChapterKind;
  stop: JourneyStop;
  no: string;
  emoji: string;
  title: string;
  subtitle?: string;
  beats: string[];
  after?: string[];
};

export const CHAPTERS: Chapter[] = [
  {
    kind: "beginning",
    stop: "beginning",
    no: "01",
    emoji: "🌱",
    title: "When We Found Each Other",
    subtitle: "kita bertemu.",
    beats: [
      "Aku masih ingat waktu pertama kali kita mulai sering ngobrol.",
      "Waktu itu aku belum tahu\nkalau seseorang yang awalnya cuma ada di layar\nbakal punya tempat sebesar ini di hidupku.",
    ],
  },
  {
    kind: "along",
    stop: "along",
    no: "02",
    emoji: "🫶",
    title: "Somewhere Along The Way",
    subtitle: "lalu jadi kita.",
    beats: [
      "Aku nggak tahu tepatnya kapan.",
      "Kapan ngobrol denganmu berubah\nmenjadi sesuatu yang kutunggu.",
      "Kapan kabarmu menjadi bagian dari hariku.",
      "Kapan aku mulai berpikir…\n‘Oh. Ternyata sekarang ada kita.’",
    ],
  },
  {
    kind: "little",
    stop: "little",
    no: "03",
    emoji: "🌷",
    title: "Little Things We Did",
    subtitle: "jejak-jejak kecil.",
    beats: [
      "Bukan cuma momen besar.",
      "Ternyata hubungan kita\ndibangun dari hal-hal kecil.",
    ],
    after: ["Setiap jejak di sini, kita sendiri yang bikin. ♡"],
  },
  {
    kind: "hard",
    stop: "hard",
    no: "04",
    emoji: "🌧️",
    title: "The Days That Were Not Easy",
    beats: [
      "Nggak semua bagian perjalanan kita indah.",
      "Ada hari ketika kita salah paham.",
      "Ada hari ketika salah satu dari kita capek.",
      "Ada hari ketika jarak terasa lebih jauh dari biasanya.",
      "Ada hari ketika kita bahkan nggak tahu harus bilang apa.",
    ],
    after: ["Tapi lihat.", "Jalannya tetap ada.\nDan kita masih di sini."],
  },
  {
    kind: "far",
    stop: "far",
    no: "05",
    emoji: "🌙",
    title: "Even From Far Away",
    beats: [
      "Kadang kita nggak bisa berada di tempat yang sama.",
      "Kadang kamu punya harimu sendiri.\nAku punya hariku sendiri.",
      "Tapi mungkin…\nberjalan bersama bukan berarti\nharus selalu berada di tempat yang sama.",
    ],
    after: ["Ini cara-cara kecil kita tetap hadir."],
  },
  {
    kind: "learned",
    stop: "learned",
    no: "06",
    emoji: "🌿",
    title: "We Know Each Other A Little Better Now",
    beats: [
      "Dulu aku cuma tahu namamu.",
      "Sekarang aku tahu hal-hal kecil tentangmu.\nApa yang bikin kamu senang.\nApa yang bikin kamu diam.",
      "Kapan kamu butuh ditemani.\nKapan kamu butuh ruang.",
      "Dan mungkin aku masih belum tahu semuanya.\nTapi sekarang aku ingin terus belajar.",
    ],
  },
];

// ── 05 · cara-cara kita tetap hadir dari jauh ──────────────────────────────────
// `count` diisi dari data (lib/journey/queries.ts → `ways`).
export type WayKey = "meanwhile" | "watch" | "voice" | "letters" | "ratings" | "flame";
export const FAR_WAYS: { key: WayKey; emoji: string; label: string; unit: string; href: string }[] = [
  { key: "letters", emoji: "💌", label: "Letters", unit: "surat", href: "/letter" },
  { key: "watch", emoji: "🍿", label: "Watch Together", unit: "kali nonton bareng", href: "/watch/history" },
  { key: "voice", emoji: "🎙️", label: "Voice notes", unit: "suara yang dikirim", href: "/diary" },
  { key: "meanwhile", emoji: "🌙", label: "Meanwhile", unit: "momen yang dibagi", href: "/meanwhile/archive" },
  { key: "ratings", emoji: "📝", label: "How was your day?", unit: "hari yang diceritakan", href: "/diary" },
  { key: "flame", emoji: "🕯️", label: "Our Little Flame", unit: "hari kita sama-sama muncul", href: "/flame" },
];

// ── 06 · Things I Know About You ───────────────────────────────────────────────
export const KNOWING_KINDS: { emoji: string; label: string; placeholder: string }[] = [
  { emoji: "♡", label: "likes", placeholder: "hal kecil yang bikin dia senang…" },
  { emoji: "☕", label: "comfort", placeholder: "yang bikin dia nyaman…" },
  { emoji: "🌙", label: "when sad", placeholder: "kalau lagi sedih, dia butuh…" },
  { emoji: "🎧", label: "favorite", placeholder: "lagu / makanan / tempat favoritnya…" },
  { emoji: "🫶", label: "needs", placeholder: "yang dia butuhkan, walau jarang bilang…" },
];

// ── "Look how far we've come" ──────────────────────────────────────────────────
export const HOW_FAR = {
  wait: "Wait.",
  look: "Look how far we've come.",
  // Satuan setiap angka. Angka 0 tidak ditampilkan. Ini bukan achievement.
  units: {
    days: "days",
    letters: "letters",
    memories: "memories",
    watch: "watch sessions",
    photobooth: "photobooth frames",
    flame: "flame days",
    songs: "songs shared",
    voice: "voice notes",
    moments: "little moments",
  } satisfies Record<JourneyStatKey, string>,
  countless: "countless conversations",
  closing: "And somehow…\nwe're still here.",
};

// ── Sekarang ───────────────────────────────────────────────────────────────────
export const NOW = {
  marker: "NOW",
  title: "This is us.",
  lines: [
    "Bukan versi kita waktu pertama bertemu.\nBukan versi kita beberapa bulan yang lalu.",
    "Tapi kita yang sekarang.",
    "Setelah semua percakapan.\nSemua tawa.\nSemua rindu.",
    "Semua hari baik.\nSemua hari yang nggak mudah.",
  ],
  final: "Kita sampai di sini.",
};

// ── Jalan di depan ─────────────────────────────────────────────────────────────
export const AHEAD = {
  lines: [
    "Aku nggak tahu apa yang ada di depan.\nKita juga belum tahu.",
    "Masih ada banyak hari yang belum kita jalani.\nBanyak tempat yang belum kita lihat.\nBanyak cerita yang belum kita tulis.",
    "Tapi lihat sejauh apa kita sudah berjalan.",
    "Jadi…",
  ],
  final: "let's keep going. ♡",
  songEnded: "lagunya sudah selesai.\njalannya belum.",
  continueLabel: "Continue →",
  replayLabel: "↺ dari awal",
  epigraph:
    "Sejauh ini, kita.\nA story of everything we've been, everything we are,\nand everything we haven't reached yet.",
};

// ── Jejak di jalan (diambil otomatis dari fitur lain) ──────────────────────────
// `firstTitle` dipakai untuk jejak pertama dari jenisnya ("The First Letter").
export const KIND_META: Record<
  FootprintKind,
  { emoji: string; title: string; firstTitle: string; caption: string; open: string }
> = {
  start: {
    emoji: "🌱",
    title: "The day this little place opened",
    firstTitle: "The day this little place opened",
    caption: "Hari pertama tempat kecil ini punya penghuni.",
    open: "",
  },
  letter: {
    emoji: "💌",
    title: "A Letter",
    firstTitle: "The First Letter",
    caption: "Kata-kata yang nggak cukup kalau cuma diucapkan.",
    open: "Buka surat →",
  },
  "daily-letter": {
    emoji: "✉️",
    title: "A Daily Letter",
    firstTitle: "The First Daily Letter",
    caption: "Surat pertama yang menunggu di pagi hari.",
    open: "Ke surat →",
  },
  memory: {
    emoji: "🌷",
    title: "A Memory",
    firstTitle: "Our First Memory",
    caption: "Sesuatu yang kita putuskan untuk disimpan.",
    open: "Open memory →",
  },
  photobooth: {
    emoji: "📸",
    title: "Our Little Photo",
    firstTitle: "Our First Photobooth",
    caption: "One of those random moments we decided to keep.",
    open: "Lihat fotonya →",
  },
  watch: {
    emoji: "🎬",
    title: "Watched Together",
    firstTitle: "Our First Watch Together",
    caption: "Satu layar, dua orang, di tempat yang berbeda.",
    open: "Lihat lagi →",
  },
  album: {
    emoji: "🖼️",
    title: "A New Album",
    firstTitle: "Our First Album",
    caption: "Tempat baru untuk menyimpan potongan-potongan kita.",
    open: "Buka album →",
  },
  voice: {
    emoji: "🎙️",
    title: "A Voice Note",
    firstTitle: "The First Voice Note",
    caption: "Biar suaranya ikut sampai, bukan cuma tulisannya.",
    open: "Ke harinya →",
  },
  rating: {
    emoji: "📝",
    title: "How Was Your Day?",
    firstTitle: "The First “How Was Your Day?”",
    caption: "Pertama kali sebuah hari diceritakan ke satu sama lain.",
    open: "Ke harinya →",
  },
  coloring: {
    emoji: "🎨",
    title: "A Coloured Day",
    firstTitle: "The First Coloured Day",
    caption: "Hari yang nggak cukup diceritakan, jadi diwarnai.",
    open: "Ke harinya →",
  },
  meanwhile: {
    emoji: "🌙",
    title: "A Meanwhile Moment",
    firstTitle: "The First Meanwhile",
    caption: "Momen kecil waktu kita sedang sibuk dengan dunia masing-masing.",
    open: "Ke arsip →",
  },
  song: {
    emoji: "🎧",
    title: "A Song",
    firstTitle: "Our First Shared Song",
    caption: "Lagu yang tiba-tiba punya arti.",
    open: "Ke arsip →",
  },
  flame: {
    emoji: "🕯️",
    title: "A Little Flame",
    firstTitle: "The First Spark",
    caption: "Hari-hari kita sama-sama muncul.",
    open: "Lihat api kecil kita →",
  },
};

export const UI = {
  tapHint: "ketuk untuk lanjut",
  next: "Lanjut →",
  back: "kembali",
  muteOn: "Matikan musik",
  muteOff: "Nyalakan musik",
  noteLeftHere: (name: string) => `${name} left something here`,
  leaveNote: "✎ tinggalkan jejak di sini",
  notePlaceholder: "Aku pernah berhenti di sini…",
  noteSave: "Tinggalkan",
  cancel: "batal",
  emptyRoad: "Jalannya baru dimulai. Jejak pertama akan muncul di sini. ♡",
  close: "tutup",
};
