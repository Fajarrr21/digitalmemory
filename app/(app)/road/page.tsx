import { getSpaceContext } from "@/lib/auth";
import { Road } from "./road";

// 🛤️ The Road That Made Me — sebuah perjalanan malam→pagi dalam tiga babak
// (Sesi Potret · Bunga Terakhir · Kita Usahakan Rumah Itu) tentang hal-hal yang
// hilang, yang dilepaskan, dan jalan yang masih terbuka. Full-screen; sengaja
// TIDAK ada di nav — ditemukan dengan membuka /road langsung.
export default async function RoadPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null; // layout menangani state pre-setup / belum sign-in

  return <Road />;
}
