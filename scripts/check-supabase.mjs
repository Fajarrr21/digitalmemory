/**
 * Pemeriksa koneksi Supabase — jalankan setelah setup selesai:
 *
 *   node --env-file=.env.local scripts/check-supabase.mjs
 *
 * Dia ngecek: env kebaca, DB nyambung, tabel utama ada, dan space + 2 anggota
 * sudah dibuat. Aman dijalankan berkali-kali (read-only).
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const info = (m) => console.log(`\n\x1b[36m${m}\x1b[0m`);

let failed = false;
const fail = (m) => {
  bad(m);
  failed = true;
};

info("1. Environment (.env.local)");
if (!url || url.includes("placeholder")) fail("NEXT_PUBLIC_SUPABASE_URL belum diisi (masih placeholder).");
else ok(`URL: ${url}`);
if (!anon || anon.includes("placeholder")) fail("NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi.");
else ok("anon key terisi.");
if (!service || service.includes("placeholder")) fail("SUPABASE_SERVICE_ROLE_KEY belum diisi.");
else ok("service_role key terisi.");

if (failed) {
  console.log("\n\x1b[33mIsi dulu 3 kunci di .env.local, lalu jalankan lagi.\x1b[0m\n");
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

info("2. Koneksi & tabel");
const TABLES = ["profiles", "spaces", "space_members", "letter_pool", "daily_letters", "daily_ratings", "daily_activities", "media"];
for (const t of TABLES) {
  // A real (non-head) select so a missing table surfaces as an error.
  const { error } = await admin.from(t).select("*").limit(1);
  if (error) fail(`tabel "${t}" belum ada — ${error.message}`);
  else ok(`tabel "${t}" ada.`);
}

info("3. Space & anggota (setup_space.sql)");
const { data: spaces, error: spErr } = await admin.from("spaces").select("id, name");
if (spErr) fail(`gagal baca spaces — ${spErr.message}`);
else if (!spaces || spaces.length === 0) fail("belum ada space — jalankan supabase/setup_space.sql.");
else {
  ok(`space: "${spaces[0].name}" (${spaces.length} total).`);
  const { data: members } = await admin.from("space_members").select("role");
  const roles = (members ?? []).map((m) => m.role).sort().join(", ");
  if ((members?.length ?? 0) >= 2) ok(`anggota: ${members.length} (${roles}).`);
  else fail(`baru ${members?.length ?? 0} anggota — harusnya 2 (keeper + author).`);
  const { count } = await admin.from("letter_pool").select("*", { count: "exact", head: true });
  ok(`surat di pool: ${count ?? 0}.`);
}

console.log(
  failed
    ? "\n\x1b[31mMasih ada yang kurang di atas — perbaiki lalu jalankan lagi.\x1b[0m\n"
    : "\n\x1b[32mSemua beres! Supabase siap. Bilang ke Claude \"beres\" buat lanjut Phase 2. ♡\x1b[0m\n",
);
process.exit(failed ? 1 : 0);
