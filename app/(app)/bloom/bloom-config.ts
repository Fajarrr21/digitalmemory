// 🌸 Fitur kejutan bunga — semua teksnya di sini.
// Edit bebas: ganti kata-katanya, tambah/kurangi baris. Nggak perlu ngoprek
// komponen lain. Baris pembuka muncul satu per satu sebelum bunga mekar.

export const bloomConfig = {
  // Kata-kata pembuka. Muncul satu-satu; tiap tap nampilin baris berikutnya.
  // Baris terakhir = pemicu bunga mekar.
  openingLines: [
    "Kadang, ada hal-hal kecil\nyang nggak perlu alasan untuk diberikan.",
    "Jadi kali ini,\naku cuma mau ngasih sesuatu buat kamu.",
    "Nggak seberapa sih, emang.",
    "Tapi semoga bisa membuat harimu\nsedikit lebih indah yaa.\nGood night, sleep well, i love u sayang. 🌷",
    "Buka pelan-pelan, ya.",
  ],

  // Tulisan kecil di bawah baris pembuka (petunjuk halus buat ngetuk).
  tapHint: "ketuk untuk lanjut",

  // Tombol/isyarat terakhir yang memicu bunga mekar.
  openLabel: "buka pelan-pelan…",

  // Petunjuk halus buat gulir ke suratnya (muncul di bawah bunga).
  scrollHint: "gulir pelan-pelan ke bawah",

  // 💌 Surat yang muncul SETELAH bunga mekar. Tiap paragraf naik lembut satu
  // per satu saat di-scroll. `tone`: "title" (besar), "accent" (tulisan tangan),
  // "body" (paragraf). Tambah/kurangi/ubah bebas.
  letter: [
    { text: "Buat kamu. 🌷", tone: "title" },
    { text: "Selamat malam, sayang.", tone: "accent" },
    {
      text: "Sebelum kamu menutup hari ini dan memejamkan mata, aku cuma ingin meninggalkan sedikit sesuatu untukmu.",
      tone: "body",
    },
    {
      text: "Mungkin hari ini nggak selalu berjalan seperti yang kamu inginkan. Mungkin ada hal-hal yang melelahkan, ada pikiran yang belum selesai, atau mungkin ada beberapa hal kecil yang diam-diam membuatmu merasa kurang baik.",
      tone: "body",
    },
    {
      text: "Tapi apa pun yang terjadi hari ini, aku harap kamu tahu kalau kamu sudah melakukan yang terbaik yang kamu bisa.",
      tone: "body",
    },
    {
      text: "Jadi malam ini, nggak perlu memikirkan semuanya terlalu jauh dulu. Istirahatlah. Biarkan semua yang berat untuk sementara berhenti di sini. Besok masih punya waktunya sendiri untuk datang membawa cerita yang baru.",
      tone: "body",
    },
    {
      text: "Dan kalau hari ini belum cukup baik untukmu, semoga malam ini bisa sedikit lebih lembut.",
      tone: "body",
    },
    {
      text: "Aku ingin kamu tidur dengan hati yang tenang, dengan senyum kecil di wajahmu, dan dengan perasaan bahwa ada seseorang yang selalu menganggap keberadaanmu sebagai sesuatu yang berharga.",
      tone: "body",
    },
    { text: "Terima kasih sudah menjadi kamu.", tone: "accent" },
    {
      text: "Terima kasih untuk semua hal kecil yang mungkin bahkan nggak kamu sadari, tapi selalu berhasil membuat hariku terasa lebih berarti.",
      tone: "body",
    },
    { text: "Sekarang waktunya istirahat, sayang.", tone: "accent" },
    { text: "Pejamkan matamu perlahan.", tone: "accent" },
    {
      text: "Semoga malam ini kamu ditemani mimpi yang indah, dan semoga saat kamu bangun nanti, dunia terasa sedikit lebih ramah kepadamu.",
      tone: "body",
    },
    { text: "Selamat malam, sayang.", tone: "accent" },
    { text: "Mimpi indah ya. ♡", tone: "accent" },
    {
      text: "Dan kalau kamu bertanya-tanya kenapa ada sesuatu yang menunggumu di sini…",
      tone: "body",
    },
    { text: "Anggap saja ini bunga kecil dariku untukmu.", tone: "accent" },
    { text: "Karena kamu adalah bagian terindah dari hariku. 🌷", tone: "title" },
  ],

  // 🎵 Lagu yang main pas bunga mekar (via YouTube, autoplay).
  // - youtubeId: ambil dari link (mis. youtu.be/XXXX -> "XXXX").
  // - startSeconds: mulai dari detik ke berapa (2:01 = 121). Kosongin youtubeId
  //   ("") kalau nggak mau ada lagu.
  song: {
    youtubeId: "3UdVruU2qGc",
    startSeconds: 121, // 2:01 — langsung ke reff
    title: "Laufey – Magnolia",
  },

  // Tombol ulang & kembali (biar bisa diputar lagi).
  replayLabel: "putar lagi",
  backLabel: "kembali",
} as const;
