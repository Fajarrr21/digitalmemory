// ⏪ SEJAUH INI, KITA — "Kalau kita mundur sebentar ke belakang…"
//
// Rangkaian cerita tentang awal-awal kita, dari percakapan yang beneran ada:
// Instagram pertama → Instagram kedua → WhatsApp → first call. Muncul di dalam
// perjalanan /journey tepat setelah bab `STORY_AFTER`, lalu bab-bab lain
// lanjut seperti biasa. Di "Look how far we've come" ceritanya direkap, dan
// videonya diputar paling akhir sebelum THE ROAD AHEAD.
//
// ATURAN:
// - Isi `chat` HARUS kutipan asli (typo-nya juga). Jangan dikarang.
// - Momen yang urutannya nggak pasti dipisah `{ gap: true }` ("· · ·"), jadi
//   kita nggak pura-pura tahu kalau dua potongan itu berurutan.
// - Nomor HP, alamat, dsb JANGAN pernah ditulis di sini (ada test-nya).
// - Foto/video tidak disimpan di repo. Taruh di Storage privat lewat
//   `node --env-file=.env.local scripts/upload-journey-story.mjs <folder>`;
//   `key` di bawah = path di dalam folder space (`{space_id}/<key>`).
//   Kalau file-nya belum di-upload, scene foto tetap tampil (versi tanpa foto)
//   dan videonya dilewati.
//
// Menambah momen: tambah satu objek ke `STORY_MOMENTS` dengan `act` yang
// sesuai. Urutannya = urutan di array.

import type { ChapterKind } from "./journey-config";

/** Cerita disisipkan setelah bab ini. */
export const STORY_AFTER: ChapterKind = "beginning";

export type Who = "fajar" | "gita";
/** Yang di kanan (seperti di HP-nya Fajar, tempat screenshot-screenshot ini). */
export const RIGHT: Who = "fajar";

export type Bubble =
  /** pemisah waktu, persis seperti di aplikasinya */
  | { time: string }
  /** potongan lain dari obrolan — urutannya tidak diklaim */
  | { gap: true }
  /** pesan teks. `quote` = pesan yang sedang dibalas. `big` = emoji saja */
  | { from: Who; text: string; quote?: string; big?: boolean }
  /** lampiran — digambarkan, bukan ditampilkan */
  | {
      from: Who;
      attach: "sticker" | "voice" | "photo" | "story" | "contact" | "link";
      label: string;
      quote?: string;
    };

export type StoryActId = "ig1" | "ig2" | "wa";

export type StoryAct = {
  id: StoryActId;
  part: string; // "Bagian I"
  emoji: string;
  title: string; // "Instagram"
  sub: string; // "The First Account"
  handle: string; // yang tertulis di header chat
  tagline: string;
  lines: string[];
  /** Muncul di rekap "Look how far we've come". */
  recap: string;
  /** Warna bubble kanan, meniru aplikasinya masing-masing. */
  bubble: string;
};

export type StoryMoment = {
  id: string;
  act: StoryActId;
  emoji: string; // penanda di jalan
  marker: string; // nama singkat untuk rekap
  title: string;
  /** Kalimat sebelum chat (ketuk satu per satu). */
  before: string[];
  chat?: Bubble[];
  /** Foto sebagai visual utama (Storage key). */
  photo?: { key: string; caption: string; alt: string };
  /** Satu kalimat besar setelah `before` (dipakai di first call). */
  headline?: string;
  after: string[];
  /** Ikut ditampilkan di rekap. */
  recap?: boolean;
};

export const STORY_ACTS: StoryAct[] = [
  {
    id: "ig1",
    part: "Bagian I",
    emoji: "📷",
    title: "Instagram",
    sub: "The First Account",
    handle: "shegitta_",
    tagline: "Where it all started.",
    lines: [
      "Kalau kita mundur sebentar ke belakang…",
      "ternyata perjalanan kita dimulai dari hal-hal kecil.",
      "Dari kotak DM.\nDari stiker.\nDari typo.\nDari “wkwk” yang nggak ada habisnya.",
    ],
    recap: "Instagram",
    bubble: "#4d5e3b",
  },
  {
    id: "ig2",
    part: "Bagian II",
    emoji: "📷",
    title: "Instagram",
    sub: "The Second Account",
    handle: "hierre.re",
    tagline: "We got closer.",
    lines: [
      "Lalu kamu muncul lagi.\nDari akun yang lain.",
      "Akunnya boleh ganti.\nObrolannya tetap nyambung.",
    ],
    recap: "Second Account",
    bubble: "linear-gradient(135deg, #b02ccf 0%, #7a3ee6 100%)",
  },
  {
    id: "wa",
    part: "Bagian III",
    emoji: "💬",
    title: "WhatsApp",
    sub: "More Than Just Chat",
    handle: "Gita dukun ebeg",
    tagline: "The conversations became part of our days.",
    lines: [
      "Di WhatsApp, kontakmu kusimpan dengan nama…",
      "“Gita dukun ebeg.”",
      "Jangan tanya kenapa. 😭",
    ],
    recap: "WhatsApp",
    bubble: "#1d5a45",
  },
];

export const STORY_MOMENTS: StoryMoment[] = [
  // ── I · Instagram pertama ─────────────────────────────────────────────────────
  {
    id: "first-dm",
    act: "ig1",
    emoji: "👋",
    marker: "First DM",
    title: "The First DM",
    before: ["It started with a message.", "Pesan kecil yang waktu itu\nmungkin kelihatan biasa aja."],
    chat: [
      { time: "26 JUL, 17.58" },
      { from: "gita", attach: "story", label: "membalas ceritamu — aku di depan air terjun" },
      { from: "gita", text: "eh ini curug mana kak" },
      { from: "fajar", text: "curug ambyar kak" },
      { from: "fajar", text: "atas gomblang" },
      { time: "26 JUL, 19.41" },
      { from: "gita", text: "oh iyakah? aku kesana kok gada" },
    ],
    after: [
      "Bukan aku yang mulai.\nKamu yang bales story-ku.",
      "Nanya curug.\nManggilnya masih “kak”. Sopan banget.",
      "Siapa sangka,\nsatu pertanyaan soal air terjun\nbakal ngalir sejauh ini.",
    ],
    recap: true,
  },
  {
    id: "cegilin",
    act: "ig1",
    emoji: "🤠",
    marker: "“Cegilin Kamu”",
    title: "HEY",
    before: ["Terus, pelan-pelan…\nkamu mulai berani."],
    chat: [
      { from: "gita", text: "HEY" },
      { from: "gita", text: "cegilin kamu kayanya seru" },
      { from: "gita", attach: "sticker", label: "🤠 stiker cowboy yang lagi mikir…" },
      { from: "gita", text: "ah engga deh cewenya banyak kayanya" },
    ],
    after: [
      "“Cegilin kamu kayanya seru.”\nLangsung gitu. Tanpa basa-basi.",
      "Terus mundur sendiri di pesan berikutnya. 😭",
      "Dari “kak” yang sopan banget…\nsampai sini. Cepet juga ya.",
    ],
  },
  {
    id: "first-flirting",
    act: "ig1",
    emoji: "😳",
    marker: "First Flirting",
    title: "Siapa yang Nggak Salting?",
    before: ["Terus obrolannya mulai… ya gitu deh."],
    chat: [
      { from: "gita", quote: "alamak, ade adean bisa salting ternyata", text: "siapa yg ngga salting digituin mas fajar" },
      { from: "gita", text: "JAISNSJAKWKKWKWKWK" },
      { gap: true },
      { from: "gita", quote: "kalo ketemu sapa aja, nanti juga digandeng", text: "IH JANGAN GITU LAHHHH" },
      { from: "gita", text: "kamu mah" },
      { from: "gita", text: "salting nih" },
      { gap: true },
      { from: "gita", quote: "ini iyalaginya ngarah ke yang mana yaa dikadik", text: "artefak sebagus kamuu" },
      { from: "gita", text: "😌😌", big: true },
      { from: "fajar", quote: "artefak sebagus kamuu", text: "bikin ktp dulu dekk" },
    ],
    after: [
      "Keyboard smash itu\njawaban paling jujur yang pernah aku terima.",
      "Dikadik. Dek.\nPanggilan yang terus kebawa sampai akun berikutnya.",
    ],
    recap: true,
  },
  {
    id: "first-ganteng",
    act: "ig1",
    emoji: "💌",
    marker: "First “Ganteng”",
    title: "And Then You Called Me Handsome",
    before: ["Lalu suatu hari, di tengah obrolan biasa…"],
    chat: [
      { from: "gita", text: "kak fajar gamntenk mau moots tt juga gak, gamau gapapa kokkk😭" },
      { gap: true },
      { from: "gita", attach: "story", label: "membalas ceritamu — foto di art space" },
      { from: "gita", text: "duh gantengnyaaa mas fajarrrr🤭🫰🫰" },
    ],
    after: [
      "“Gamntenk.”\nSampai typo. Buru-buru, atau salting?",
      "Kadang “kak fajar”.\nKadang “mas fajar”.",
      "Aku nggak tahu waktu itu kamu serius\natau cuma iseng.",
      "Tapi ya… aku masih ingat.",
    ],
    recap: true,
  },
  {
    id: "sadap",
    act: "ig1",
    emoji: "🕵️",
    marker: "Saling Kepo",
    title: "Mau Aku Sadap 😈",
    before: ["Pelan-pelan, kita mulai saling kepo."],
    chat: [
      { from: "fajar", quote: "aku tu sukaa liatin sg orang", text: "apa yang diliat dari ig ku asem, udah ga ada sgnya awkawk" },
      { time: "4 AGU, 08.40" },
      { from: "gita", text: "IYALAGI😭😭" },
      { from: "gita", text: "gapapa, bisa liatin highlight" },
      { gap: true },
      { from: "fajar", text: "@sc.ardiann" },
      { from: "fajar", text: "tuhh" },
      { from: "fajar", text: "ga ada apa juga sih gitt" },
      { from: "gita", text: "LHO😭" },
      { from: "gita", text: "wait ya" },
      { from: "gita", text: "mau aku sadap" },
      { from: "gita", text: "😈", big: true },
      { from: "fajar", text: "bjirr" },
      { from: "fajar", text: "jangan dong" },
      { from: "fajar", text: "nanti aku sadap balik" },
      { from: "fajar", text: "mau kamu sadap tuh maksudnya di stalk?xixixi" },
      { from: "gita", text: "WKWKW TAUAN BANGET SIAL😭😭" },
    ],
    after: [
      "Second account dibongkar.\nAncaman “disadap” dilontarkan.",
      "Dua orang yang pura-pura nggak kepo.\nPadahal dua-duanya kepo.",
    ],
  },

  // ── II · Instagram kedua ──────────────────────────────────────────────────────
  {
    id: "engineering-side",
    act: "ig2",
    emoji: "💻",
    marker: "Inikah My Engineering Side..",
    title: "Inikah My Engineering Side..",
    before: ["Jam sebelas malam.\nKamu bales story-ku yang isinya… cuma kode."],
    chat: [
      { time: "9 AGU, 23.17" },
      { from: "gita", attach: "story", label: "membalas ceritamu — layar laptop penuh kode" },
      { from: "gita", text: "anjay" },
      { from: "gita", text: "inikah my engineering side.." },
      { time: "10 AGU, 06.45" },
      { from: "fajar", text: "stalk ya xixixi" },
      { time: "10 AGU, 08.41" },
      { from: "gita", text: "🤭🤭", big: true },
      { gap: true },
      { from: "fajar", quote: "inikah my..", text: "MY APA" },
      { from: "gita", quote: "MY APA", text: "my besfren" },
      { from: "gita", text: "🫰🫰🫰🫰🫰🫰", big: true },
    ],
    after: ["Ditanya “my apa”…", "jawabannya “my besfren”. 🫰", "Besfren. Iya. Oke."],
  },
  {
    id: "gmorning",
    act: "ig2",
    emoji: "☀️",
    marker: "Gmornningg",
    title: "Gmornningg",
    before: ["Pelan-pelan, kamu mulai jadi bagian dari pagiku."],
    chat: [
      { time: "11 AGU, 06.10" },
      { from: "gita", text: "HIII MAS FAJARR" },
      { from: "gita", text: "gmornningg" },
      { from: "gita", text: "have a nicee dayyy" },
      { from: "gita", attach: "sticker", label: "😴 stiker bangun tidur, sama kucing oren" },
      { gap: true },
      { from: "fajar", text: "sakit kepalanya sampe sekarang" },
      { from: "gita", text: "tidurrr makanya" },
      { from: "gita", text: "nongs luw" },
      { from: "gita", text: "ngopi ya" },
      { gap: true },
      { from: "gita", attach: "photo", label: "🍱 foto makan siang (udah kemakan dikit)" },
      { from: "gita", text: "nihh" },
      { from: "gita", text: "itu tadi udah aku makan dikit, trus baru inget mau send ke kamuu" },
      { gap: true },
      { from: "gita", text: "baru selesai gilak ya Allah" },
      { from: "gita", text: "lelah letih lesu lovyu" },
    ],
    after: [
      "Selamat pagi.\nFoto makan siang yang udah kemakan duluan.\n“Tidurrr makanya.”",
      "…dan “lovyu” yang diselipin diam-diam\ndi antara capek.",
      "Hal-hal kecil yang nggak penting buat orang lain.\nTapi ternyata itu cara kita bilang:\naku kepikiran kamu.",
    ],
  },
  {
    id: "romeo-and-jamet",
    act: "ig2",
    emoji: "🎭",
    marker: "Romeo and Jamet",
    title: "Romeo and Jamet",
    before: ["Dan tentu saja… ada yang receh."],
    chat: [
      { from: "gita", quote: "yeyyy, ayo main", text: "duh kayanya aku cuma cerita rakyat deh" },
      { from: "fajar", text: "memank kita sepertinya cerita rakyat doang kayanya sih" },
      { from: "fajar", text: "soalnya lu jamet" },
      { from: "gita", quote: "soalnya lu jamet", text: "APA HUBUNGANNYA 😠😠😠😠" },
      { from: "gita", text: "lu jugak jamet" },
      { from: "fajar", quote: "APA HUBUNGANNYA 😠😠😠😠", text: "masa nanti judul cerita romeo and jamet" },
      { from: "fajar", text: "kan ngga cocog" },
      { gap: true },
      { from: "fajar", text: "mang cocoknya sama yang umur berapa yah" },
      { from: "gita", text: "17 juga cocokk 😘" },
    ],
    after: [
      "Ternyata kita bukan Romeo and Juliet.",
      "Mungkin memang cuma cerita rakyat.\nTapi ini cerita rakyat kita.",
    ],
    recap: true,
  },
  {
    id: "tertarik",
    act: "ig2",
    emoji: "💭",
    marker: "“Tapi Tertarik”",
    title: "Belum Naksir. Tapi Tertarik.",
    before: ["Terus ada saatnya obrolan kita\njadi sedikit lebih jujur."],
    chat: [
      { from: "fajar", attach: "voice", label: "1:35" },
      { from: "gita", text: "eh tapi aku juga nyaman sama yang sekarangg" },
      { from: "gita", text: "maksudnya tu temenan aja sama semuanyaa" },
      { from: "gita", text: "iya kann" },
      { from: "gita", text: "bukan maksud ngedeketin" },
      { from: "gita", text: "HEHE" },
      { from: "gita", text: "emang kamu gada naksir orang gitu ya? HEHE lancang" },
      { from: "gita", text: "😭😭😭", big: true },
      { gap: true },
      { from: "gita", quote: "hahh, luh naksir siapa dikadiks", text: "lahh elu🤣😂" },
      { from: "gita", text: "belum dengg, belum naksirr" },
      { from: "gita", text: "tapi tertarik, kalo ngga tertarik aku pasti matiin topik😭" },
    ],
    after: [
      "“Bukan maksud ngedeketin. HEHE.”",
      "Lalu…\n“lahh elu.”",
      "Belum naksir, katanya.\nTapi tertarik.",
      "Dan kamu nggak pernah matiin topiknya.",
    ],
    recap: true,
  },
  {
    id: "lewat-wa",
    act: "ig2",
    emoji: "📱",
    marker: "Lewat WA Aja?",
    title: "Lewat WA Aja?",
    before: ["Sampai akhirnya, DM Instagram\nterasa terlalu sempit."],
    chat: [
      { from: "fajar", text: "ini bisa ngga sih lewat wa aja dikadik" },
      { from: "fajar", text: "aku sambil laptopan" },
      { from: "fajar", text: "my sirah cengeng jir" },
      { from: "fajar", text: "pegell" },
      { from: "fajar", text: "liat laptop hp" },
      { from: "gita", text: "😭😭😭", big: true },
      { from: "gita", text: "iyaa bolee" },
      { from: "gita", text: "lagi sibuk kahh kamu" },
      { from: "gita", quote: "pakee 2", text: "wowwww" },
      { from: "gita", attach: "contact", label: "Nomor telepon" },
    ],
    after: [
      "Alasannya: kepala pusing,\npegel liat laptop sama hp.",
      "Alasan yang sangat masuk akal.\nDan sedikit… modus.",
      "Dan begitu saja,\nkita pindah rumah.",
    ],
  },

  // ── III · WhatsApp ────────────────────────────────────────────────────────────
  {
    id: "admin-pusat",
    act: "wa",
    emoji: "💰",
    marker: "Admin Pusat",
    title: "Pesan dari Admin Pusat",
    before: ["Di sini juga, nggak semua obrolan penting.\nAda yang isinya cuma iseng."],
    chat: [
      { time: "19 Agustus 2026" },
      {
        from: "fajar",
        text:
          "Selamat m… Customer Service Pusat.\n\nKami informasikan bahwa akun Kakak terdeteksi mendapatkan BONUS MEMBER TERBATAS sebesar:\n\n💰 Rp 999.999.999\n\nStatus: MENUNGGU KONFIRMASI\n\nUntuk mengaktifkan bonus, silakan balas dengan:\n\n1. SIAP → Klaim bonus\n2. GAS → Klaim bonus + bonus tambahan\n3. TIDAK MAU → Kami kirim bonus ke tetangga Kakak\n\n⏰ Batas konfirmasi: 5 menit.\n\nMohon segera merespons agar bonus tidak AUTO-HANGUS™.\n\nTerima kasih telah menjadi member prioritas kami. 🙏\n\n— Admin Pusat",
      },
      { time: "21.15 → 21.16" },
      { from: "gita", text: "OMGGGGG🥺🥺🥺🥺🥺" },
    ],
    after: [
      "Satu menit.\nCuma butuh satu menit buat kamu bales “OMGGGGG”.",
      "Bonusnya nggak pernah cair.\nTapi kamu tetap di sini.",
    ],
  },
  {
    id: "akhirnyaa",
    act: "wa",
    emoji: "🏡",
    marker: "“Cintakuu”",
    title: "Akhirnyaa",
    before: ["Lalu suatu dini hari, jam satu lewat,\naku kirim sesuatu."],
    chat: [
      { from: "fajar", attach: "photo", label: "🖥️ screenshot tempat kecil ini — masih di laptopku" },
      { from: "fajar", text: "akhirnyaa" },
      { from: "fajar", attach: "link", label: "digitalmemory-two.vercel.app" },
      { time: "01.23 → 05.32" },
      { from: "gita", text: "HAHHHHH" },
      { from: "gita", text: "LUCUUUU BUANGETTTT" },
      { from: "gita", text: "DIBIKININ DIARYYYY" },
      { from: "gita", text: "😭😭😭", big: true },
      { from: "gita", text: "AAAA GEMESSSSSS" },
      { from: "gita", text: "GILAK LUCUU MAKSIMALLLL" },
      { from: "gita", text: "TERIMAKASII BANYAKK CINTAKUU" },
      { from: "gita", text: "🤭🤭🤭🤭", big: true },
      { from: "gita", text: "kamu begadang ngga cuma bikin ginian kann.." },
    ],
    after: [
      "Jam setengah enam pagi kamu bales.\nCapslock semua.",
      "“Cintakuu.”",
      "Dan iya…\naku begadang. 😭",
      "Tempat yang lagi kamu buka sekarang\ndimulai dari pesan itu.",
    ],
    recap: true,
  },
  {
    id: "dunia-1",
    act: "wa",
    emoji: "🎮",
    marker: "Dunia 1 Selesai",
    title: "Dunia 1 Selesai",
    before: ["Kita juga main bareng.\nRoblox di layar, WhatsApp Web kebuka di pojok."],
    photo: {
      key: "journey-story/dunia-1.jpg",
      caption: "3 Okt 2026 · 21.30",
      alt: "Screenshot Roblox: DUNIA 1 SELESAI, gerbang hijau menuju Dunia 2",
    },
    after: ["Dunia 1 selesai.", "Dunia 2 masih nunggu."],
  },
  {
    id: "first-call",
    act: "wa",
    emoji: "📞",
    marker: "First Call",
    title: "First Call",
    before: ["Setelah semua pesan, stiker, dan voice note itu…", "dan kemudian, untuk pertama kalinya…"],
    // Di log-nya ikon telepon (bukan kamera), jadi "heard". Kalau ternyata
    // video call, ganti jadi "we saw each other."
    headline: "we heard each other.",
    photo: {
      key: "journey-story/first-call.jpg",
      caption: "Gita dukun ebeg · ↗ Keluar",
      alt: "Log panggilan WhatsApp: Gita dukun ebeg, panggilan keluar",
    },
    after: ["Bukan tulisan lagi.\nSuara.", "Akhirnya kita ngobrol beneran."],
    recap: true,
  },
];

// ── "Look how far we've come" — rekap cerita di atas ───────────────────────────
export const STORY_RECAP = {
  title: "Dari satu DM…",
  today: "Today",
};

// ── Video — penutup, diputar setelah semuanya ─────────────────────────────────
export const REEL = {
  lines: [
    "Dulu mungkin kita nggak pernah tahu\npesan pertama itu akan membawa kita sejauh ini.",
    "Kita cuma menjalani satu hari.\nLalu hari berikutnya.",
    "Lalu satu percakapan lagi.\nSatu tawa lagi.\nSatu malam lagi.",
    "Sampai akhirnya…",
  ],
  arrive: "kita sampai di sini.",
  video: { key: "journey-story/reel.mp4", caption: "Dan ternyata… kita sudah sejauh ini." },
  play: "▶ putar",
  skip: "lewati →",
  end: {
    title: "And this isn't the end.",
    lines: [
      "Ini cuma sejauh yang sudah kita lewati.",
      "Masih ada jalan yang belum kita tahu.\nMasih ada cerita yang belum kita tulis.",
    ],
    but: "But whatever comes next…",
    final: "let's keep walking. ♡",
  },
};

/** Semua Storage key yang dipakai cerita ini (ditandatangani di page.tsx). */
export const STORY_MEDIA_KEYS = [
  ...STORY_MOMENTS.flatMap((m) => (m.photo ? [m.photo.key] : [])),
  REEL.video.key,
];
