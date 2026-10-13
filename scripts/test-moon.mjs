/**
 * Integration test buat her little moon. (migration 0021) — lawan DB beneran.
 *   node --env-file=.env.local scripts/test-moon.mjs
 *
 * DATA SINTETIS SAJA: semua tanggal di tahun 2020, supaya nggak pernah
 * bertabrakan dengan catatan asli, dan semuanya dihapus lagi di akhir.
 * Pengaturan berbagi yang asli disimpan dulu lalu dikembalikan.
 *
 * Menguji: catatan siklus/check-in/pengingat/pengaturan benar-benar owner-only
 * (pasangan dapat 0 baris lewat API langsung, nggak bisa menulis atas nama
 * dia), tanggal tumpang tindih ditolak DB, moon_partner_view cuma memberi
 * yang diizinkan & langsung berhenti saat izin dicabut, dan alur permintaan
 * perhatian (kirim → dia lihat → "I'm on it" → selesai / ditarik).
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => {
  console.log(`  \x1b[31m✗ ${m}\x1b[0m`);
  process.exitCode = 1;
};
const info = (m) => console.log(`\n\x1b[36m${m}\x1b[0m`);
const expect = (cond, yes, no) => (cond ? ok(yes) : bad(no));

info("0. Tabel dari migration 0021");
for (const t of ["moon_periods", "moon_checkins", "moon_share", "moon_reminders", "moon_care_requests"]) {
  const { error } = await admin.from(t).select("*").limit(1);
  if (error) {
    bad(`tabel ${t} belum ada — jalanin dulu supabase/migrations/0021_her_little_moon.sql. (${error.message})`);
    process.exit(1);
  }
}
ok("semua tabel siap.");

const { data: members } = await admin.from("space_members").select("user_id, space_id, role");
const her = members?.find((m) => m.role === "keeper");
const him = members?.find((m) => m.role === "author");
if (!her || !him) {
  bad("space belum punya dua anggota.");
  process.exit(1);
}
const spaceId = her.space_id;

async function signInAs(userId) {
  const { data: profile } = await admin.auth.admin.getUserById(userId);
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: profile.user.email });
  if (linkError) throw new Error(linkError.message);
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (error) throw new Error(error.message);
  return client;
}
const asHer = await signInAs(her.user_id);
const asHim = await signInAs(him.user_id);

const { data: realShare } = await admin.from("moon_share").select("*").eq("user_id", her.user_id).maybeSingle();
const periodIds = [];
const careIds = [];
const reminderIds = [];
const checkinDays = [];

try {
  info("1. Siklus — owner-only");
  const { data: p1, error: e1 } = await asHer
    .from("moon_periods")
    .insert({ user_id: her.user_id, space_id: spaceId, start_date: "2020-01-01", end_date: "2020-01-05" })
    .select("id")
    .single();
  if (e1) throw new Error(`gagal mencatat: ${e1.message}`);
  periodIds.push(p1.id);
  ok("dia mencatat menstruasi.");
  const { data: hisRead } = await asHim.from("moon_periods").select("*").eq("user_id", her.user_id);
  expect((hisRead ?? []).length === 0, "pasangan dapat 0 baris lewat API langsung.", `BOCOR: ${hisRead?.length} baris`);
  const { error: eAs } = await asHim.from("moon_periods").insert({ user_id: her.user_id, space_id: spaceId, start_date: "2020-02-01", end_date: "2020-02-03" });
  expect(!!eAs, "pasangan nggak bisa menulis atas nama dia.", "pasangan bisa menulis!");
  await asHim.from("moon_periods").update({ end_date: "2020-01-02" }).eq("id", p1.id);
  await asHim.from("moon_periods").delete().eq("id", p1.id);
  const { data: still } = await admin.from("moon_periods").select("end_date").eq("id", p1.id).single();
  expect(still?.end_date === "2020-01-05", "pasangan nggak bisa mengubah / menghapus.", "pasangan bisa mengubah!");

  info("2. Validasi tanggal di DB");
  const { error: eOverlap } = await asHer.from("moon_periods").insert({ user_id: her.user_id, space_id: spaceId, start_date: "2020-01-04", end_date: "2020-01-07" });
  expect(eOverlap?.message?.includes("moon_overlap"), "tanggal tumpang tindih ditolak.", `diterima? ${eOverlap?.message}`);
  const { error: eOrder } = await asHer.from("moon_periods").insert({ user_id: her.user_id, space_id: spaceId, start_date: "2020-03-05", end_date: "2020-03-01" });
  expect(!!eOrder, "selesai sebelum mulai ditolak.", "diterima!");
  const { error: eLong } = await asHer.from("moon_periods").insert({ user_id: her.user_id, space_id: spaceId, start_date: "2020-04-01", end_date: "2020-04-28" });
  expect(!!eLong, "periode kepanjangan ditolak.", "diterima!");
  const { data: p2, error: e2 } = await asHer
    .from("moon_periods")
    .insert({ user_id: her.user_id, space_id: spaceId, start_date: "2020-01-30", end_date: "2020-02-03" })
    .select("id")
    .single();
  expect(!e2, "siklus berikutnya (tanpa tumpang tindih) diterima.", `gagal: ${e2?.message}`);
  if (p2) periodIds.push(p2.id);

  info("3. Check-in — owner-only");
  const { error: eC } = await asHer.from("moon_checkins").insert({ user_id: her.user_id, space_id: spaceId, day: "2020-01-02", cramps: 2, fatigue: true, note: "[test-moon] sintetis" });
  expect(!eC, "dia menyimpan check-in.", `gagal: ${eC?.message}`);
  checkinDays.push("2020-01-02");
  const { error: eEmpty } = await asHer.from("moon_checkins").insert({ user_id: her.user_id, space_id: spaceId, day: "2020-01-03" });
  expect(!!eEmpty, "check-in kosong ditolak.", "check-in kosong diterima!");
  const { data: hisCheck } = await asHim.from("moon_checkins").select("*").eq("user_id", her.user_id);
  expect((hisCheck ?? []).length === 0, "pasangan nggak bisa membaca check-in.", "BOCOR check-in!");

  info("4. Berbagi — diputuskan langsung, bisa dicabut");
  await asHer.from("moon_share").upsert({ user_id: her.user_id, space_id: spaceId, share_phase: false, share_symptoms: false, partner_heads_up: false }, { onConflict: "user_id" });
  const { data: v0 } = await asHim.rpc("moon_partner_view", { p_space: spaceId });
  expect(v0 === null, "tanpa izin: pasangan dapat null (tidak ada petunjuk).", `dapat: ${JSON.stringify(v0)}`);
  const { data: hisShareRow } = await asHim.from("moon_share").select("*").eq("user_id", her.user_id);
  expect((hisShareRow ?? []).length === 0, "pasangan nggak bisa membaca pengaturan berbaginya.", "pengaturan bocor!");
  await asHer.from("moon_share").update({ share_phase: true }).eq("user_id", her.user_id);
  const { data: v1 } = await asHim.rpc("moon_partner_view", { p_space: spaceId });
  expect(Array.isArray(v1?.periods) && !("symptoms" in (v1 ?? {})), "share_phase: hanya tanggal siklus, tanpa gejala.", JSON.stringify(v1));
  await asHer.from("moon_share").update({ share_phase: false, share_symptoms: true }).eq("user_id", her.user_id);
  const { data: v2 } = await asHim.rpc("moon_partner_view", { p_space: spaceId });
  const leaks = JSON.stringify(v2 ?? {});
  expect(!("periods" in (v2 ?? {})) && !/note|mood|flow|energy|sintetis/.test(leaks), "share_symptoms: tidak ada tanggal, catatan, mood, atau perdarahan.", leaks);
  await asHer.from("moon_share").update({ share_symptoms: false }).eq("user_id", her.user_id);
  const { data: v3 } = await asHim.rpc("moon_partner_view", { p_space: spaceId });
  expect(v3 === null, "izin dicabut → akses langsung berhenti.", `masih dapat: ${JSON.stringify(v3)}`);

  info("5. Permintaan perhatian");
  const { data: c1, error: eCare } = await asHer
    .from("moon_care_requests")
    .insert({ space_id: spaceId, user_id: her.user_id, recipient_id: him.user_id, need: "company", message: "[test-moon] temani ya" })
    .select("id")
    .single();
  if (eCare) throw new Error(`gagal mengirim: ${eCare.message}`);
  careIds.push(c1.id);
  const { data: hisCare } = await asHim.from("moon_care_requests").select("need, message").eq("id", c1.id).single();
  expect(hisCare?.need === "company", "dia mengirim → pasangan bisa melihatnya.", "pasangan nggak melihat.");
  const { error: eFake } = await asHim.from("moon_care_requests").insert({ space_id: spaceId, user_id: her.user_id, recipient_id: him.user_id, need: "cheer" });
  expect(!!eFake, "pasangan nggak bisa membuat permintaan atas nama dia.", "bisa memalsukan!");
  await asHim.rpc("moon_care_ack", { p_request: c1.id });
  await asHim.from("moon_care_requests").delete().eq("id", c1.id);
  const { data: acked } = await admin.from("moon_care_requests").select("acked_at").eq("id", c1.id).single();
  expect(!!acked?.acked_at, "pasangan menandai “I'm on it”, tapi nggak bisa menghapus.", "gagal / terhapus.");
  await asHer.rpc("moon_care_close", { p_request: c1.id });
  const { data: closed } = await admin.from("moon_care_requests").select("closed_at").eq("id", c1.id).single();
  expect(!!closed?.closed_at, "dia menandai sudah cukup.", "gagal menutup.");
  await asHer.from("moon_care_requests").delete().eq("id", c1.id);
  const { data: gone } = await admin.from("moon_care_requests").select("id").eq("id", c1.id);
  expect((gone ?? []).length === 0, "dia bisa menarik kembali sepenuhnya.", "gagal menarik.");

  info("6. Pengingat — owner-only");
  const { data: r1, error: eR } = await asHer
    .from("moon_reminders")
    .insert({ user_id: her.user_id, space_id: spaceId, kind: "custom", label: "[test-moon]", at_time: "20:00", enabled: false })
    .select("id")
    .single();
  expect(!eR, "dia membuat pengingat.", `gagal: ${eR?.message}`);
  if (r1) reminderIds.push(r1.id);
  const { data: hisRem } = await asHim.from("moon_reminders").select("*").eq("user_id", her.user_id);
  expect((hisRem ?? []).length === 0, "pasangan nggak bisa melihat pengingatnya.", "pengingat bocor!");
} catch (err) {
  bad(String(err?.message ?? err));
} finally {
  if (periodIds.length) await admin.from("moon_periods").delete().in("id", periodIds);
  if (checkinDays.length) await admin.from("moon_checkins").delete().eq("user_id", her.user_id).in("day", checkinDays);
  if (careIds.length) await admin.from("moon_care_requests").delete().in("id", careIds);
  if (reminderIds.length) await admin.from("moon_reminders").delete().in("id", reminderIds);
  if (realShare) await admin.from("moon_share").upsert(realShare, { onConflict: "user_id" });
  else await admin.from("moon_share").delete().eq("user_id", her.user_id);
  console.log("\n  (data sintetis dibersihkan, pengaturan berbagi dikembalikan)");
  process.exit();
}
