import { getSpaceContext } from "@/lib/auth";
import { Enough } from "./enough";

// 🩷 You're Not Too Much — sebuah personal reassurance experience. Full-screen;
// sengaja TIDAK ada di nav — ditemukan dengan membuka /enough langsung, sebuah
// ruang kecil untuk kembali ketika kamu merasa "terlalu banyak".
export default async function EnoughPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null; // layout menangani state pre-setup / belum sign-in

  return <Enough />;
}
