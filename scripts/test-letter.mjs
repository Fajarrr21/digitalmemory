/**
 * Integration test buat resolver Daily Letter — lawan DB beneran (service role).
 *   node --env-file=.env.local scripts/test-letter.mjs
 * Menguji: get-or-create hari ini, lalu race (5 insert paralel = tetap 1 surat).
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

function localDateISO(tz) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts; // en-CA gives YYYY-MM-DD
}

// --- setup: find space + keeper ---
const { data: keeperMember } = await admin
  .from("space_members")
  .select("user_id, space_id")
  .eq("role", "keeper")
  .maybeSingle();
if (!keeperMember) {
  bad("keeper belum ada di space_members.");
  process.exit(1);
}
const { data: keeperProfile } = await admin
  .from("profiles")
  .select("timezone")
  .eq("id", keeperMember.user_id)
  .single();

const spaceId = keeperMember.space_id;
const keeperId = keeperMember.user_id;
const tz = keeperProfile?.timezone ?? "Asia/Jakarta";
const today = localDateISO(tz);

info(`1. Get-or-create surat hari ini (tz ${tz} → ${today})`);
async function resolve(date) {
  const { data: existing } = await admin
    .from("daily_letters")
    .select("*")
    .eq("recipient_id", keeperId)
    .eq("letter_date", date)
    .maybeSingle();
  if (existing) return { letter: existing, created: false };

  const { data: pick } = await admin
    .from("letter_pool")
    .select("*")
    .eq("space_id", spaceId)
    .is("used_on", null)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const { data: inserted, error } = await admin
    .from("daily_letters")
    .insert({
      space_id: spaceId,
      recipient_id: keeperId,
      letter_date: date,
      pool_id: pick?.id ?? null,
      category: pick?.category ?? "random_love",
      body: pick?.body ?? "fallback",
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: raced } = await admin
        .from("daily_letters")
        .select("*")
        .eq("recipient_id", keeperId)
        .eq("letter_date", date)
        .single();
      return { letter: raced, created: false, raced: true };
    }
    throw error;
  }
  if (pick?.id) await admin.from("letter_pool").update({ used_on: date }).eq("id", pick.id);
  return { letter: inserted, created: true };
}

const first = await resolve(today);
ok(`surat hari ini: "${first.letter.body.slice(0, 40)}…" (${first.created ? "baru dibuat" : "sudah ada"})`);
const second = await resolve(today);
if (second.letter.id === first.letter.id) ok("buka lagi di hari yang sama → surat yang SAMA (tidak bikin baru).");
else bad("buka lagi malah bikin surat berbeda!");

info("2. Race test (5 insert paralel untuk 1 tanggal)");
const raceDate = "2099-12-31";
await admin.from("daily_letters").delete().eq("recipient_id", keeperId).eq("letter_date", raceDate);
const attempts = await Promise.allSettled(
  Array.from({ length: 5 }, () =>
    admin
      .from("daily_letters")
      .insert({
        space_id: spaceId,
        recipient_id: keeperId,
        letter_date: raceDate,
        category: "romantic",
        body: "race",
      })
      .select()
      .single(),
  ),
);
const succeeded = attempts.filter((a) => a.status === "fulfilled" && !a.value.error).length;
const conflicts = attempts.filter(
  (a) => a.status === "fulfilled" && a.value.error?.code === "23505",
).length;
const { count } = await admin
  .from("daily_letters")
  .select("*", { count: "exact", head: true })
  .eq("recipient_id", keeperId)
  .eq("letter_date", raceDate);

if (count === 1) ok(`5 insert paralel → tepat 1 surat di DB (${succeeded} sukses, ${conflicts} ditolak unique).`);
else bad(`harusnya 1 surat, tapi ada ${count}.`);

// cleanup
await admin.from("daily_letters").delete().eq("recipient_id", keeperId).eq("letter_date", raceDate);
ok("baris race test dibersihkan.");

console.log(
  process.exitCode === 1
    ? "\n\x1b[31mAda test yang gagal.\x1b[0m\n"
    : "\n\x1b[32mResolver Daily Letter lulus semua. ♡\x1b[0m\n",
);
