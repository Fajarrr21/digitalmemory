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
  // (mis. youtu.be/XXXX → "XXXX"). `startSeconds` = mulai dari detik berapa.
  // Musik berganti otomatis saat pindah babak.
  acts: [
    {
      label: "ACT I",
      title: "Sesi Potret",
      subtitle: "Before you know me…",
      song: { youtubeId: "Nskf70DMR60", startSeconds: 30, title: "Enau ft. Ari Lesmana — Sesi Potret" },
    },
    {
      label: "ACT II",
      title: "Bunga Terakhir",
      subtitle: "Some goodbyes arrive before we're ready.",
      song: { youtubeId: "NBf5P9Qd6cs", startSeconds: 0, title: "Romeo — Bunga Terakhir" },
    },
    {
      label: "ACT III",
      title: "Kita Usahakan Rumah Itu",
      subtitle: "Maybe life didn't go as planned. Maybe that's okay.",
      song: { youtubeId: "7SqNVv98e8Q", startSeconds: 0, title: "Sal Priadi — Kita Usahakan Rumah Itu" },
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
        "Semuanya sebenarnya berawal\nsejak aku masih duduk di kelas 3 SMP.",
        "Saat itu, ibuku mulai sakit\nkanker getah bening.",
        "Sejak saat itu,\nkehidupan keluargaku perlahan berubah.",
        "Ibuku tinggal di Jakarta,\nsementara aku dan bapakku tinggal di sini.",
        "Hubungan kedua orang tuaku sudah lama tidak baik,\nmeskipun mereka tidak bercerai.",
        "Keduanya sama-sama keras dan sulit mengalah.\nDan keadaan keluarga menjadi seperti itu.",
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
        "Dari mereka berdua, aku belajar satu hal\nyang sampai sekarang masih kupegang.",
        "Dua api yang sama\ntidak boleh terus saling berkobar.",
        "Harus ada salah satunya\nyang memilih untuk padam.",
        "Dalam sebuah hubungan, terkadang bukan tentang\nsiapa yang menang atau siapa yang benar.",
        "Ada kalanya seseorang harus memilih untuk mengalah,\nagar sesuatu yang lebih besar\ntidak ikut terbakar.",
        "Dan pelajaran itu ingin kubawa, suatu hari nanti,\nketika aku menjalin hubungan dengan seseorang.",
      ],
    },
    {
      kind: "prose",
      act: 0,
      no: "03",
      title: "THE FIRST THING I HAD TO LET GO",
      art: "document",
      beats: [
        "Tidak lama setelah itu,\naku mengalami hal pertama yang harus kurelakan.",
        "Saat hendak masuk SMK, aku mendaftar sendiri\nke sekolah yang benar-benar kuinginkan.",
        "Aku pakai uangku sendiri untuk mendaftar,\ndan bahkan sudah mendapat pembagian kelas.",
        "Saat itu, semuanya terasa sudah sesuai\ndengan yang kuinginkan.",
        "Tapi saat daftar ulang,\nbiayanya ternyata cukup mahal.",
        "Setelah tahu keadaan keluarga saat itu,\nakhirnya aku memilih untuk mundur.",
        "Awalnya aku tidak rela. Rasanya seperti melepaskan\nsesuatu yang sudah kuperjuangkan sendiri.",
        "Tapi akhirnya aku mengalah.\nMungkin memang ini jalannya.",
        "Dari situlah aku mulai belajar\nmengikhlaskan sesuatu yang bukan milikku.",
      ],
    },
    {
      kind: "prose",
      act: 0,
      no: "04",
      title: "JAKARTA",
      subtitle: "Kelas 10.",
      art: "journey",
      beats: [
        "Di awal kelas 10, meskipun sedang sakit,\nibuku tetap memilih untuk bekerja.",
        "Beliau tidak mau banyak beristirahat,\nkarena selalu memikirkan masa depanku.",
        "Beliau bahkan menyisihkan uang\nuntuk biaya kuliah dan masa depanku.",
        "Sejak kecil aku memang sering ke Jakarta saat liburan.",
        "Tapi sejak ibu sakit, tujuanku berubah.\nAku tidak lagi pergi untuk bersenang-senang.",
        "Aku pergi untuk menjaga dan merawat ibuku —\nmenemaninya berobat dan menjalani kemoterapi.",
        "Hubunganku dengan bapak sering tidak baik karena itu.\nTapi sebagai anak, aku hanya ingin melakukan\nsesuatu untuk ibu, sebisaku.",
      ],
    },
    {
      kind: "prose",
      act: 0,
      no: "05",
      title: "THE HOSPITAL DAYS",
      subtitle: "Kelas 11.",
      art: "small-life",
      beats: [
        "Memasuki kelas 11,\nkondisi ibuku sudah cukup berat.",
        "Stadium akhir. Tidak bisa dioperasi\nkarena risikonya terlalu besar.",
        "Hampir setiap hari aku berada di rumah sakit\nuntuk menjaganya.",
        "Rumah sakitnya besar sekali.\nAku menjaga ibu di lantai atas,\nturun mencari makan, lalu naik lagi. Setiap hari.",
        "Kadang saat bosan, aku main game sebentar.\nKadang aku keluar membeli es kopi.",
        "Hal-hal kecil yang terdengar sepele,\ntapi justru sampai sekarang masih kuingat.",
        "Karena di tengah keadaan yang berat,\naku masih berusaha menjadi anak sekolah biasa.",
      ],
    },
    {
      kind: "prose",
      act: 0,
      no: "06",
      title: "MAYBE SHE'LL GET BETTER",
      mood: "hope",
      beats: [
        "Sempat ada masa ketika aku merasa lega.",
        "Kondisi ibu mulai membaik.\nPengobatannya menunjukkan perkembangan yang bagus.",
        "Bahkan sudah mendekati tahap radiasi.",
        "Saat itu aku mulai berpikir,\n“Mungkin semuanya akan baik-baik saja.”",
        "Tapi ternyata tidak sesederhana itu.",
        "Untuk radiasi, ibu harus bolak-balik ke rumah sakit\nhampir setiap tiga hari.",
        "Dengan kondisinya yang sudah seperti itu,\nbeliau akhirnya memutuskan untuk tidak menjalaninya.",
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
      no: "07",
      title: "SHE WOULDN'T STOP GIVING",
      subtitle: "Awal kelas 12.",
      beats: [
        "Memasuki awal kelas 12,\nkeadaan kembali berubah.",
        "Usaha tempat ibu bekerja menurun,\nsampai akhirnya tutup.",
        "Tapi ibu tidak menyerah. Beliau tetap di Jakarta\ndan mencoba membangunnya kembali.",
        "Ada satu hal yang paling kuingat dari masa itu.",
        "Ibu sering berbagi Jumat berkah\nuntuk jamaah salat Jumat.",
        "Di tengah sakit yang membuatnya semakin lemah,\nbeliau masih memikirkan orang lain.",
        "Tapi diam-diam, aku melihat kondisinya memburuk.\nBenjolan di lehernya semakin membesar.",
      ],
    },
    {
      kind: "prose",
      act: 1,
      no: "08",
      title: "THE LAST JOURNEY TO HER",
      art: "journey",
      beats: [
        "Suatu hari, aku melihat story WhatsApp ibu.\nBeliau sedang berada di kampung keluarganya.",
        "Tidak lama setelah itu,\naku dapat kabar kondisinya semakin memburuk.",
        "Aku dikirimi video dari keluarga, juga dari ibu sendiri.\nSaat melihatnya, aku benar-benar down. Aku menangis.",
        "Dulu beliau masih bisa berjalan.\nSekarang, untuk berdiri saja sudah kesulitan.",
        "Aku mengajak bapak dan mbahku untuk ikut.\nKeduanya menolak.",
        "Jujur, saat itu aku cukup marah kepada bapakku.\nKetika orang yang kita sayangi ada di titik seperti itu,\nseharusnya orang-orang terdekat ada di sisinya.",
        "Jadi aku berangkat sendiri. Naik kereta,\nlalu melanjutkan perjalanan sampai ke Banten.",
        "Ketika sampai, aku benar-benar kaget.\nTubuhnya sudah sangat kurus.\nUntuk berjalan pun ia butuh tongkat atau dibantu.",
        "Aku langsung menangis. Meminta maaf.",
        "Aku masih sekolah. Belum punya cukup uang.\nBegitu banyak yang ingin kulakukan untuknya,\ntapi belum mampu kulakukan.",
        "Aku hanya bisa berada di sana,\nmenemaninya sebisa mungkin.",
      ],
    },
    {
      kind: "prose",
      act: 1,
      no: "09",
      title: "GOODBYE, MOM",
      art: "white-cloth",
      beats: [
        "Beberapa waktu kemudian,\naku kembali sebagai siswa kelas 12\nyang sedang mempersiapkan ujian kelulusan.",
        "Sampai datang sebuah kabar\nyang mengubah semuanya.",
        "Saat itu aku sedang berbuka puasa\nketika mendapat telepon dari keluarga.",
        "Ibuku meninggal dunia.",
        "Aku memohon kepada bapak untuk ikut, sambil menangis,\nsampai akhirnya beliau bersedia.",
        "Kami berangkat dengan travel\ndan tiba menjelang subuh.",
        "Saat melihat ibu terbaring,\ntubuhnya sudah ditutup kain.",
        "Aku ikut memandikan jenazahnya.\nMengumandangkan adzan.\nMengantarkan pemakamannya.\nDan ikut menguburkannya sendiri.",
        "Hari itu aku tetap berpuasa,\nmeski tidak sempat sahur.",
      ],
    },
    {
      kind: "frame",
      act: 1,
      no: "10",
      title: "THE GRADUATION SHE NEVER SAW",
      intro: [
        "Ada satu hal dari ibu\nyang paling membekas di pikiranku.",
        "Dan mungkin akan selalu menjadi\nsalah satu patah hati terbesar dalam hidupku.",
        "Sebelum meninggal, ibu sering bilang\nia ingin melihatku lulus SMK.",
      ],
      frameNote: "the graduation photo we never took",
      caption: "Aku lulus. Aku wisuda.\nTapi orang yang paling ingin kulihat di sana, tidak ada.",
      lines: [
        "Waktu SD dan SMP, beliau tidak bisa datang.\nKarena itu, untuk wisuda SMK,\nbeliau ingin sekali hadir.",
        "Ia ingin membawa keluarga dari pihaknya,\nmerayakan kelulusanku,\ndan setidaknya punya satu foto bersamaku.",
        "Sebuah harapan yang sebenarnya sangat sederhana.",
        "Ibu juga pernah meminta maaf,\nkarena uang yang ia tabung untuk kuliahku\nbanyak terpakai untuk pengobatannya.",
        "Ia minta maaf jika tidak bisa melihatku lebih lama.\nIa begitu ingin melihatku tumbuh.",
        "Padahal menurutku, ibu tidak pernah punya sesuatu\nyang harus ia minta maafkan.",
        "Selama bertahun-tahun,\nbeliau sudah memberikan semuanya yang ia bisa.",
      ],
    },

    // ── ACT III — Kita Usahakan Rumah Itu ──────────────────────────────────────
    {
      kind: "act",
      act: 2,
      line: "Setelah ibu pergi,\nbanyak hal dalam hidupku\nikut berubah.",
    },
    {
      kind: "prose",
      act: 2,
      no: "11",
      title: "THE DREAM I LEFT BEHIND",
      beats: [
        "Setelah ibu meninggal, banyak hal berubah.\nTermasuk cita-citaku.",
        "Sebenarnya, sejak awal aku tidak berencana\nmasuk dunia IT.",
        "Di SMK, aku lebih banyak di organisasi,\nkepanitiaan event, forum, dan kegiatan relawan.",
        "Aku merasa semakin jauh dari dunia IT.\nLaptopku pun waktu itu sudah terbatas.",
        "Menuju kelas 3, aku malah menemukan\nhal lain yang ingin kukejar.",
        "Aku mulai menyukai olahraga fisik dan kardio.\nDan aku ingin mengejar sekolah kedinasan.",
        "Saat itu aku benar-benar yakin —\nrasanya, setelah lama mencari,\nakhirnya kutemukan jalan yang ingin kutempuh.",
        "Tapi setelah ibu meninggal,\nrencana itu tidak kulanjutkan.",
        "Aku sempat bertanya pada bapak,\n“Kalau aku kuliah saja bagaimana?”",
        "Tapi beliau tidak sanggup membiayainya sendiri.\nJadi aku memutuskan mencari jalan lain.",
      ],
    },
    {
      kind: "prose",
      act: 2,
      no: "12",
      title: "SOMEHOW, I FOUND IT",
      art: "steps",
      beats: [
        "Saat itu, aku sendiri tidak tahu\njalan seperti apa yang akan kuambil.",
        "Tapi pada akhirnya, aku menemukan jalanku.\nAku masuk ke dunia IT.",
        "Awalnya aku tidak yakin\napakah benar-benar cocok di sini.",
        "Tapi perlahan aku belajar.\nMencoba. Gagal. Belajar lagi.",
        "Aku mulai bekerja.\nMulai mengenal dunia QA.",
        "Dan akhirnya, tanpa pernah kurencanakan,\naku sampai di titik sekarang sebagai seorang QA.",
        "Tapi jujur, ini bukan jalan yang dulu kubayangkan.\nDan aku belum sampai.",
      ],
    },
    {
      kind: "prose",
      act: 2,
      no: "13",
      title: "LETTING GO ISN'T STOPPING",
      subtitle: "Yang kupelajari.",
      art: "road",
      beats: [
        "Mungkin memang begitulah hidup.\nKita merencanakan banyak hal,\nlalu keadaan mengubah semuanya.",
        "Aku pernah mengikhlaskan sekolah yang kuinginkan.",
        "Aku pernah mengikhlaskan cita-cita yang sudah kuyakini.",
        "Dan yang paling berat,\naku harus mengikhlaskan seseorang\nyang paling ingin melihatku berhasil.",
        "Tapi dari semuanya, aku belajar satu hal:\nmengikhlaskan bukan berarti berhenti.",
        "Kadang mengikhlaskan berarti menerima\nbahwa sesuatu memang sudah tidak bisa kuubah,\nlalu memilih untuk tetap berjalan.",
      ],
    },
    {
      kind: "prose",
      act: 2,
      no: "14",
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
      no: "15",
      title: "I'M STILL BECOMING",
      beats: [
        "Aku belum menjadi seseorang yang bisa bilang:\n“Aku sudah punya semuanya.” Belum.",
        "Aku masih mengejar banyak hal.\nMasih belajar. Masih berusaha.\nMasih sering takut apakah aku akan berhasil.",
        "Tapi aku ingin terus berjalan.\nUntuk cita-citaku. Untuk harapanku.",
        "Dan juga untuk harapan yang pernah dimiliki\nalmarhum ibuku untukku.",
        "Aku ingin, suatu hari nanti, melihat hidupku\ndan berkata bahwa semua perjuangan itu tidak sia-sia.",
        "Bahwa uang yang ibu tabung,\nwaktu dan rasa sakit yang ia tahan,\ntidak berhenti begitu saja ketika beliau pergi.",
        "Aku tidak bisa lagi membawa ibu\nmelihat masa depanku.",
        "Jadi aku yang akan membawa harapannya\nbersamaku menuju masa depan itu.",
      ],
    },
    {
      kind: "prose",
      act: 2,
      no: "16",
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
      no: "17",
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
