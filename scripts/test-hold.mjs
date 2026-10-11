/**
 * Integration test buat If I Could Hold Your Feelings (migration 0018) — lawan DB beneran.
 *   node --env-file=.env.local scripts/test-hold.mjs
 *
 * Login lewat sesi buatan service role (nggak butuh SEED_*_PASSWORD).
 *
 * Menguji: konteks/intensitas privat benar-benar nggak kebaca partner, klien
 * nggak bisa insert/update langsung (semua lewat fungsi), cuma penerima yang
 * bisa merespons, respons ganda + retry idempoten, transisi status (respond →
 * longer → respond lagi → close), sesi tertutup nggak bisa dibuka lagi, dua
 * sesi dari dua orang jalan bareng tanpa saling ganggu, "space" nggak bisa
 * dijawab "listening", scrub saat nggak disimpan, dan hapus cuma oleh pengirim.
 * Semua sesi test dihapus lagi di akhir.
 */
import { randomUUID } from "node:crypto";
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
const expect = (cond, yes, no) => (cond ? ok(yes) : bad(no));

info("0. Tabel + fungsi dari migration 0018");
for (const table of ["hold_sessions", "hold_private", "hold_replies"]) {
  const { error } = await admin.from(table).select("*").limit(1);
  if (error) {
    bad(`tabel ${table} belum ada — jalanin dulu supabase/migrations/0018_hold.sql di SQL editor. (${error.message})`);
    process.exit(1);
  }
}
ok("hold_sessions / hold_private / hold_replies siap.");

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
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError) {
    bad(`gagal bikin sesi buat ${email}: ${linkError.message}`);
    process.exit(1);
  }
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (error) {
    bad(`gagal login ${email}: ${error.message}`);
    process.exit(1);
  }
  return client;
}

const asAuthor = await signInAs(author.user_id);
const asKeeper = await signInAs(keeper.user_id);
const created = [];

// Close anything already open so "one open session at a time" doesn't block the test.
const { data: alreadyOpen } = await admin
  .from("hold_sessions")
  .select("id, sender_id")
  .eq("space_id", spaceId)
  .in("status", ["pending", "opened", "responded", "continued"]);
if (alreadyOpen?.length) {
  console.log(`  (ada ${alreadyOpen.length} sesi asli yang masih terbuka — test akan berhenti supaya nggak mengganggunya)`);
  process.exit(0);
}

const create = (client, overrides = {}) =>
  client.rpc("hold_create", {
    p_space: spaceId,
    p_feeling: "overwhelmed",
    p_intensity: 3,
    p_share_intensity: false,
    p_need: "stay",
    p_context: "[test-hold] rahasia kecil",
    p_share_context: false,
    p_timing: "whenever",
    p_client_key: randomUUID(),
    ...overrides,
  });

try {
  info("1. Author membuka ruang (konteks + intensitas privat)");
  const key1 = randomUUID();
  const { data: c1, error: e1 } = await create(asAuthor, { p_client_key: key1 });
  if (e1 || !c1?.id) throw new Error(`gagal membuat sesi: ${e1?.message}`);
  created.push(c1.id);
  ok("sesi dibuat.");

  const { data: c1b } = await create(asAuthor, { p_client_key: key1 });
  expect(c1b?.id === c1.id && c1b?.created === false, "retry dengan client_key sama → sesi yang sama.", "retry bikin sesi baru!");

  const { error: eDup } = await create(asAuthor);
  expect(eDup?.message?.includes("hold_active_exists"), "sesi kedua selagi masih terbuka ditolak.", "bisa buka dua sesi sekaligus!");

  info("2. Privasi");
  const { data: kSees } = await asKeeper.from("hold_sessions").select("shared_context, shared_intensity").eq("id", c1.id).single();
  expect(kSees && kSees.shared_context === null && kSees.shared_intensity === null, "keeper TIDAK melihat konteks/intensitas di sesi.", "konteks privat bocor di hold_sessions!");
  const { data: kPriv } = await asKeeper.from("hold_private").select("*").eq("session_id", c1.id);
  expect(kPriv?.length === 0, "keeper TIDAK bisa membaca hold_private.", "keeper bisa baca catatan privat!");
  const { data: aPriv } = await asAuthor.from("hold_private").select("context, intensity").eq("session_id", c1.id);
  expect(aPriv?.[0]?.context?.includes("rahasia") && aPriv?.[0]?.intensity === 3, "author bisa membaca catatan privatnya sendiri.", "author nggak bisa baca catatannya sendiri.");

  info("3. Klien nggak bisa menulis langsung");
  const { error: eIns } = await asAuthor.from("hold_sessions").insert({
    space_id: spaceId, sender_id: keeper.user_id, recipient_id: author.user_id,
    feeling: "alone", need: "stay", timing: "soon", client_key: randomUUID(),
  });
  expect(!!eIns, "insert langsung (menyamar jadi keeper) ditolak.", "insert langsung diterima!");
  await asKeeper.from("hold_sessions").update({ status: "closed" }).eq("id", c1.id);
  const { data: still } = await admin.from("hold_sessions").select("status").eq("id", c1.id).single();
  expect(still.status === "pending", "update status langsung nggak berpengaruh.", "klien bisa lompat status!");

  info("4. Respons");
  const { error: eSelf } = await asAuthor.rpc("hold_respond", { p_session: c1.id, p_action: "stay", p_gesture: null, p_message: null, p_client_key: randomUUID() });
  expect(eSelf?.message?.includes("hold_forbidden"), "pengirim nggak bisa merespons sesinya sendiri.", "pengirim bisa merespons diri sendiri!");

  await asKeeper.rpc("hold_open", { p_session: c1.id });
  const { data: opened } = await admin.from("hold_sessions").select("status").eq("id", c1.id).single();
  expect(opened.status === "opened", "keeper membuka → opened.", `status ${opened.status}`);

  const rKey = randomUUID();
  const respond = (key, action = "stay") =>
    asKeeper.rpc("hold_respond", { p_session: c1.id, p_action: action, p_gesture: null, p_message: "[test-hold] aku di sini", p_client_key: key });
  const [r1, r2] = await Promise.all([respond(rKey), respond(rKey)]);
  const { count: replyCount } = await admin.from("hold_replies").select("id", { count: "exact", head: true }).eq("session_id", c1.id).eq("kind", "support");
  expect(!r1.error && !r2.error && replyCount === 1, "dua klik bersamaan (key sama) → tepat satu respons.", `respons ganda? count=${replyCount} ${r1.error?.message ?? ""} ${r2.error?.message ?? ""}`);
  const { error: eAgain } = await respond(randomUUID(), "warmth");
  expect(eAgain?.message?.includes("hold_already_responded"), "respons kedua di ronde yang sama ditolak.", "bisa merespons dua kali!");

  info("5. Setelah dukungan — 'longer' lalu 'quiet'");
  const { error: eLonger } = await asAuthor.rpc("hold_after", { p_session: c1.id, p_choice: "longer", p_new_need: "space", p_followup: "[test-hold] masih berat", p_keep: false, p_client_key: randomUUID() });
  const { data: cont } = await admin.from("hold_sessions").select("status, round, need").eq("id", c1.id).single();
  expect(!eLonger && cont.status === "continued" && cont.round === 2 && cont.need === "space", "longer → continued, ronde 2, kebutuhan berganti.", `gagal: ${eLonger?.message} ${JSON.stringify(cont)}`);

  const { error: eUnfit } = await asKeeper.rpc("hold_respond", { p_session: c1.id, p_action: "listening", p_gesture: null, p_message: null, p_client_key: randomUUID() });
  expect(eUnfit?.message?.includes("hold_action_unfit"), "minta ruang → 'listening' ditolak.", "'listening' diterima padahal minta ruang!");
  const { error: eSpace } = await asKeeper.rpc("hold_respond", { p_session: c1.id, p_action: "space", p_gesture: null, p_message: null, p_client_key: randomUUID() });
  expect(!eSpace, "ronde 2: 'gentle space' diterima.", `gagal: ${eSpace?.message}`);

  const { error: eKeeperClose } = await asKeeper.rpc("hold_close", { p_session: c1.id, p_keep: false });
  expect(eKeeperClose?.message?.includes("hold_forbidden"), "penerima nggak bisa menutup sesi orang lain.", "penerima bisa menutup!");

  const { error: eQuiet } = await asAuthor.rpc("hold_after", { p_session: c1.id, p_choice: "quiet", p_new_need: null, p_followup: null, p_keep: false, p_client_key: randomUUID() });
  const { data: closed } = await admin.from("hold_sessions").select("status, after_choice, shared_context").eq("id", c1.id).single();
  expect(!eQuiet && closed.status === "closed" && closed.after_choice === "quiet", "quiet → closed.", `gagal: ${eQuiet?.message}`);
  const { data: priv2 } = await admin.from("hold_private").select("session_id").eq("session_id", c1.id);
  const { data: msgs } = await admin.from("hold_replies").select("message").eq("session_id", c1.id);
  expect(priv2.length === 0 && msgs.every((m) => m.message === null), "nggak disimpan → konteks privat & pesan langsung dihapus.", "kata-kata masih tersimpan!");

  const { error: eReopen } = await asKeeper.rpc("hold_respond", { p_session: c1.id, p_action: "stay", p_gesture: null, p_message: null, p_client_key: randomUUID() });
  expect(eReopen?.message?.includes("hold_closed"), "sesi tertutup nggak bisa direspons (nggak dibuka lagi diam-diam).", "sesi tertutup terbuka lagi!");

  info("6. Dua arah, bersamaan");
  const [{ data: a2 }, { data: k2 }] = await Promise.all([
    create(asAuthor, { p_feeling: "miss_you", p_context: null, p_intensity: null }),
    create(asKeeper, { p_feeling: "tired", p_need: "loved", p_context: "[test-hold] dibagikan", p_share_context: true, p_intensity: 2, p_share_intensity: true }),
  ]);
  if (a2?.id) created.push(a2.id);
  if (k2?.id) created.push(k2.id);
  expect(a2?.id && k2?.id && a2.id !== k2.id, "author & keeper sama-sama bisa membuka ruang bersamaan.", "salah satu gagal dibuat.");
  const { data: aSeesK } = await asAuthor.from("hold_sessions").select("shared_context, shared_intensity, recipient_id").eq("id", k2.id).single();
  expect(aSeesK?.shared_context?.includes("dibagikan") && aSeesK.shared_intensity === 2 && aSeesK.recipient_id === author.user_id, "konteks yang DIBAGIKAN terbaca penerima.", "konteks yang dibagikan nggak kebaca.");
  await asAuthor.rpc("hold_respond", { p_session: k2.id, p_action: "warmth", p_gesture: "wrap", p_message: null, p_client_key: randomUUID() });
  const { data: both } = await admin.from("hold_sessions").select("id, status").in("id", [a2.id, k2.id]);
  const st = Object.fromEntries(both.map((b) => [b.id, b.status]));
  expect(st[k2.id] === "responded" && st[a2.id] === "pending", "merespons satu sesi nggak mengubah sesi lainnya.", JSON.stringify(st));

  info("7. Simpan & hapus");
  const { error: eKeep } = await asKeeper.rpc("hold_after", { p_session: k2.id, p_choice: "less_alone", p_new_need: null, p_followup: null, p_keep: true, p_client_key: randomUUID() });
  const { data: kept } = await admin.from("hold_sessions").select("kept, status, shared_context").eq("id", k2.id).single();
  expect(!eKeep && kept.kept && kept.status === "closed" && kept.shared_context, "less_alone + simpan → tertutup, kata-kata tetap ada.", `gagal: ${eKeep?.message}`);
  await asAuthor.from("hold_sessions").delete().eq("id", k2.id);
  const { data: notDeleted } = await admin.from("hold_sessions").select("id").eq("id", k2.id);
  expect(notDeleted.length === 1, "penerima TIDAK bisa menghapus sesi pasangannya.", "penerima bisa menghapus!");
  await asKeeper.from("hold_sessions").delete().eq("id", k2.id);
  const { data: deleted } = await admin.from("hold_sessions").select("id").eq("id", k2.id);
  expect(deleted.length === 0, "pengirim bisa menghapus sesinya (hilang untuk berdua).", "pengirim gagal menghapus.");

  info("8. Kedaluwarsa");
  await admin.from("hold_sessions").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", a2.id);
  const { error: eExp } = await asKeeper.rpc("hold_respond", { p_session: a2.id, p_action: "stay", p_gesture: null, p_message: null, p_client_key: randomUUID() });
  expect(eExp?.message?.includes("hold_expired"), "sesi lewat waktu nggak bisa direspons.", `diterima? ${eExp?.message}`);
  await asKeeper.rpc("hold_tidy", { p_space: spaceId });
  const { data: exp } = await admin.from("hold_sessions").select("status").eq("id", a2.id).single();
  expect(exp.status === "expired", "hold_tidy menandai sesi itu expired.", `status ${exp.status}`);
} catch (err) {
  bad(String(err?.message ?? err));
} finally {
  if (created.length) await admin.from("hold_sessions").delete().in("id", created);
  console.log("\n  (sesi test dibersihkan)");
}
