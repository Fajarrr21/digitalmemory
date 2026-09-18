import { getSpaceContext } from "@/lib/auth";
import { Soundtrack } from "./soundtrack";

// 🎧 Our Soundtrack — perjalanan 24 lagu, tiap lagu membawa sedikit pesan dari
// kamu. Full-screen; ada di nav supaya dia bisa masuk & mendengarkan kapan saja.
export default async function SoundtrackPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null; // layout menangani state pre-setup / belum sign-in

  return <Soundtrack />;
}
