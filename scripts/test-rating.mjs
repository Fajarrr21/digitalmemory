/**
 * Integration test buat Daily Rating — lawan DB (service role).
 *   node --env-file=.env.local scripts/test-rating.mjs
 * Menguji: upsert 1-per-hari (update, bukan duplikat) + constraint score 1..10.
 */
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => {
  console.log(`  \x1b[31m✗ ${m}\x1b[0m`);
  process.exitCode = 1;
};
const info = (m) => console.log(`\n\x1b[36m${m}\x1b[0m`);

const { data: member } = await admin
  .from("space_members")
  .select("user_id, space_id")
  .eq("role", "keeper")
  .maybeSingle();
if (!member) {
  bad("keeper tidak ada.");
  process.exit(1);
}
const { space_id: spaceId, user_id: userId } = member;
const D = "2099-12-30";

// bersihin sisa test sebelumnya
await admin.from("daily_ratings").delete().eq("user_id", userId).eq("rating_date", D);

info("1. Upsert pertama (score 8)");
await admin.from("daily_ratings").upsert(
  { space_id: spaceId, user_id: userId, rating_date: D, score: 8, reason: "awal" },
  { onConflict: "user_id,rating_date" },
);
let { data: rows } = await admin.from("daily_ratings").select("score").eq("user_id", userId).eq("rating_date", D);
if (rows?.length === 1 && rows[0].score === 8) ok("tersimpan, score 8, 1 baris.");
else bad(`harusnya 1 baris score 8, dapat ${JSON.stringify(rows)}`);

info("2. Upsert lagi tanggal sama (score 5) → harus UPDATE, bukan duplikat");
await admin.from("daily_ratings").upsert(
  { space_id: spaceId, user_id: userId, rating_date: D, score: 5, reason: "berubah" },
  { onConflict: "user_id,rating_date" },
);
({ data: rows } = await admin.from("daily_ratings").select("score").eq("user_id", userId).eq("rating_date", D));
if (rows?.length === 1 && rows[0].score === 5) ok("tetap 1 baris, score jadi 5 (one-per-day terjaga).");
else bad(`harusnya 1 baris score 5, dapat ${JSON.stringify(rows)}`);

info("3. Score invalid (11) → harus DITOLAK constraint");
const { error } = await admin
  .from("daily_ratings")
  .upsert(
    { space_id: spaceId, user_id: userId, rating_date: D, score: 11 },
    { onConflict: "user_id,rating_date" },
  );
if (error) ok(`ditolak DB (${error.code}: ${error.message.slice(0, 40)}…).`);
else bad("score 11 malah keterima!");

// cleanup
await admin.from("daily_ratings").delete().eq("user_id", userId).eq("rating_date", D);
ok("baris test dibersihkan.");

console.log(
  process.exitCode === 1
    ? "\n\x1b[31mAda test gagal.\x1b[0m\n"
    : "\n\x1b[32mDaily Rating lulus semua. ♡\x1b[0m\n",
);
