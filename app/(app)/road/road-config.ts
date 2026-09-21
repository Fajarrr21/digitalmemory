// 🛤️ THE ROAD THAT MADE ME
// "A story about the things I lost, the things I learned, and the road I'm still walking."
//
// Sebuah perjalanan malam yang perlahan berubah menjadi pagi. Tiga babak:
//   ACT I  — Sesi Potret        : dari mana aku berasal (gelap, personal)
//   ACT II — Bunga Terakhir     : kehilangan ibu (paling berat)
//   ACT III— Kita Usahakan Rumah Itu : aku belum selesai — dan lalu, ada kamu (hangat)
// Berakhir pada sebuah pertanyaan, lalu sebuah jalan yang masih terbuka.
//
// SEMUA teks ada di sini. Edit bebas: ganti kalimat, tambah/kurangi baris/bab,
// tanpa menyentuh komponennya. `\n` = pindah baris di dalam satu blok teks.
// Sengaja TIDAK ada di nav — ditemukan dengan membuka /road langsung.

// ── Ilustrasi garis (opsional) yang bisa dipasang di sebuah bab prosa ──────────
// Lihat road-art.tsx. Semua bergaya coretan garis minimalis — bukan foto.
export type ArtKey =
  | "spark" // satu titik kecil di garis waktu
  | "two-fires" // dua api yang saling berkobar, lalu satu padam
  | "document" // formulir / dokumen pendaftaran
  | "journey" // rel kereta + lampu kota (Purwokerto → Jakarta)
  | "small-life" // ikon-ikon kecil: rumah sakit, es kopi, game
  | "white-cloth" // sehelai kain putih (Goodbye)
  | "steps" // deretan titik menaik (SMK → laptop → QA)
  | "road" // jalan panjang tanpa ujung
  | "two-dots" // dua titik berjalan berdampingan
  | "sunrise"; // jalan dengan matahari terbit

// ── Tipe bab ───────────────────────────────────────────────────────────────────

export type ProseChapter = {
  kind: "prose";
  act: 0 | 1 | 2;
  no: string; // "01" — kosongkan ("") untuk bab tanpa nomor
  title: string;
  subtitle?: string;
  // Muncul satu per satu (ketuk untuk lanjut); baris sebelumnya tetap terlihat.
  beats: string[];
  art?: ArtKey;
  // "intimate" = nuansa lebih hangat/pelan; "hope" = sedikit lebih terang.
  mood?: "default" | "intimate" | "hope";
};

// Bab "polaroid kosong" — foto wisuda yang tak pernah sempat diambil.
export type FrameChapter = {
  kind: "frame";
  act: 0 | 1 | 2;
  no: string;
  title: string;
  intro: string[]; // baris sebelum bingkai muncul
  frameNote: string; // tulisan kecil di dalam bingkai kosong
  caption: string; // di bawah bingkai
  lines: string[]; // baris yang muncul setelah bingkai (ketuk untuk lanjut)
};

// Kartu babak — jeda antar-akta. `silent: true` = hening (musik berhenti dulu).
export type ActCardScene = {
  kind: "act";
  act: 0 | 1 | 2;
  line?: string; // satu kalimat pembuka babak
  silent?: boolean;
};

export type Scene = ProseChapter | FrameChapter | ActCardScene;

// ── Isi perjalanan ───────────────────────────────────────────────────────────

export const roadConfig = {
  // 🎵 Satu lagu per babak. `youtubeId` diambil dari link YouTube
  // (mis. youtu.be/XXXX → "XXXX"). Musik berganti otomatis saat pindah babak.
  acts: [
    {
      label: "ACT I",
      title: "Sesi Potret",
      subtitle: "Before you know me…",
      song: { youtubeId: "Nskf70DMR60", title: "Enau ft. Ari Lesmana — Sesi Potret" },
    },
    {
      label: "ACT II",
      title: "Bunga Terakhir",
      subtitle: "Some goodbyes arrive before we're ready.",
      song: { youtubeId: "NBf5P9Qd6cs", title: "Romeo — Bunga Terakhir" },
    },
    {
      label: "ACT III",
      title: "Kita Usahakan Rumah Itu",
      subtitle: "Maybe life didn't go as planned. Maybe that's okay.",
      song: { youtubeId: "7SqNVv98e8Q", title: "Sal Priadi — Kita Usahakan Rumah Itu" },
    },
  ],

  // 00 — layar pembuka (layar hitam, teks muncul perlahan)
  opening: {
    title: "THE ROAD THAT MADE ME",
    tagline: "A story about the things I lost, the things I learned, and the road I'm still walking.",
    lines: [
      "Sebelum kamu berjalan bersamaku,\nmungkin ada baiknya kamu tahu\ndari mana aku berasal.",
      "Ini bukan cerita tentang hidup yang sempurna.",
      "Ini cerita tentang beberapa hal\nyang pernah hilang dariku.",
      "Beberapa hal yang terpaksa kulepaskan.",
      "Dan beberapa hal\nyang akhirnya membentuk siapa diriku hari ini.",
    ],
    beginLabel: "Walk with me →",
  },

  // 01..N — babak & bab (musik & warna dikendalikan oleh field `act`)
  scenes: [
    // ── ACT I — Sesi Potret ──────────────────────────────────────────────────
    {
      kind: "prose",
      act: 0,
      no: "01",
      title: "WHERE IT STARTED",
      art: "spark",
      beats: [
        "Semuanya sebenarnya bermula\nketika aku masih duduk di kelas 3 SMP.",
        "Ibu sakit.",
        "Sejak saat itu, rumah terasa berbeda.",
        "Ibu berada di Jakarta.\nAku dan bapak berada di sini.",
        "Dan meskipun kami masih satu keluarga,\nhubungan di antara orang-orang di dalamnya\ntidak pernah benar-benar sederhana.",
      ],
    },
    {
      kind: "prose",
      act: 0,
      no: "02",
      title: "TWO FIRES",
      subtitle: "Pelajaran hidup pertamaku.",
      art: "two-fires",
      beats: [
        "Aku belajar satu hal dari semuanya.",
        "Dua api yang sama tidak boleh terus saling berkobar.",
        "Harus ada salah satunya\nyang memilih untuk padam.",
        "Dalam sebuah hubungan, mungkin tidak selalu tentang\nsiapa yang benar dan siapa yang salah.",
        "Kadang ada sesuatu yang jauh lebih penting\ndaripada memenangkan sebuah pertengkaran:\nmenjaga agar sesuatu yang lebih besar\ntidak ikut terbakar.",
      ],
    },
    {
      kind: "prose",
      act: 0,
      no: "03",
      title: "THE FIRST THING I HAD TO LET GO",
      art: "document",
      beats: [
        "Sebelum masuk SMK,\nada satu sekolah yang benar-benar kuinginkan.",
        "Aku daftar sendiri.\nPakai uang sendiri.\nSudah dapat kelas.",
        "Tapi saat daftar ulang,\naku tidak mampu membayarnya.",
        "Jadi aku memilih mundur.",
        "Bukan karena aku tidak menginginkannya.\nTapi karena saat itu,\nkeadaan memintaku untuk melepaskannya.",
        "Waktu itu aku belum tahu…\nternyata melepaskan sesuatu\nbukan berarti hidupku berhenti di sana.",
      ],
    },
    {
      kind: "prose",
      act: 0,
      no: "04",
      title: "JAKARTA",
      art: "journey",
      beats: [
        "Saat liburan sekolah,\naku sering pergi ke Jakarta.",
        "Awalnya mungkin terlihat seperti liburan.",
        "Tapi sejak kelas 3 SMP, aku pergi ke sana\nkarena satu alasan: menemani ibu.",
        "Rumah sakit. Kemoterapi.\nHari-hari yang tidak mudah.",
        "Tapi di tengah semua itu,\naku masih mencoba menjadi anak sekolah biasa.",
        "Main game.\nBeli es kopi.\nBercanda.\nSeolah semuanya akan baik-baik saja.",
      ],
    },
    {
      kind: "prose",
      act: 0,
      no: "05",
      title: "MAYBE SHE'LL GET BETTER",
      mood: "hope",
      beats: [
        "Ada masa ketika aku mulai percaya\nbahwa mungkin… ibu akan baik-baik saja.",
        "Kondisinya membaik.\nAda harapan untuk radiasi.",
        "Tapi tubuh ibu sudah terlalu lemah.",
        "Dan harapan itu kembali mundur perlahan.",
      ],
    },

    // ── ACT II — Bunga Terakhir ────────────────────────────────────────────────
    {
      kind: "act",
      act: 1,
      silent: true, // hening dulu sebelum lagu masuk
      line: "Ada satu perjalanan\nyang sampai sekarang\nmasih kuingat dengan sangat jelas.",
    },
    {
      kind: "prose",
      act: 1,
      no: "06",
      title: "THE LAST JOURNEY TO HER",
      art: "journey",
      beats: [
        "Aku melihat keadaan ibu dari jauh.\nDari sebuah WhatsApp story. Lalu video.",
        "Dan untuk pertama kalinya,\naku merasa… aku harus pergi.",
        "Aku minta bapak dan nenek ikut.\nMereka tidak ikut.",
        "Jadi aku pergi sendiri.",
        "Saat sampai, ibu sudah jauh lebih kurus.\nBahkan untuk berjalan pun ia butuh bantuan.",
        "Aku menangis di hadapannya. Meminta maaf.",
        "Bukan karena aku tidak menyayanginya.\nTapi karena aku merasa\nbelum bisa melakukan banyak hal untuknya.",
      ],
    },
    {
      kind: "prose",
      act: 1,
      no: "07",
      title: "GOODBYE, MOM",
      art: "white-cloth",
      beats: [
        "Beberapa waktu kemudian,\naku mendapat kabar bahwa ibu pergi.",
        "Aku meminta bapak untuk berangkat.\nKami pergi malam itu.",
        "Dan sebelum subuh, aku akhirnya sampai.",
        "Aku melihat ibu untuk terakhir kalinya.",
        "Aku membantu memandikannya.\nMengumandangkan adzan.\nMengantarkan pemakamannya.\nDan ikut menguburkannya.",
        "Hari itu aku kehilangan seseorang\nyang paling ingin kulihat bahagia.",
      ],
    },
    {
      kind: "frame",
      act: 1,
      no: "08",
      title: "THE GRADUATION SHE NEVER SAW",
      intro: [
        "Ibu pernah bilang\nia ingin melihatku lulus SMK.",
        "Ia ingin datang.\nMembawa keluarga dari pihaknya.\nMerayakannya. Punya satu foto bersama.",
      ],
      frameNote: "the photo we never took",
      caption: "Tapi akhirnya, aku berdiri di sana sendirian.",
      lines: [
        "Satu foto yang tidak pernah sempat kami ambil.",
        "Ibu bahkan pernah meminta maaf\nkarena uang yang ia tabung untuk kuliahku\nharus digunakan untuk pengobatannya.",
        "Padahal menurutku, ibu tidak pernah punya sesuatu\nyang harus ia minta maafkan.",
        "Ia sudah memberikan semuanya yang ia bisa.",
      ],
    },

    // ── ACT III — Kita Usahakan Rumah Itu ──────────────────────────────────────
    {
      kind: "act",
      act: 2,
      line: "Setelah semuanya,\nada banyak hal dalam hidupku\nyang ikut berubah.",
    },
    {
      kind: "prose",
      act: 2,
      no: "09",
      title: "THE DREAM I LEFT BEHIND",
      beats: [
        "Setelah ibu pergi,\nbanyak hal dalam hidupku ikut berubah.",
        "Dulu aku punya mimpi sekolah kedinasan.",
        "Kemudian aku meninggalkannya.",
        "Bukan karena mimpi itu buruk.\nTapi karena hidup mengarahkanku ke jalan lain.",
      ],
    },
    {
      kind: "prose",
      act: 2,
      no: "10",
      title: "SOMEHOW, I FOUND IT",
      art: "steps",
      beats: [
        "Aku tidak pernah membayangkan\nakan berakhir di sini.",
        "Aku menemukan IT setelah semuanya berubah.",
        "Belajar sedikit demi sedikit.\nMencoba. Gagal. Belajar lagi.",
        "Sampai akhirnya… aku menjadi QA.",
        "Tapi ini bukan cerita tentang “akhirnya berhasil”.",
        "Karena aku belum sampai.",
      ],
    },
    {
      kind: "prose",
      act: 2,
      no: "11",
      title: "THE ROAD I'M ON",
      art: "road",
      beats: [
        "Sampai hari ini, aku masih belajar.\nMasih membangun diri.",
        "Masih mencari tahu\nsebenarnya aku ingin menjadi siapa.",
        "Banyak jalan yang belum pernah kulewati.\nBanyak hal yang belum berhasil kubangun.",
        "Tapi mungkin… memang begitulah hidup.",
      ],
    },
    {
      kind: "prose",
      act: 2,
      no: "12",
      title: "AND THEN THERE'S YOU",
      art: "two-dots",
      beats: [
        "Dua titik kecil di jalan yang sama.\nSatu titik: aku.\nSatu titik: kamu.",
        "Dan kemudian, ada kamu.",
        "Kita datang dari tempat yang berbeda.",
        "Mungkin kamu tumbuh dengan sesuatu\nyang tidak pernah benar-benar kumiliki.",
        "Mungkin jalan keluargamu\njauh lebih tenang daripada jalanku.",
        "Sementara aku…\nmasih membangun semuanya dari awal.",
      ],
    },
    {
      kind: "prose",
      act: 2,
      no: "13",
      title: "I'M STILL BECOMING",
      beats: [
        "Aku belum menjadi seseorang yang bisa bilang:\n“Aku sudah punya semuanya.”",
        "Belum.",
        "Aku masih mengejar banyak hal.\nMasih belajar. Masih berusaha.\nMasih sering takut apakah aku akan berhasil.",
        "Tapi aku ingin terus berjalan.",
        "Untuk diriku.\nUntuk mimpi-mimpiku.\nDan untuk seseorang yang dulu begitu ingin\nmelihatku punya masa depan. Ibu.",
        "Aku memang tidak bisa membawanya\nmelihat masa depanku.",
        "Jadi aku yang akan membawa harapannya\nbersamaku menuju masa depan itu.",
      ],
    },
    {
      kind: "prose",
      act: 2,
      no: "14",
      title: "WHAT I'M AFRAID OF",
      mood: "intimate",
      beats: [
        "Dan mungkin, ini bagian\nyang paling sulit untuk kukatakan.",
        "Aku takut suatu hari nanti\nkamu melihat perjalanan hidup kita\ndan merasa aku terlalu jauh di belakangmu.",
        "Aku takut perbedaan keluarga,\nkeadaan, dan apa yang kita punya\nmembuatmu bertanya:\n“Apakah aku ingin menjalani semua ini bersamanya?”",
        "Karena aku tidak ingin\nkamu berjalan bersamaku karena kasihan.",
        "Aku juga tidak ingin\nkamu merasa harus menyelamatkanku.",
      ],
    },
    {
      kind: "prose",
      act: 2,
      no: "15",
      title: "THIS IS ME",
      art: "sunrise",
      beats: [
        "Aku hanya ingin kamu tahu: ini aku.",
        "Seseorang yang pernah kehilangan.\nPernah melepaskan.\nPernah mengubah mimpi.\nPernah merasa tertinggal.",
        "Dan sampai sekarang masih belajar\nmenjadi seseorang yang bisa kubanggakan.",
        "Aku belum selesai.\nAku masih menjadi.",
      ],
    },
  ] as Scene[],

  // FINAL — pertanyaan
  question: {
    // Muncul satu per satu.
    lines: [
      "Sekarang kamu tahu\ndari mana aku berasal.",
      "Kamu tahu hal-hal yang pernah membentukku.",
      "Kamu tahu apa yang pernah hilang.",
      "Kamu tahu aku belum sampai\ndi tempat yang ingin kutuju.",
      "Dan kamu tahu\naku masih punya perjalanan yang panjang.",
    ],
    prompt: "Jadi aku ingin bertanya sesuatu.",
    question: "Setelah mengetahui semua tentang aku…\napakah kamu masih ingin berjalan bersamaku?",
    stayLabel: "Aku ingin tetap berjalan bersamamu →",
    waitLabel: "Aku butuh waktu untuk menjawab →",
  },

  // Penutup — kalau memilih "tetap berjalan"
  endingStay: {
    lines: [
      "Kalau begitu…",
      "jangan berjalan di belakangku.\nJangan juga berjalan di depanku.",
      "Berjalanlah di sampingku.",
      "Karena aku masih punya perjalanan yang panjang.",
      "Dan mungkin, suatu hari nanti…\nketika kita menoleh ke belakang,",
      "kita akan melihat\nbetapa jauhnya kita sudah berjalan.",
    ],
    finalLine: "Bersama. ♡",
    // Muncul bersama rumah kecil yang terbangun.
    closer: "Suatu hari nanti,\nmungkin kita akan membangun tempat untuk pulang.",
    replayLabel: "ulang dari awal",
    backLabel: "kembali ♡",
  },

  // Penutup — kalau memilih "butuh waktu"
  endingWait: {
    lines: [
      "Nggak apa-apa.",
      "Kamu nggak harus menjawab sekarang.",
      "Aku menceritakan semua ini\nbukan untuk meminta jawaban.",
      "Aku hanya ingin kamu benar-benar mengenalku.",
      "Aku akan tetap di sini,\ndan jalanku akan tetap terbuka.",
    ],
    finalLine: "Pelan-pelan saja. ♡",
    reconsiderLabel: "sebenarnya, aku ingin tetap berjalan →",
    replayLabel: "ulang dari awal",
    backLabel: "kembali ♡",
  },

  // Label & petunjuk kecil.
  ui: {
    tapHint: "ketuk untuk lanjut",
    continueLabel: "lanjut ♡",
    back: "kembali",
    muteOn: "Matikan lagu",
    muteOff: "Nyalakan lagu",
  },
} as const;
