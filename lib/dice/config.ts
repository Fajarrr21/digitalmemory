/**
 * Roll the Love Dice — all hand-written content: the six faces, the four
 * modes, the wild cards and the challenge bank. Every challenge is tagged with
 * the modes it belongs to (S soft · R romantic · D deep · C chaos) and how it's
 * finished: "a" = something to say/write (an optional answer box), "x" = a
 * thing to DO (no box — just Done).
 */

export type DiceMode = "soft" | "romantic" | "deep" | "chaos";
export type CategoryKey = "sweet" | "deep" | "childhood" | "confession" | "mini" | "future";
export type ChallengeKind = "a" | "x";
export type WildKey = "switch" | "double" | "choice" | "heart";

export const DICE_TAGLINE = "A little roll, a little surprise, a little more about us.";

export const MODES: { key: DiceMode; label: string; hint: string; emoji: string }[] = [
  { key: "soft", label: "Soft", hint: "ringan, manis, menyenangkan", emoji: "🌷" },
  { key: "romantic", label: "Romantic", hint: "pujian & kata sayang", emoji: "💌" },
  { key: "deep", label: "Deep", hint: "reflektif, lebih dalam", emoji: "🌙" },
  { key: "chaos", label: "Chaos", hint: "absurd, random, lucu", emoji: "🌀" },
];

export type Category = {
  key: CategoryKey;
  face: number;
  name: string;
  icon: string;
  /** card / dice-face tint and the deeper ink used for pips + icons */
  tint: string;
  ink: string;
  line: string;
};

export const CATEGORIES: Category[] = [
  { key: "sweet", face: 1, name: "Sweet Words", icon: "💗", tint: "#F8E5E9", ink: "#C46B80", line: "pujian & kata sayang" },
  { key: "deep", face: 2, name: "Deep Talk", icon: "☕", tint: "#EFE2D0", ink: "#8D6E52", line: "saling memahami" },
  { key: "childhood", face: 3, name: "Childhood Stories", icon: "🪁", tint: "#E6DFF3", ink: "#7E6BA8", line: "kenangan kecil" },
  { key: "confession", face: 4, name: "Confession", icon: "🤫", tint: "#EFCCD3", ink: "#A9586B", line: "pengakuan kecil" },
  { key: "mini", face: 5, name: "Mini Challenge", icon: "⚡", tint: "#DCEBD9", ink: "#5E8A5A", line: "lakukan sekarang" },
  { key: "future", face: 6, name: "Our Future", icon: "🏡", tint: "#DDD3EA", ink: "#6F5A92", line: "impian bersama" },
];

export const categoryByFace = (face: number) => CATEGORIES[face - 1];
export const categoryOf = (key: string) => CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0];

/** One in eight rolls turns up a wild card — rare enough to stay a surprise. */
export const WILD_CHANCE = 1 / 8;

export const WILDS: Record<WildKey, { name: string; icon: string; line: string }> = {
  switch: { name: "Switch Roles", icon: "🔁", line: "Kalian berdua menjawab pertanyaan yang sama." },
  double: { name: "Double Trouble", icon: "✌️", line: "Dua tantangan sekaligus, ya." },
  choice: { name: "Your Choice", icon: "🎯", line: "Kamu bebas memilih kategorinya." },
  heart: { name: "Heart Skip", icon: "💝", line: "Kalau mau, lewati kartu ini dan lempar lagi — giliranmu tetap." },
};

/** Little lines after a finished challenge. */
export const DONE_LINES = [
  "aww. noted ♡",
  "itu manis banget.",
  "satu lagi tentang kita.",
  "disimpan di hati, ya.",
  "lucu. lagi dong.",
  "pelan-pelan makin kenal ♡",
];

type Raw = [text: string, modes: string, kind?: ChallengeKind];

const RAW: Record<CategoryKey, Raw[]> = {
  sweet: [
    ["Sebutkan 3 hal yang paling kamu sukai dariku.", "SR"],
    ["Berikan aku satu nama panggilan baru — lengkap dengan asal-usulnya.", "SRC"],
    ["Jelaskan kenapa aku spesial dalam 3 kalimat.", "RD"],
    ["Apa hal kecil dariku yang selalu berhasil membuatmu tersenyum?", "SR"],
    ["Kalau harus menggambarkanku dengan satu kata, apa itu?", "S"],
    ["Puji aku seolah-olah kamu sedang sidang skripsi di depan dosen paling galak.", "C"],
    ["Sebutkan satu kebiasaanku yang diam-diam menurutmu menggemaskan.", "SR"],
    ["Kalau aku adalah sebuah lagu, lagu apa — dan kenapa?", "SR"],
    ["Apa satu hal yang aku lakukan yang membuatmu merasa aman?", "RD"],
    ["Buat satu kalimat gombal yang harus memuat kata \"kulkas\".", "C"],
    ["Ceritakan satu momen ketika kamu diam-diam bangga padaku.", "RD"],
    ["Sebutkan 5 pujian untukku dalam 20 detik, tanpa jeda.", "SC", "x"],
    ["Apa yang paling kamu suka dari caraku bicara?", "R"],
    ["Kalau aku sebuah makanan, aku makanan apa? Jelaskan dengan sangat serius.", "C"],
    ["Apa yang paling kamu rindukan dariku saat kita berjauhan?", "RD"],
    ["Ucapkan terima kasih untuk satu hal kecil dariku yang jarang kamu sebut.", "RD"],
    ["Kalau kamu harus membuat iklan 15 detik tentang aku, apa slogannya?", "C"],
    ["Bagian mana dari wajahku yang paling kamu suka?", "SR"],
    ["Apa yang membuatmu yakin memilihku?", "RD"],
    ["Ceritakan aku ke orang asing imajiner dalam tiga kalimat — versi paling lebay.", "C"],
  ],
  deep: [
    ["Kapan terakhir kali kamu merasa benar-benar dimengerti?", "D"],
    ["Apa yang bisa aku lakukan agar kamu merasa lebih dicintai?", "DR"],
    ["Apa ketakutan terbesarmu dalam sebuah hubungan?", "D"],
    ["Apa hal yang sulit kamu ceritakan kepada orang lain?", "D"],
    ["Menurutmu, seperti apa hubungan yang sehat?", "SD"],
    ["Apa yang sedang sering kamu pikirkan akhir-akhir ini, tapi belum sempat kamu ceritakan?", "SD"],
    ["Bagaimana caramu tahu kalau kamu sedang butuh istirahat?", "S"],
    ["Bahasa cinta apa yang paling kamu butuhkan minggu ini?", "SR"],
    ["Kalau sedang sedih, kamu lebih ingin ditemani diam-diam atau diajak bicara?", "SD"],
    ["Apa satu hal yang ingin kamu maafkan dari dirimu sendiri?", "D"],
    ["Apa yang membuatmu merasa cukup, walau harinya sedang berat?", "D"],
    ["Pernahkah kamu merasa kurang didengar olehku? Ceritakan pelan-pelan, aku mendengarkan.", "D"],
    ["Nilai hidup apa yang tidak akan pernah kamu tukar dengan apa pun?", "D"],
    ["Kalau bisa bicara dengan dirimu lima tahun lalu, apa yang ingin kamu katakan?", "SD"],
    ["Apa arti \"rumah\" buatmu?", "RD"],
    ["Apa satu hal yang ingin kamu perbaiki dari cara kita berkomunikasi?", "D"],
    ["Kalau kamu jadi presiden sehari, aturan aneh apa yang kamu buat — dan kenapa sebenarnya itu penting buatmu?", "C"],
    ["Bubur diaduk atau tidak? Pertahankan jawabanmu seperti debat capres.", "C"],
    ["Apa hal paling tidak masuk akal yang kamu percaya waktu kecil — dan masih sedikit kamu percaya sekarang?", "C"],
    ["Dari 1 sampai 10, seberapa lelah kamu minggu ini? Apa yang bisa sedikit meringankannya?", "S"],
    ["Momen apa yang membuatmu merasa paling dekat denganku?", "R"],
    ["Kapan kamu merasa paling menjadi dirimu sendiri saat bersamaku?", "RD"],
  ],
  childhood: [
    ["Apa kenakalan paling lucu yang pernah kamu lakukan?", "SC"],
    ["Apa cita-cita masa kecilmu?", "S"],
    ["Apa kenangan masa kecil yang paling kamu rindukan?", "SD"],
    ["Siapa orang yang paling berpengaruh dalam masa kecilmu?", "D"],
    ["Apa hal yang dulu kamu takuti, tapi sekarang justru kamu rindukan?", "D"],
    ["Kartun atau acara TV apa yang dulu tidak boleh terlewat?", "S"],
    ["Jajanan sekolah apa yang paling kamu rindukan?", "S"],
    ["Pernahkah kamu dihukum guru? Ceritakan versi paling jujurnya.", "C"],
    ["Mainan apa yang dulu paling kamu sayang?", "S"],
    ["Siapa cinta monyet pertamamu? Ceritakan — aku janji tidak cemburu (sedikit).", "RC"],
    ["Apa pelajaran hidup pertama yang kamu ingat dari orang tuamu?", "D"],
    ["Kalau dirimu yang kecil melihatmu sekarang, kira-kira apa yang akan dia bilang?", "DR"],
    ["Apa kebohongan kecil terlucu yang pernah kamu katakan waktu kecil?", "C"],
    ["Peragakan gayamu waktu kecil kalau sedang difoto.", "C", "x"],
    ["Lagu apa yang selalu mengingatkanmu pada masa kecil?", "SR"],
    ["Kapan di masa kecil kamu merasa paling disayang?", "RD"],
    ["Apa yang biasanya kamu lakukan saat libur sekolah?", "S"],
    ["Pernah punya teman khayalan atau julukan aneh? Ceritakan.", "C"],
    ["Apa yang dulu membuatmu menangis paling keras?", "D"],
    ["Kalau bisa kembali satu hari ke masa kecil, hari apa yang kamu pilih?", "RD"],
  ],
  confession: [
    ["Kapan pertama kali kamu merasa nyaman denganku?", "R"],
    ["Apa hal kecil dariku yang diam-diam kamu perhatikan?", "SR"],
    ["Apa yang pernah kamu pikirkan tentang aku, tapi belum pernah kamu katakan?", "RD"],
    ["Pernahkah kamu tersenyum sendiri karena mengingatku? Kapan?", "SR"],
    ["Apa satu hal yang ingin kamu sampaikan, tapi selalu tertunda?", "D"],
    ["Apa kesan pertamamu tentang aku — yang jujur?", "SC"],
    ["Akui satu hal yang pernah membuatmu cemburu, sekecil apa pun.", "RC"],
    ["Pernahkah kamu membaca ulang chat kita? Bagian yang mana?", "R"],
    ["Apa kebiasaan anehmu yang belum aku tahu?", "SC"],
    ["Kapan kamu sadar kamu mulai sayang padaku?", "RD"],
    ["Apa yang pernah membuatmu ragu — dan apa yang membuatmu tetap tinggal?", "D"],
    ["Pernahkah kamu pura-pura suka sesuatu demi aku? Apa itu?", "SC"],
    ["Apa hal yang paling kamu takutkan untuk aku ketahui tentangmu?", "D"],
    ["Akui: siapa yang lebih sering kangen duluan?", "SC"],
    ["Pernahkah kamu stalking media sosialku? Sampai sejauh apa?", "C"],
    ["Apa satu permintaan maaf yang belum sempat terucap?", "D"],
    ["Pernahkah kamu latihan dulu sebelum mengirim pesan untukku?", "RC"],
    ["Apa yang membuatmu merasa beruntung memilikiku, tapi belum pernah kamu bilang?", "R"],
    ["Hal paling memalukan yang kamu lakukan minggu ini?", "C"],
    ["Apa yang diam-diam kamu simpan karena mengingatkanmu padaku?", "SR"],
  ],
  mini: [
    ["Kirim voice note berisi rayuan paling garing.", "RC", "x"],
    ["Rayu aku dalam waktu 15 detik.", "RC", "x"],
    ["Kirim foto ekspresi wajahmu sekarang.", "SC", "x"],
    ["Nyanyikan satu potongan lagu yang mengingatkanmu padaku.", "R", "x"],
    ["Sebutkan namaku dengan nada paling manis.", "SR", "x"],
    ["Tirukan caraku tertawa.", "C", "x"],
    ["Kirim foto benda terdekat yang mengingatkanmu padaku.", "S", "x"],
    ["Buat pantun dua baris tentang kita, sekarang juga.", "SC"],
    ["Tatap layar 10 detik tanpa tertawa.", "C", "x"],
    ["Ceritakan harimu dalam 3 emoji, lalu jelaskan.", "S"],
    ["Ucapkan \"aku sayang kamu\" dalam tiga gaya: pembaca berita, sinetron, dan robot.", "C", "x"],
    ["Tulis satu pesan manis untukku tanpa memakai huruf \"a\".", "C"],
    ["Kirim selfie dengan pose andalanmu waktu SMA.", "C", "x"],
    ["Bacakan satu kalimat romantis dengan suara pembaca berita.", "RC", "x"],
    ["Peluk bantal seolah-olah itu aku, kirim buktinya.", "R", "x"],
    ["Gambar wajahku dalam 30 detik, lalu tunjukkan hasilnya.", "SC", "x"],
    ["Ajari aku satu hal kecil yang kamu kuasai, dalam satu menit.", "S", "x"],
    ["Tarik napas dalam bersama tiga kali, pelan-pelan. Lalu sebut satu hal yang kamu syukuri.", "SD", "x"],
    ["Kirim voice note berisi tiga hal yang kamu syukuri hari ini.", "DR", "x"],
    ["Tulis satu janji kecil untukku minggu ini.", "RD"],
    ["Sebutkan lima hal tentangku dalam 10 detik.", "RC", "x"],
  ],
  future: [
    ["Kalau besok kita bisa bertemu, apa yang ingin kamu lakukan pertama kali?", "SR"],
    ["Seperti apa rumah impianmu?", "SR"],
    ["Sebutkan 3 hal yang ingin kita lakukan bersama tahun depan.", "SR"],
    ["Kalau kita punya satu minggu liburan bersama, kamu ingin pergi ke mana?", "SR"],
    ["Apa kebiasaan yang ingin kita bangun bersama suatu hari nanti?", "DR"],
    ["Apa satu tradisi kecil yang ingin kita punya?", "R"],
    ["Kalau kita punya hewan peliharaan, namanya apa?", "SC"],
    ["Bagaimana kamu membayangkan Minggu pagi kita sepuluh tahun lagi?", "RD"],
    ["Apa satu hal yang ingin kamu pelajari bersamaku?", "SD"],
    ["Apa yang paling kamu harapkan dari dirimu sendiri setahun ke depan?", "D"],
    ["Bagaimana sebaiknya kita menyelesaikan pertengkaran di masa depan?", "D"],
    ["Kalau kita jadi kakek-nenek, kita bakal jadi kakek-nenek yang seperti apa?", "RC"],
    ["Kalau kita buka usaha bersama, usaha apa — dan siapa yang jadi bosnya?", "C"],
    ["Kalau kita menang undian besok, apa hal pertama yang kita beli?", "SC"],
    ["Kota mana yang ingin kamu tinggali bersamaku?", "RD"],
    ["Apa yang ingin kamu pastikan tetap sama dari kita, apa pun yang berubah?", "DR"],
    ["Kalau kisah kita jadi film, apa judulnya dan siapa pemerannya?", "C"],
    ["Apa satu mimpi yang ingin kamu kejar, dan bagaimana aku bisa mendukungnya?", "D"],
    ["Rencanakan kencan kita berikutnya dalam 30 detik.", "SR"],
    ["Kalau kita punya lagu keluarga, lagu apa?", "RC"],
  ],
};

const MODE_LETTER: Record<string, DiceMode> = { S: "soft", R: "romantic", D: "deep", C: "chaos" };

export type BankChallenge = { key: string; category: CategoryKey; text: string; modes: DiceMode[]; kind: ChallengeKind };

/** The built-in bank. Keys are stable (category + index) so "seen" survives a deploy. */
export const BANK: BankChallenge[] = (Object.keys(RAW) as CategoryKey[]).flatMap((category) =>
  RAW[category].map(([text, modes, kind = "a"], i) => ({
    key: `b:${category}:${i}`,
    category,
    text,
    modes: [...modes].map((l) => MODE_LETTER[l]),
    kind,
  })),
);
