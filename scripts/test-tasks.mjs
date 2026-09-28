/**
 * Integration test buat Little Things (migration 0015) — lawan DB beneran.
 *   node --env-file=.env.local scripts/test-tasks.mjs
 *
 * Login-nya lewat sesi yang dibikin service role, jadi nggak butuh SEED_*_PASSWORD.
 *
 * Menguji: tabel ada, RLS (dua-duanya boleh nulis tugas buat yang lain, tapi
 * cuma boleh nyentang kotaknya sendiri), penyelesaian solo vs berdua, dan
 * klaim reminder yang anti-kirim-dobel. Semua baris test dipakein tanggal 2099
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

const D = "2099-12-30";
const TAG = "[test-tasks]";

info("0. Tabel dari migration 0015");
const { error: missing } = await admin.from("tasks").select("id").limit(1);
if (missing) {
  bad(`tabel tasks belum ada — jalanin dulu supabase/migrations/0015_little_things.sql di SQL editor. (${missing.message})`);
  process.exit(1);
}
ok("tasks / task_completions / task_reminders siap.");

const { data: members } = await admin.from("space_members").select("user_id, space_id, role");
const author = members?.find((m) => m.role === "author");
const keeper = members?.find((m) => m.role === "keeper");
if (!author || !keeper) {
  bad("space belum punya dua anggota.");
  process.exit(1);
}
const spaceId = author.space_id;

/**
 * Klien yang beneran login sebagai satu anggota, jadi RLS-nya kena beneran.
 * Sesinya dibikin lewat service role (magic link yang langsung ditukar), bukan
 * password — jadi test ini nggak ikut rusak kalau password akun diganti, dan
 * nggak ada email yang dikirim.
 */
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

// Bersihin sisa test sebelumnya.
await admin.from("tasks").delete().eq("space_id", spaceId).like("title", `${TAG}%`);

info("1. Author nulis satu hal kecil BUAT keeper");
const { data: forHer, error: e1 } = await asAuthor
  .from("tasks")
  .insert({
    space_id: spaceId,
    created_by: author.user_id,
    assigned_to: keeper.user_id,
    title: `${TAG} beli charger putih`,
    note: "The white one!",
    emoji: "🛍️",
    due_date: D,
    notify_whatsapp: false,
  })
  .select("id")
  .single();
if (e1 || !forHer) bad(`gagal bikin: ${e1?.message}`);
else ok("kebikin, assigned_to = keeper.");

info("2. Keeper bisa lihat tugas itu");
const { data: seen } = await asKeeper.from("tasks").select("id, title").eq("id", forHer.id).maybeSingle();
if (seen) ok(`kebaca keeper: "${seen.title}"`);
else bad("keeper nggak bisa baca tugas dari pasangannya (RLS kelewat ketat).");

info("3. Keeper nyentang kotaknya SENDIRI → boleh");
const { error: e3 } = await asKeeper
  .from("task_completions")
  .insert({ task_id: forHer.id, user_id: keeper.user_id });
if (e3) bad(`harusnya boleh: ${e3.message}`);
else ok("tercentang.");

info("4. Keeper nyentang kotak ORANG LAIN → harus ditolak");
const { error: e4 } = await asKeeper
  .from("task_completions")
  .insert({ task_id: forHer.id, user_id: author.user_id });
if (e4) ok(`ditolak RLS (${e4.code}).`);
else bad("BAHAYA: keeper bisa nyentang kotak author.");

info("5. Tugas berdua baru kelar kalau dua-duanya nyentang");
const { data: shared } = await asKeeper
  .from("tasks")
  .insert({
    space_id: spaceId,
    created_by: keeper.user_id,
    assigned_to: null,
    title: `${TAG} upload foto ke album`,
    due_date: D,
  })
  .select("id")
  .single();
await asKeeper.from("task_completions").insert({ task_id: shared.id, user_id: keeper.user_id });
let { data: done } = await admin.from("task_completions").select("user_id").eq("task_id", shared.id);
if (done.length === 1) ok("baru satu yang nyentang → belum kelar.");
else bad(`harusnya 1 centang, dapat ${done.length}`);
await asAuthor.from("task_completions").insert({ task_id: shared.id, user_id: author.user_id });
({ data: done } = await admin.from("task_completions").select("user_id").eq("task_id", shared.id));
if (done.length === 2) ok("dua-duanya nyentang → kelar.");
else bad(`harusnya 2 centang, dapat ${done.length}`);

info("6. Reminder: klaim cuma bisa sekali (anti kirim dobel)");
const { data: reminder, error: e6 } = await asAuthor
  .from("task_reminders")
  .insert({
    task_id: forHer.id,
    space_id: spaceId,
    remind_at: "2099-12-29T12:00:00Z",
    offset_days: 1,
    remind_time: "19:00",
  })
  .select("id")
  .single();
if (e6) bad(`gagal bikin reminder: ${e6.message}`);
else ok("reminder kebikin.");

const claimOne = await admin
  .from("task_reminders")
  .update({ sent_at: new Date().toISOString() })
  .eq("id", reminder.id)
  .is("sent_at", null)
  .select("id");
const claimTwo = await admin
  .from("task_reminders")
  .update({ sent_at: new Date().toISOString() })
  .eq("id", reminder.id)
  .is("sent_at", null)
  .select("id");
if (claimOne.data?.length === 1 && claimTwo.data?.length === 0) {
  ok("klaim pertama menang, klaim kedua kosong → nggak bakal kekirim dua kali.");
} else {
  bad(`klaim aneh: ${claimOne.data?.length} lalu ${claimTwo.data?.length}`);
}

info("7. Hapus tugas → reminder-nya ikut kehapus (cascade)");
await asAuthor.from("tasks").delete().eq("id", forHer.id);
const { data: orphan } = await admin.from("task_reminders").select("id").eq("id", reminder.id);
if (!orphan || orphan.length === 0) ok("reminder ikut hilang.");
else bad("reminder masih nyangkut setelah tugasnya dihapus.");

info("8. Beres-beres");
await admin.from("tasks").delete().eq("space_id", spaceId).like("title", `${TAG}%`);
const { data: left } = await admin.from("tasks").select("id").like("title", `${TAG}%`);
if (!left || left.length === 0) ok("semua baris test kehapus.");
else bad(`masih ada ${left.length} baris test.`);

console.log(
  process.exitCode ? "\n\x1b[31mAda yang gagal.\x1b[0m" : "\n\x1b[32mSemua lolos ♡\x1b[0m",
);
