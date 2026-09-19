// ✨ SOMEDAY, WITH YOU — "Some memories haven't happened yet."
//
// Sebuah perjalanan pelan, halaman demi halaman: dari "kita belum pernah
// bertemu" → "suatu hari nanti, kita akan punya cerita sendiri". Sengaja TANPA
// foto — semuanya dibangun dari tulisan, tipografi, dan animasi lembut.
//
// SEMUA teks ada di sini. Edit bebas: ganti kalimat, tambah/kurangi baris atau
// bab, tanpa perlu menyentuh komponennya. `\n` = pindah baris di dalam satu blok.

// ── Tipe bab ────────────────────────────────────────────────────────────────
// Tiap bab punya `kind` yang menentukan bagaimana ia ditampilkan.

export type ProseChapter = {
  kind: "prose";
  no: string; // "01" — kosongkan ("") untuk bab tersembunyi tanpa nomor
  title: string;
  subtitle?: string;
  // Muncul satu per satu (ketuk untuk lanjut); baris sebelumnya tetap terlihat.
  beats: string[];
  // Ilustrasi garis abstrak kecil di atas teks (opsional). Lihat someday.tsx.
  art?: "two-cups";
  // "intimate" = nuansa lebih hangat/pelan (dipakai bab tersembunyi).
  mood?: "default" | "intimate";
};

export type CardsChapter = {
  kind: "cards";
  no: string;
  title: string;
  subtitle?: string;
  intro?: string;
  // Kartu kecil: `prompt` yang terlihat, `reply` muncul saat diketuk.
  cards: { prompt: string; reply: string }[];
  // Renungan penutup di bawah kartu-kartu.
  closing?: string[];
};

export type PolaroidChapter = {
  kind: "polaroid";
  no: string;
  title: string;
  subtitle?: string;
  intro: string; // di atas bingkai
  frameNote: string; // tulisan kecil di dalam bingkai kosong
  caption: string; // di bawah bingkai
  buttonLabel: string;
  thanks: string; // muncul setelah tombol diketuk
};

export type ChecklistChapter = {
  kind: "checklist";
  no: string;
  title: string;
  subtitle?: string;
  items: string[]; // tetap kosong — itu justru maksudnya
  note: string;
};

export type Chapter =
  | ProseChapter
  | CardsChapter
  | PolaroidChapter
  | ChecklistChapter;

// ── Isi perjalanan ───────────────────────────────────────────────────────────

export const somedayConfig = {
  // 00 — layar pembuka
  opening: {
    title: "SOMEDAY, WITH YOU",
    tagline: "Some memories haven't happened yet.",
    // Muncul menumpuk pelan-pelan sebelum tombol "Begin".
    lines: [
      "We don't have many memories yet.",
      "No photos.\nNo places we've visited.\nNo days we can look back on.",
      "But maybe that's not a bad thing.",
    ],
    beginLabel: "Begin ♡",
  },

  // 01..N — bab-bab
  chapters: [
    {
      kind: "prose",
      no: "01",
      title: "THE FIRST TIME",
      subtitle: "A memory that hasn't happened yet.",
      beats: [
        "Aku sering membayangkan bagaimana rasanya melihat kamu untuk pertama kalinya.",
        "Bukan lewat foto.\nBukan lewat layar.\nBukan lewat sebuah nama yang muncul di notifikasi.",
        "Tapi benar-benar kamu.\nBerdiri di depanku.",
        "Dan mungkin, setelah sekian lama mengenalmu dari jauh, aku malah akan bingung harus bilang apa.",
        "Maybe I'll just smile and say…\n“Hai.” 😂",
      ],
    },
    {
      kind: "prose",
      no: "02",
      title: "A SIMPLE DAY",
      art: "two-cups",
      beats: [
        "Aku nggak membayangkan kita harus selalu punya hari yang luar biasa.",
        "Kadang aku cuma ingin kita punya satu hari yang biasa.",
        "Pergi makan.\nJalan sebentar.\nDuduk berdua.\nNgobrol tentang hal-hal yang sebenarnya nggak penting.",
        "Lalu pulang dengan perasaan,\n“Ternyata hari sesederhana ini bisa sesenang itu.”",
      ],
    },
    {
      kind: "cards",
      no: "03",
      title: "THINGS I WANT TO HEAR",
      intro: "Hal-hal kecil yang suatu hari ingin aku ucapkan langsung. Ketuk satu per satu.",
      cards: [
        {
          prompt: "“Kamu udah makan?”",
          reply: "Bukan sekadar basa-basi. Aku beneran pengin tahu kamu baik-baik aja.",
        },
        {
          prompt: "“Hari ini capek nggak?”",
          reply: "Cerita aja pelan-pelan. Aku mau jadi tempat kamu berhenti sebentar.",
        },
        {
          prompt: "“Sini cerita.”",
          reply: "Nggak harus hal besar. Hal kecil pun aku mau dengerin sampai habis.",
        },
        {
          prompt: "“Aku kangen.”",
          reply: "Dan suatu hari nanti, aku bisa bilang ini tanpa harus menunggu kamu online.",
        },
      ],
      closing: [
        "Mungkin sekarang kalimat-kalimat seperti ini cuma lewat chat.",
        "Tapi aku berharap suatu hari nanti, aku bisa mengatakannya langsung.\nTanpa layar. Tanpa jarak. Tanpa harus menunggu kamu online.",
      ],
    },
    {
      kind: "polaroid",
      no: "04",
      title: "OUR FIRST PHOTO",
      intro: "This space is intentionally empty.",
      frameNote: "Reserved for someday.",
      caption: "Karena foto pertama kita belum terjadi.",
      buttonLabel: "Keep this empty ♡",
      thanks: "Kita simpan kosong dulu, ya. Sampai waktunya tiba. ♡",
    },
    {
      kind: "checklist",
      no: "05",
      title: "THE THINGS WE HAVEN'T DONE",
      subtitle: "Someday list",
      items: [
        "First meeting",
        "First meal together",
        "First walk",
        "First photo",
        "First “I miss you” face-to-face",
        "Watching something together",
        "Getting lost somewhere",
        "Laughing until we forget what we were talking about",
        "Making a memory we can actually look back on",
      ],
      note: "“We'll fill these when the time comes.”",
    },
    {
      // Bab tersembunyi — tanpa nomor, nuansa paling intim.
      kind: "prose",
      no: "",
      title: "FOR THE DAYS YOU NEED REASSURANCE",
      subtitle: "a page I kept just for you",
      mood: "intimate",
      beats: [
        "Aku tahu kadang ada hal-hal kecil yang bisa membuat kamu bertanya-tanya.",
        "Apakah aku masih memilih kamu?\nApakah kamu benar-benar punya tempat yang spesial?\nApakah ada sesuatu yang harus kamu khawatirkan?",
        "Aku mungkin nggak selalu sempurna dalam menunjukkan jawabannya.",
        "Kadang aku salah.\nKadang aku ceroboh.\nKadang aku melakukan sesuatu tanpa sadar bagaimana rasanya dari sisi kamu.",
        "Tapi satu hal yang ingin aku kamu tahu:",
        "kamu nggak perlu bersaing dengan siapa pun untuk mendapatkan tempat di hidupku.",
        "Karena tempat itu bukan perlombaan.\nAku memilihnya untuk kamu.",
      ],
    },
  ] as Chapter[],

  // Layar penutup
  ending: {
    // Muncul satu per satu.
    lines: ["We don't have these memories yet.", "And that's okay.", "Because someday…"],
    // Lalu daftar ini muncul bersama, satu demi satu.
    somedayList: [
      "we'll have our first photo.",
      "our first meal.",
      "our first walk.",
      "our first stupid argument.",
      "our first ordinary Tuesday.",
      "our first hundred ordinary Tuesdays.",
    ],
    finalLine: "And hopefully, many more after that.",
    closer: "Until then, I'll keep a little space for you here.",
    heart: "♡",
    // Kalimat identitas fitur ini — tampil sebagai penutup tulisan tangan.
    epigraph:
      "We haven't made these memories yet.\nBut I already know who I want beside me when we do.",
    replayLabel: "ulang dari awal",
    backLabel: "kembali ♡",
  },

  // 🎵 Musik ambient (opsional). Isi `youtubeId` dari sebuah link YouTube
  // (mis. youtu.be/XXXX -> "XXXX") untuk memutar lagu pelan selama perjalanan.
  // Biarkan "" kalau ingin tanpa musik — tombol suara otomatis disembunyikan.
  song: {
    youtubeId: "OXtZfPZIex4", // NIKI – Every Summertime (Visualizer)
    startSeconds: 0,
    title: "NIKI – Every Summertime",
  },

  // Label & petunjuk kecil.
  ui: {
    tapHint: "ketuk untuk lanjut",
    continueLabel: "lanjut ♡",
    cardHint: "ketuk kartunya",
    muteOn: "Matikan lagu",
    muteOff: "Nyalakan lagu",
    back: "kembali",
  },
} as const;
