// 🌸 Fitur kejutan bunga — semua teksnya di sini.
// Edit bebas: ganti kata-katanya, tambah/kurangi baris. Nggak perlu ngoprek
// komponen lain. Baris pembuka muncul satu per satu sebelum bunga mekar.

export const bloomConfig = {
  // Kata-kata pembuka. Muncul satu-satu; tiap tap nampilin baris berikutnya.
  // Tambah atau kurangi sebanyak yang kamu mau.
  openingLines: [
    "Berhenti sebentar ya…",
    "tarik napas pelan.",
    "Aku nyiapin sesuatu buat kamu.",
    "Siap? Ketuk sekali lagi. ♡",
  ],

  // Tulisan kecil di bawah baris pembuka (petunjuk halus buat ngetuk).
  tapHint: "ketuk untuk lanjut",

  // Tombol terakhir yang memicu bunga mekar.
  openLabel: "buka kejutannya",

  // Muncul SETELAH bunga mekar.
  finalMessage: "Buat kamu. 🌷",
  finalSub: "Sekuntum kecil, biar hari ini sedikit lebih cerah.",

  // Tombol ulang & kembali (biar bisa diputar lagi).
  replayLabel: "putar lagi",
  backLabel: "kembali",
} as const;
