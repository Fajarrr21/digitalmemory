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

  // Muncul SETELAH bunga mekar.
  finalMessage: "Buat kamu. 🌷",
  finalSub: "Selamat malam, sayang. Mimpi indah ya. ♡",

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
