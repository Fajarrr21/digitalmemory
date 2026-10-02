/**
 * Integration test buat Sejauh Ini, Kita (migration 0017) — lawan DB beneran.
 *   node --env-file=.env.local scripts/test-journey.mjs
 *
 * Login-nya lewat sesi yang dibikin service role, jadi nggak butuh SEED_*_PASSWORD.
 *
 * Menguji: tabel ada, RLS Presence Notes (dua-duanya baca, nulis cuma ATAS NAMA
 * SENDIRI, hapus cuma punya sendiri), dan Things I Know About You (cuma boleh
 * nulis TENTANG partner, bukan tentang diri sendiri). Semua baris test ditandai
 * dan dihapus lagi di akhir, jadi aman dijalanin berkali-kali.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => {
  console.log(`  \x1b[31m✗ ${m}\x1b[0m`);
  process.exitCode = 1;
};
const info = (m) => console.log(`\n\x1b[36m${m}\x1b[0m`);

const TAG = "[test-journey]";

info("0. Tabel dari migration 0017");
for (const table of ["journey_notes", "journey_knowings"]) {
  const { error } = await admin.from(table).select("id").limit(1);
  if (error) {
    bad(
      `tabel ${table} belum ada — jalanin dulu supabase/migrations/0017_sejauh_ini_kita.sql di SQL editor. (${error.message})`,
    );
    process.exit(1);
  }
}
ok("journey_notes / journey_knowings siap.");

const { data: members } = await admin.from("space_members").select("user_id, space_id, role");
const author = members?.find((m) => m.role === "author");
const keeper = members?.find((m) => m.role === "keeper");
if (!author || !keeper) {
  bad("space belum punya dua anggota.");
  process.exit(1);
}
const spaceId = author.space_id;

async function signInAs(userId) {
  const { data: profile } = await admin.auth.admin.getUserById(userId);
  const email = profile?.user?.email;
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError) {
    bad(`gagal bikin sesi buat ${email}: ${linkError.message}`);
    process.exit(1);
  }
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await client.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (error) {
    bad(`gagal login ${email}: ${error.message}`);
    process.exit(1);
  }
  return client;
}

const asAuthor = await signInAs(author.user_id);
const asKeeper = await signInAs(keeper.user_id);

async function cleanup() {
  await admin.from("journey_notes").delete().eq("space_id", spaceId).like("body", `${TAG}%`);
  await admin.from("journey_knowings").delete().eq("space_id", spaceId).like("body", `${TAG}%`);
}
await cleanup();

info("1. Presence Note — author meninggalkan jejak di bab 'hard'");
const { data: note, error: e1 } = await asAuthor
  .from("journey_notes")
  .insert({ space_id: spaceId, author_id: author.user_id, stop: "hard", body: `${TAG} capek, tapi nggak pergi` })
  .select("id")
  .single();
e1 ? bad(`author gagal nulis: ${e1.message}`) : ok("author bisa meninggalkan jejak.");

const { data: seen } = await asKeeper.from("journey_notes").select("id, body").eq("id", note?.id ?? "");
seen?.length === 1 ? ok("keeper menemukannya waktu sampai di titik itu.") : bad("keeper nggak bisa baca jejak author.");

const { error: e2 } = await asKeeper
  .from("journey_notes")
  .insert({ space_id: spaceId, author_id: author.user_id, stop: "hard", body: `${TAG} pura-pura jadi author` });
e2 ? ok("keeper TIDAK bisa nulis atas nama author.") : bad("keeper bisa nulis atas nama author!");

const { error: e3 } = await asAuthor
  .from("journey_notes")
  .insert({ space_id: spaceId, author_id: author.user_id, stop: "nowhere", body: `${TAG} titik ngaco` });
e3 ? ok("stop di luar daftar ditolak.") : bad("stop ngaco diterima!");

await asKeeper.from("journey_notes").delete().eq("id", note?.id ?? "");
const { data: still } = await admin.from("journey_notes").select("id").eq("id", note?.id ?? "");
still?.length === 1 ? ok("keeper TIDAK bisa menghapus jejak author.") : bad("keeper bisa menghapus jejak author!");

const { error: e4 } = await asAuthor.from("journey_notes").delete().eq("id", note?.id ?? "");
const { data: gone } = await admin.from("journey_notes").select("id").eq("id", note?.id ?? "");
!e4 && gone?.length === 0 ? ok("author bisa menghapus jejaknya sendiri.") : bad("author gagal menghapus jejaknya.");

info("2. Things I Know About You");
const { data: k, error: e5 } = await asKeeper
  .from("journey_knowings")
  .insert({
    space_id: spaceId,
    author_id: keeper.user_id,
    about_id: author.user_id,
    emoji: "☕",
    label: "comfort",
    body: `${TAG} kopi susu, bukan yang pahit`,
  })
  .select("id")
  .single();
e5 ? bad(`keeper gagal nulis tentang author: ${e5.message}`) : ok("keeper bisa nulis tentang author.");

const { data: kRead } = await asAuthor.from("journey_knowings").select("id").eq("id", k?.id ?? "");
kRead?.length === 1 ? ok("author bisa membaca apa yang keeper tahu tentangnya.") : bad("author nggak bisa baca.");

const { error: e6 } = await asAuthor.from("journey_knowings").insert({
  space_id: spaceId,
  author_id: author.user_id,
  about_id: author.user_id,
  emoji: "♡",
  label: "likes",
  body: `${TAG} tentang diri sendiri`,
});
e6 ? ok("nggak bisa nulis tentang diri sendiri.") : bad("bisa nulis tentang diri sendiri!");

const { error: e7 } = await asAuthor.from("journey_knowings").insert({
  space_id: spaceId,
  author_id: keeper.user_id,
  about_id: author.user_id,
  emoji: "♡",
  label: "likes",
  body: `${TAG} atas nama keeper`,
});
e7 ? ok("author TIDAK bisa nulis atas nama keeper.") : bad("author bisa nulis atas nama keeper!");

const { data: upd } = await asAuthor
  .from("journey_knowings")
  .update({ body: `${TAG} diubah author` })
  .eq("id", k?.id ?? "")
  .select("id");
(upd?.length ?? 0) === 0 ? ok("author TIDAK bisa mengubah tulisan keeper.") : bad("author bisa mengubah tulisan keeper!");

await cleanup();
info(process.exitCode ? "Ada yang gagal. ✗" : "Semua lolos. ♡");
