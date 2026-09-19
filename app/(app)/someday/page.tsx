import { getSpaceContext } from "@/lib/auth";
import { Someday } from "./someday";

// ✨ Someday, With You — sebuah perjalanan pelan tentang kenangan yang belum
// terjadi. Full-screen; sengaja TIDAK ada di nav — ditemukan dengan membuka
// /someday langsung, seperti menemukan surat yang bisa dibuka halaman demi halaman.
export default async function SomedayPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null; // layout menangani state pre-setup / belum sign-in

  return <Someday />;
}
