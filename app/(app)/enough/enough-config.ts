// 🩷 YOU'RE NOT TOO MUCH — sebuah personal reassurance experience.
//
// Terinspirasi "Rayuan Perempuan Gila" (Nadin Amizah). POV: aku → kamu.
// Ini BUKAN fitur permintaan maaf, bukan future-memories, bukan surprise magical.
// Ini ruang kecil untuk menenangkan: "kamu nggak perlu jadi versi sempurna
// supaya aku memilihmu."
//
// SEMUA teks ada di sini. Edit bebas — ganti kalimat, tambah/kurangi baris atau
// bab, tanpa menyentuh komponennya. `\n` = pindah baris di dalam satu blok.
//
// Bahasa visual sengaja BEDA dari /someday & /bloom: editorial journal / diary
// yang intim — krem, tinta cokelat, sedikit muted pink, grain, tipografi besar,
// banjak ruang kosong. Tanpa rumah, bunga, atau foto.

// ── Tipe bab ──────────────────────────────────────────────────────────────────
// Tiap bab punya `kind` yang menentukan bagaimana ia ditampilkan.

export type FearsChapter = {
  kind: "fears";
  no: string;
  title: string;
  intro?: string;
  // Kartu ketakutan: `fear` yang terlihat, `reply` (baris demi baris) muncul saat diketuk.
  cards: { fear: string; reply: string[] }[];
};

export type MirrorChapter = {
  kind: "mirror";
  no: string;
  // Sisi kiri: kata-kata yang dia kira tentang dirinya — memudar satu per satu.
  leftTitle: string;
  leftWords: string[];
  // Sisi kanan: yang sebenarnya aku lihat — muncul satu per satu.
  rightTitle: string;
  rightLines: string[];
  // Kalimat terakhir, paling lembut.
  finalLine: string;
};

export type RevealChapter = {
  kind: "reveal";
  no: string;
  title: string;
  intro: string;
  // Sisi yang biasanya dia sembunyikan; ketuk → responsku muncul.
  options: { label: string; reply: string[] }[];
  closing?: string;
};

export type CalendarChapter = {
  kind: "calendar";
  no: string;
  title: string;
  // Semua "jenis hari" tetap tercentang — apa pun harinya, tetap ada.
  days: string[];
  closing: string[];
};

export type CrazyChapter = {
  kind: "crazy";
  no: string;
  title: string;
  // Gelembung chat kecil yang makin lama makin penuh, lalu berhenti.
  bubbles: string[];
  // Muncul satu per satu setelah gelembung berhenti.
  afterLines: string[];
};

export type LitanyChapter = {
  kind: "litany";
  no: string;
  title: string;
  intro?: string;
  // Baris muncul satu per satu (ketuk untuk lanjut).
  lines: string[];
  // Kalimat penutup yang ditekankan.
  finale: string;
  // "pause" kecil sebelum finale muncul (dipakai bab The Promise).
  pauseBeforeFinale?: boolean;
};

export type Chapter =
  | FearsChapter
  | MirrorChapter
  | RevealChapter
  | CalendarChapter
  | CrazyChapter
  | LitanyChapter;

// ── Isi perjalanan ─────────────────────────────────────────────────────────────

export const enoughConfig = {
  // 00 — layar pembuka ("Aku tahu.")
  opening: {
    eyebrow: "YOU'RE NOT TOO MUCH",
    // Kalimat besar pertama, muncul sendirian dulu.
    lead: "Aku tahu.",
    // Lalu baris-baris ini menumpuk pelan (ketuk untuk lanjut).
    lines: [
      "Kadang kamu takut aku berubah.\nKadang kamu takut aku bosan.",
      "Kadang kamu bertanya-tanya,\nsampai kapan seseorang bisa tetap mencintaimu.",
      "Aku mungkin nggak selalu tahu apa yang ada di kepalamu.",
      "Tapi aku melihatnya.",
    ],
    beginLabel: "Stay a little longer →",
  },

  // 01..N — bab-bab
  chapters: [
    {
      kind: "fears",
      no: "01",
      title: "THE THINGS YOU FEAR",
      intro: "Hal-hal yang diam-diam kamu takutkan. Ketuk satu per satu.",
      cards: [
        {
          fear: "You might get tired",
          reply: [
            "Aku tahu kadang kamu bisa terlalu banyak berpikir.",
            "Tapi kamu nggak pernah menjadi beban hanya karena sedang merasa banyak hal.",
          ],
        },
        {
          fear: "You might leave",
          reply: [
            "Mungkin ada bagian dari dirimu yang selalu bersiap kehilangan.",
            "Tapi kamu nggak perlu hidup sambil menunggu aku pergi.",
          ],
        },
        {
          fear: "I'm too much",
          reply: [
            "Perasaanmu bukan sesuatu yang harus selalu kamu kecilkan supaya nyaman untuk orang lain.",
          ],
        },
        {
          fear: "I'm hard to love",
          reply: [
            "Mungkin kamu memang nggak selalu mudah dimengerti.",
            "Tapi sulit dimengerti bukan berarti sulit dicintai.",
          ],
        },
      ],
    },
    {
      kind: "mirror",
      no: "02",
      leftTitle: "THE GIRL YOU THINK YOU ARE",
      leftWords: ["Too much", "Too sensitive", "Too complicated", "Too emotional", "Too difficult"],
      rightTitle: "THE GIRL I SEE",
      rightLines: [
        "Someone who cares deeply.",
        "Someone who feels deeply.",
        "Someone who loves deeply.",
        "Someone who's sometimes afraid of losing what she loves.",
      ],
      finalLine: "Someone I love.",
    },
    {
      kind: "reveal",
      no: "03",
      title: "YOU DON'T HAVE TO HIDE",
      intro: "Kamu boleh menunjukkan sisi yang biasanya kamu sembunyikan.",
      options: [
        {
          label: "When you're angry",
          reply: [
            "Aku nggak selalu harus menang dalam percakapan.",
            "Kadang aku cuma perlu mengerti kenapa kamu terluka.",
          ],
        },
        {
          label: "When you're jealous",
          reply: [
            "Aku nggak akan menertawakan rasa takutmu.",
            "Aku lebih ingin membuatmu merasa aman.",
          ],
        },
        {
          label: "When you're quiet",
          reply: ["Kamu nggak harus selalu punya kata-kata.", "Aku bisa menunggu."],
        },
        {
          label: "When you're scared",
          reply: ["Kamu nggak harus terlihat kuat di depanku.", "Takut juga boleh."],
        },
        {
          label: "When you're insecure",
          reply: [
            "Kamu nggak perlu terus-terusan meyakinkan dirimu bahwa kamu layak.",
            "Di mataku, kamu nggak pernah kurang.",
          ],
        },
      ],
      closing: "Nggak ada sisi dirimu yang harus kamu sembunyikan supaya tetap aku pilih.",
    },
    {
      kind: "calendar",
      no: "04",
      title: "EVEN ON THOSE DAYS",
      days: [
        "GOOD DAY",
        "BAD DAY",
        "QUIET DAY",
        "MESSY DAY",
        "OVERTHINKING DAY",
        "I DON'T FEEL LIKE MYSELF",
      ],
      closing: [
        "Aku nggak cuma ingin ada ketika kamu sedang mudah dicintai.",
        "Aku juga ingin mengenalmu ketika kamu sendiri sedang kesulitan memahami dirimu.",
      ],
    },
    {
      kind: "crazy",
      no: "05",
      title: "Katanya perempuan yang terlalu mencintai itu sedikit gila.",
      bubbles: [
        "Udah makan?",
        "Kamu di mana?",
        "Kok lama?",
        "Jangan lupa istirahat.",
        "Aku kangen.",
        "Kamu kenapa?",
      ],
      afterLines: ["Kalau itu yang disebut gila…", "yaudah.", "Aku akan belajar memahami gilamu."],
    },
    {
      kind: "litany",
      no: "06",
      title: "YOU DON'T HAVE TO CONVINCE ME",
      intro: "Kamu nggak perlu terus menunjukkan alasan kenapa aku harus mencintaimu.",
      lines: [
        "Kamu nggak perlu selalu cantik.",
        "Kamu nggak perlu selalu tenang.",
        "Kamu nggak perlu selalu pengertian.",
        "Kamu nggak perlu selalu menjadi versi terbaikmu.",
      ],
      finale: "Aku sudah memilihmu.",
    },
    {
      kind: "litany",
      no: "07",
      title: "THE PROMISE",
      lines: [
        "Aku nggak bisa menjanjikan semuanya akan selalu mudah.",
        "Aku juga nggak bisa menjanjikan aku nggak akan pernah salah.",
        "Akan ada hari ketika kita salah memahami satu sama lain.",
        "Akan ada hari ketika kita sama-sama lelah.",
        "Akan ada hari ketika aku nggak tahu harus berkata apa.",
      ],
      finale: "Tapi aku nggak ingin kamu menghadapi ketakutanmu sendirian.",
      pauseBeforeFinale: true,
    },
  ] as Chapter[],

  // 08 — layar penutup
  ending: {
    lead: "Kalau suatu hari kamu merasa dirimu…",
    // Kata-kata ini muncul-lalu-memudar bergantian, satu per satu.
    fades: ["terlalu banyak…", "terlalu rumit…", "terlalu sensitif…", "atau terlalu sulit untuk dicintai…"],
    comeBack: "Come back here.",
    finalLine: "You're not too much for me.",
    heart: "♡",
    replayLabel: "ulang dari awal",
    backLabel: "kembali ♡",
  },

  // 🎵 Musik ambient (opsional). PASTE YouTube ID lagu "Rayuan Perempuan Gila —
  // Nadin Amizah" di `youtubeId` (mis. dari youtu.be/XXXX → "XXXX"). Biarkan ""
  // kalau ingin tanpa musik — tombol suara otomatis disembunyikan.
  // Volume sengaja dibuat naik pelan mengikuti perjalanan (hening di pembuka →
  // intim di penutup); diatur di enough.tsx, tak perlu disetel di sini.
  song: {
    youtubeId: "gIsoLyQX7W8", // Nadin Amizah — Rayuan Perempuan Gila
    startSeconds: 0,
    title: "Nadin Amizah — Rayuan Perempuan Gila",
  },

  // Label & petunjuk kecil.
  ui: {
    tapHint: "ketuk untuk lanjut",
    continueLabel: "lanjut ♡",
    cardHint: "ketuk kartunya",
    revealHint: "ketuk salah satunya",
    back: "kembali",
    muteOn: "Matikan lagu",
    muteOff: "Nyalakan lagu",
  },
} as const;
