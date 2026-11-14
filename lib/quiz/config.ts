/**
 * Seberapa Kenal Kita? — the 25-question bank, feedback lines and titles.
 * Human-written (a curated bank, not generated at runtime). `self` is what you
 * see when filling your own sheet; `guess` is what your partner sees ({n} =
 * your name).
 */

export const QUIZ_SIZE = 25;
export const POINTS = 100;

export type QuizTone = "sweet" | "playful" | "savage";

export type QuizQuestion = { cat: string; self: string; guess: string };

export const QUESTIONS: QuizQuestion[] = [
  { cat: "Makanan & minuman", self: "Apa makanan favoritmu?", guess: "Apa makanan favorit {n}?" },
  { cat: "Makanan & minuman", self: "Minuman yang paling sering kamu pesan?", guess: "Minuman yang paling sering {n} pesan?" },
  { cat: "Makanan & minuman", self: "Makanan yang paling kamu nggak suka?", guess: "Makanan yang paling {n} nggak suka?" },
  { cat: "Makanan & minuman", self: "Camilan andalanmu kalau lapar malam-malam?", guess: "Camilan andalan {n} kalau lapar malam-malam?" },
  { cat: "Kebiasaan", self: "Hal pertama yang kamu lakukan setelah bangun tidur?", guess: "Hal pertama yang {n} lakukan setelah bangun tidur?" },
  { cat: "Kebiasaan", self: "Kebiasaan anehmu yang jarang orang tahu?", guess: "Kebiasaan aneh {n} yang jarang orang tahu?" },
  { cat: "Kebiasaan", self: "Apa yang biasanya kamu lakukan sebelum tidur?", guess: "Apa yang biasanya {n} lakukan sebelum tidur?" },
  { cat: "Kebiasaan", self: "Kalau lagi bosan, kamu biasanya ngapain?", guess: "Kalau lagi bosan, {n} biasanya ngapain?" },
  { cat: "Kesukaan", self: "Warna favoritmu?", guess: "Warna favorit {n}?" },
  { cat: "Kesukaan", self: "Genre film/series yang paling kamu suka?", guess: "Genre film/series yang paling {n} suka?" },
  { cat: "Kesukaan", self: "Penyanyi atau band yang paling sering kamu dengar?", guess: "Penyanyi atau band yang paling sering {n} dengar?" },
  { cat: "Kesukaan", self: "Hal kecil yang paling bikin kamu bahagia?", guess: "Hal kecil yang paling bikin {n} bahagia?" },
  { cat: "Kepribadian", self: "Apa yang biasanya kamu lakukan saat marah?", guess: "Apa yang biasanya {n} lakukan saat marah?" },
  { cat: "Kepribadian", self: "Saat sedih, kamu biasanya…?", guess: "Saat sedih, {n} biasanya…?" },
  { cat: "Kepribadian", self: "Hal yang paling kamu takuti?", guess: "Hal yang paling {n} takuti?" },
  { cat: "Kepribadian", self: "Satu kata yang paling menggambarkan dirimu?", guess: "Satu kata yang paling menggambarkan {n}?" },
  { cat: "Hubungan", self: "Cara disayang yang paling kamu rasakan? (kata-kata, waktu, sentuhan, hadiah, bantuan)", guess: "Cara disayang yang paling {n} rasakan?" },
  { cat: "Hubungan", self: "Momen bersama yang paling kamu ingat?", guess: "Momen bersama yang paling {n} ingat?" },
  { cat: "Hubungan", self: "Panggilan sayang dariku yang paling kamu suka?", guess: "Panggilan sayang darimu yang paling {n} suka?" },
  { cat: "Hubungan", self: "Kencan impianmu seperti apa?", guess: "Kencan impian {n} seperti apa?" },
  { cat: "Preferensi pribadi", self: "Pantai atau gunung?", guess: "{n} lebih suka pantai atau gunung?" },
  { cat: "Preferensi pribadi", self: "Waktu favoritmu: pagi, siang, sore, atau malam?", guess: "Waktu favorit {n}: pagi, siang, sore, atau malam?" },
  { cat: "Preferensi pribadi", self: "Tempat liburan impianmu?", guess: "Tempat liburan impian {n}?" },
  { cat: "Random & unik", self: "Kalau bisa punya satu kekuatan super, kamu pilih apa?", guess: "Kalau bisa punya satu kekuatan super, {n} pilih apa?" },
  { cat: "Random & unik", self: "Kalau jadi hewan, kamu merasa jadi hewan apa?", guess: "Kalau jadi hewan, {n} merasa jadi hewan apa?" },
];

export const TONES: { key: QuizTone; label: string; hint: string }[] = [
  { key: "sweet", label: "Sweet", hint: "lembut & penuh pujian" },
  { key: "playful", label: "Playful", hint: "jahil & menggoda" },
  { key: "savage", label: "Savage", hint: "pedas, tapi bercanda" },
];

type Line = { title: string; line: string };

export const FEEDBACK: Record<QuizTone, { right: Line[]; wrong: Line[] }> = {
  sweet: {
    right: [
      { title: "Kamu pintar banget! ❤️", line: "Ternyata kamu memperhatikan aku sampai hal sekecil ini." },
      { title: "Benar, sayang ♡", line: "Kamu hafal banget sama aku. Love you!" },
      { title: "Tepat sekali ♡", line: "Wah, ternyata kamu benar-benar mendengarkan ceritaku." },
      { title: "Yay! ❤️", line: "Duh, makin sayang sama kamu." },
    ],
    wrong: [
      { title: "Hampir… ♡", line: "Nggak apa-apa, sekarang kamu jadi tahu satu hal baru tentang aku." },
      { title: "Belum tepat ♡", line: "Pelan-pelan aja kenalnya, aku nggak ke mana-mana kok." },
      { title: "Ups ♡", line: "Yang ini nanti aku ceritain lagi, ya." },
    ],
  },
  playful: {
    right: [
      { title: "Pacarku emang paling perhatian!", line: "Oke oke, kamu lolos ronde ini. 😌" },
      { title: "Kok tahu sih? 👀", line: "Jangan-jangan kamu diam-diam nyatet tentang aku." },
      { title: "Benar! ❤️", line: "Satu poin buat orang yang paling merhatiin aku." },
      { title: "Mantap! ✨", line: "Hafal di luar kepala, ya?" },
    ],
    wrong: [
      { title: "Kamu siapa sih? 😭", line: "Masa hal beginian aja nggak tahu?" },
      { title: "Waduh 🙈", line: "Katanya paling sayang, kok jawabannya begitu?" },
      { title: "Hmm… 🤨", line: "Aku harus memperkenalkan diri ulang sepertinya." },
      { title: "Salah! 😤", line: "Nanti kita bahas ini baik-baik ya. Baik-baik." },
    ],
  },
  savage: {
    right: [
      { title: "Tumben bener. 😏", line: "Oke, kali ini kamu beruntung." },
      { title: "Lho, bisa? 😳", line: "Ternyata otakmu ada slot buat aku juga." },
      { title: "Benar. Akhirnya.", line: "Aku hampir nggak percaya, tapi oke." },
    ],
    wrong: [
      { title: "Kamu siapa sih? 😭", line: "Selama ini kamu pacaran sama siapa, sama NPC?" },
      { title: "Salah total. 💀", line: "Memori kamu cuma bertahan tiga detik ya?" },
      { title: "Yaampun. 🙄", line: "Sepertinya kamu perlu mengenalku dari awal lagi." },
      { title: "Bukan itu. 😑", line: "Ingatan tentang aku kayaknya perlu di-upgrade." },
    ],
  },
};

export const TITLES: { min: number; title: string }[] = [
  { min: 100, title: "Human Encyclopedia of Love" },
  { min: 80, title: "Si Paling Perhatian" },
  { min: 60, title: "Sudah Cukup Memahami" },
  { min: 40, title: "Lumayan Kenal" },
  { min: 0, title: "Kenalan Lagi Yuk 😭" },
];
