/**
 * Phase 6 tests: night_reflections (upsert 1/hari) + special_messages RLS.
 *   node --env-file=.env.local scripts/test-phase6.mjs
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => {
  console.log(`  \x1b[31m✗ ${m}\x1b[0m`);
  process.exitCode = 1;
};
const info = (m) => console.log(`\n\x1b[36m${m}\x1b[0m`);

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

async function signed(email, password) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

// ---- Night reflection ----
const { data: keeperM } = await admin
  .from("space_members")
  .select("user_id, space_id")
  .eq("role", "keeper")
  .maybeSingle();
const spaceId = keeperM.space_id;
const keeperId = keeperM.user_id;
const D = "2099-12-28";

info("1. Night reflection — upsert 1 per hari");
await admin.from("night_reflections").delete().eq("user_id", keeperId).eq("reflection_date", D);
await admin.from("night_reflections").upsert(
  { space_id: spaceId, user_id: keeperId, reflection_date: D, q_grateful: "kamu" },
  { onConflict: "user_id,reflection_date" },
);
await admin.from("night_reflections").upsert(
  { space_id: spaceId, user_id: keeperId, reflection_date: D, q_grateful: "kamu & kopi" },
  { onConflict: "user_id,reflection_date" },
);
const { data: refl } = await admin
  .from("night_reflections")
  .select("q_grateful")
  .eq("user_id", keeperId)
  .eq("reflection_date", D);
if (refl?.length === 1 && refl[0].q_grateful === "kamu & kopi") ok("1 baris, ter-update (bukan duplikat).");
else bad(`harusnya 1 baris ter-update, dapat ${JSON.stringify(refl)}`);
await admin.from("night_reflections").delete().eq("user_id", keeperId).eq("reflection_date", D);

// ---- For You RLS ----
info("2. For You (special_messages) — RLS");
const author = await signed("fajarardiansyah912@gmail.com", "Testing#2007");
const keeper = await signed("emaildia@contoh.com", "Testing#2007");
const authorId = (await author.auth.getUser()).data.user.id;

let msgId;
{
  const { data, error } = await author
    .from("special_messages")
    .insert({ space_id: spaceId, recipient_id: keeperId, author_id: authorId, title: "test", body: "halo", unlock_type: "always" })
    .select("id")
    .single();
  if (error) bad(`author gagal kirim: ${error.message}`);
  else {
    msgId = data.id;
    ok("author bisa menitipkan pesan.");
  }
}
{
  const { error } = await keeper
    .from("special_messages")
    .insert({ space_id: spaceId, recipient_id: keeperId, author_id: keeperId, title: "x", body: "y" })
    .select("id")
    .single();
  if (error) ok(`keeper ditolak menulis pesan (${error.code ?? "denied"}).`);
  else bad("keeper malah bisa menulis pesan!");
}
{
  const { error } = await keeper.from("special_messages").update({ opened_at: new Date().toISOString() }).eq("id", msgId);
  if (error) bad(`keeper gagal menandai dibuka: ${error.message}`);
  else ok("keeper (penerima) bisa menandai pesan dibuka.");
}
if (msgId) {
  await author.from("special_messages").delete().eq("id", msgId);
  ok("pesan test dihapus author.");
}

console.log(
  process.exitCode === 1
    ? "\n\x1b[31mAda test gagal.\x1b[0m\n"
    : "\n\x1b[32mPhase 6 lulus (reflection + For You RLS). ♡\x1b[0m\n",
);
