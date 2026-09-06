/** Comfort Room content — warm, non-clinical. Just somewhere to land. */

export type Feeling = {
  key: string;
  label: string;
  response: string;
  suggest?: { label: string; href: string };
};

export const FEELINGS: Feeling[] = [
  {
    key: "sad",
    label: "Sedih",
    response:
      "Sini dulu. Kamu nggak harus kuat terus. Boleh sedih, boleh diam sebentar. Aku temenin dari sini. ♡",
    suggest: { label: "Baca pesan untukmu", href: "/for-you" },
  },
  {
    key: "tired",
    label: "Capek",
    response:
      "Kamu udah lari jauh hari ini. Sekarang boleh berhenti dulu. Istirahat itu bukan menyerah. ♡",
    suggest: { label: "Tulis refleksi malam", href: "/reflect" },
  },
  {
    key: "angry",
    label: "Kesal",
    response:
      "Nggak apa-apa marah — perasaanmu valid. Tarik napas pelan… lepasin pelan-pelan. Aku dengerin. ♡",
  },
  {
    key: "overthinking",
    label: "Overthinking",
    response:
      "Pikiranmu lagi rame ya. Nggak semua harus dijawab sekarang. Satu-satu aja. Kamu aman. ♡",
    suggest: { label: "Tulis refleksi malam", href: "/reflect" },
  },
  {
    key: "cry",
    label: "Pengen nangis",
    response:
      "Kalau mau nangis, nangis aja. Itu bukan tanda lemah — itu cara hati istirahat. Aku di sini. ♡",
    suggest: { label: "Baca surat hari ini", href: "/letter" },
  },
  {
    key: "comfort",
    label: "Butuh dipeluk",
    response: "Anggap ini pelukan dari jauh. Kamu berharga — hari ini, dan selalu. ♡",
    suggest: { label: "Baca pesan untukmu", href: "/for-you" },
  },
  {
    key: "happy",
    label: "Lagi seneng",
    response:
      "Yeay! Seneng banget lihat kamu seneng. Simpan momen ini ya — kamu pantas bahagia. ♡",
    suggest: { label: "Simpan momen ini", href: "/today" },
  },
];
