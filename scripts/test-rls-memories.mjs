/**
 * RLS test buat our_memories — pakai sesi user asli (anon key), bukan service role.
 *   node --env-file=.env.local scripts/test-rls-memories.mjs
 * Membuktikan: author BISA nambah kenangan, keeper TIDAK (author-only), dua-duanya bisa baca.
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => {
  console.log(`  \x1b[31m✗ ${m}\x1b[0m`);
  process.exitCode = 1;
};
const info = (m) => console.log(`\n\x1b[36m${m}\x1b[0m`);

async function signedClient(email, password) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login ${email} gagal: ${error.message}`);
  return c;
}

const author = await signedClient("fajarardiansyah912@gmail.com", "Testing#2007");
const keeper = await signedClient("emaildia@contoh.com", "Testing#2007");

const { data: mem } = await author.from("space_members").select("space_id").limit(1).single();
const spaceId = mem.space_id;

let memoryId;
info("1. Author menambah kenangan → harus BISA");
{
  const { data, error } = await author
    .from("our_memories")
    .insert({ space_id: spaceId, created_by: (await author.auth.getUser()).data.user.id, title: "RLS test memory" })
    .select("id")
    .single();
  if (error) bad(`author gagal insert: ${error.message}`);
  else {
    memoryId = data.id;
    ok("author berhasil menambah kenangan.");
  }
}

info("2. Keeper menambah kenangan → harus DITOLAK (author-only)");
{
  const { error } = await keeper
    .from("our_memories")
    .insert({ space_id: spaceId, created_by: (await keeper.auth.getUser()).data.user.id, title: "keeper mencoba" })
    .select("id")
    .single();
  if (error) ok(`keeper ditolak RLS (${error.code ?? "denied"}).`);
  else bad("keeper malah bisa menambah kenangan — RLS bocor!");
}

info("3. Keeper membaca kenangan → harus BISA (anggota space)");
{
  const { data, error } = await keeper.from("our_memories").select("id, title").eq("space_id", spaceId);
  if (error) bad(`keeper gagal baca: ${error.message}`);
  else if ((data ?? []).some((m) => m.id === memoryId)) ok(`keeper bisa lihat kenangan author (${data.length} total).`);
  else bad("keeper tidak bisa lihat kenangan yang barusan dibuat.");
}

info("4. Bersih-bersih");
if (memoryId) {
  const { error } = await author.from("our_memories").delete().eq("id", memoryId);
  if (error) bad(`gagal hapus: ${error.message}`);
  else ok("kenangan test dihapus oleh author.");
}

console.log(
  process.exitCode === 1
    ? "\n\x1b[31mAda test gagal — cek RLS.\x1b[0m\n"
    : "\n\x1b[32mRLS our_memories lulus (author-only write, semua anggota read). ♡\x1b[0m\n",
);
