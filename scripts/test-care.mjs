/**
 * Integration test buat Little Care (migration 0019) — lawan DB beneran.
 *   node --env-file=.env.local scripts/test-care.mjs
 *
 * Login lewat sesi buatan service role (nggak butuh SEED_*_PASSWORD).
 *
 * Menguji: detail kesehatan privat benar-benar nggak kebaca partner, yang
 * dibagikan kebaca, needs_check hanya dengan alasan, klien nggak bisa
 * insert/update langsung, cuma partner yang bisa merawat, retry idempoten,
 * mode istirahat (tawaran ngobrol ditolak, cuma satu pesan), cuma pengirim
 * yang menjawab tawaran, "better" tanpa disimpan menghapus detail, kedaluwarsa,
 * dan hapus cuma oleh pengirim. Semua sesi test dihapus lagi di akhir.
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

info("0. Tabel + fungsi dari migration 0019");
for (const table of ["care_sessions", "care_private", "care_actions"]) {
  const { error } = await admin.from(table).select("*").limit(1);
  if (error) {
    bad(`tabel ${table} belum ada — jalanin dulu supabase/migrations/0019_little_care.sql di SQL editor. (${error.message})`);
    process.exit(1);
  }
}
ok("care_sessions / care_private / care_actions siap.");

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

const { data: alreadyOpen } = await admin
  .from("care_sessions")
  .select("id")
  .eq("space_id", spaceId)
  .in("status", ["open", "resting"]);
if (alreadyOpen?.length) {
  console.log(`  (ada ${alreadyOpen.length} Little Care asli yang masih terbuka — test berhenti supaya nggak mengganggunya)`);
  process.exit(0);
}

const create = (client, overrides = {}) =>
  client.rpc("care_create", {
    p_space: spaceId,
    p_symptoms: ["stomach", "nausea"],
    p_severity: "moderate",
    p_note: "[test-care] catatan rahasia",
    p_share_details: false,
    p_share_note: false,
    p_red_flags: [],
    p_needs_check: true,
    p_wants: ["warm", "stay"],
    p_client_key: randomUUID(),
    ...overrides,
  });

const act = (client, session, kind, variant = null, message = null, key = randomUUID()) =>
  client.rpc("care_act", { p_session: session, p_kind: kind, p_variant: variant, p_message: message, p_client_key: key });

try {
  info("1. Keeper membuka Little Care (detail privat)");
  const key1 = randomUUID();
  const { data: c1, error: e1 } = await create(asKeeper, { p_client_key: key1 });
  if (e1 || !c1?.id) throw new Error(`gagal membuat sesi: ${e1?.message}`);
  created.push(c1.id);
  ok("sesi dibuat.");

  const { data: c1b } = await create(asKeeper, { p_client_key: key1 });
  expect(c1b?.id === c1.id && c1b?.created === false, "retry dengan client_key sama → sesi yang sama.", "retry bikin sesi baru!");
  const { error: eDup } = await create(asKeeper);
  expect(eDup?.message?.includes("care_active_exists"), "sesi kedua selagi masih terbuka ditolak.", "bisa buka dua sesi sekaligus!");

  info("2. Privasi");
  const { data: aSees } = await asAuthor.from("care_sessions").select("*").eq("id", c1.id).single();
  expect(
    aSees && aSees.shared_symptoms === null && aSees.shared_severity === null && aSees.shared_note === null,
    "partner nggak melihat keluhan/tingkat/catatan yang nggak dibagikan.",
    `bocor: ${JSON.stringify(aSees)}`,
  );
  expect(aSees?.needs_check === false, "needs_check tanpa alasan (sedang, tanpa tanda bahaya) diabaikan.", "needs_check tersimpan tanpa alasan!");
  const { data: aPriv } = await asAuthor.from("care_private").select("*").eq("session_id", c1.id);
  expect((aPriv ?? []).length === 0, "care_private nggak terbaca partner sama sekali.", "partner bisa baca care_private!");
  const { data: kPriv } = await asKeeper.from("care_private").select("*").eq("session_id", c1.id).single();
  expect(kPriv?.note?.includes("rahasia") && kPriv.severity === "moderate", "pengirim membaca detail privatnya sendiri.", "pengirim nggak bisa baca miliknya.");

  info("3. Tulis langsung ditolak");
  const { error: eIns } = await asKeeper.from("care_sessions").insert({ space_id: spaceId, sender_id: keeper.user_id, recipient_id: author.user_id, wants: ["warm"], client_key: randomUUID() });
  expect(!!eIns, "insert langsung ke care_sessions ditolak.", "insert langsung diterima!");
  await asAuthor.from("care_sessions").update({ status: "closed" }).eq("id", c1.id);
  const { data: still } = await admin.from("care_sessions").select("status").eq("id", c1.id).single();
  expect(still.status === "open", "update langsung nggak mengubah apa-apa.", "update langsung berhasil!");

  info("4. Merawat");
  const { error: eSelf } = await act(asKeeper, c1.id, "gesture", "hug");
  expect(eSelf?.message?.includes("care_forbidden"), "pengirim nggak bisa merawat dirinya sendiri.", `diterima? ${eSelf?.message}`);
  const actKey = randomUUID();
  const { data: a1, error: ea1 } = await act(asAuthor, c1.id, "gesture", "hug", null, actKey);
  expect(!ea1 && a1?.first === true && a1?.duplicate === false, "partner mengirim pelukan (first=true).", `gagal: ${ea1?.message}`);
  const { data: a1b } = await act(asAuthor, c1.id, "gesture", "hug", null, actKey);
  expect(a1b?.duplicate === true && a1b?.id === a1.id, "retry dengan client_key sama → aksi yang sama.", "retry bikin aksi ganda!");
  const { data: offer } = await act(asAuthor, c1.id, "accompany", "call");
  const { error: eAnsWrong } = await asAuthor.rpc("care_answer", { p_action: offer.id, p_answer: "yes" });
  expect(eAnsWrong?.message?.includes("care_forbidden"), "perawat nggak bisa menjawab tawarannya sendiri.", "perawat bisa menjawab sendiri!");
  const { error: eAns } = await asKeeper.rpc("care_answer", { p_action: offer.id, p_answer: "not_now" });
  const { data: ans } = await admin.from("care_actions").select("answer").eq("id", offer.id).single();
  expect(!eAns && ans.answer === "not_now", "pengirim menjawab \"nanti dulu\".", `gagal: ${eAns?.message}`);
  const { error: eBadShape } = await act(asAuthor, c1.id, "gesture", "rocket");
  expect(!!eBadShape, "gestur yang nggak dikenal ditolak.", "gestur aneh diterima!");

  info("5. Mode istirahat");
  await asKeeper.rpc("care_set_rest", { p_session: c1.id, p_on: true });
  const { error: eCall } = await act(asAuthor, c1.id, "accompany", "chat");
  expect(eCall?.message?.includes("care_resting"), "tawaran ngobrol ditolak selagi istirahat.", `diterima? ${eCall?.message}`);
  const { error: eNote1 } = await act(asAuthor, c1.id, "message", null, "[test-care] istirahat ya");
  const { error: eNote2 } = await act(asAuthor, c1.id, "message", null, "[test-care] satu lagi");
  expect(!eNote1 && eNote2?.message?.includes("care_rest_note_used"), "cuma satu pesan untuk nanti selagi istirahat.", `${eNote1?.message} / ${eNote2?.message}`);
  const { error: eGlow } = await act(asAuthor, c1.id, "gesture", "glow");
  expect(!eGlow, "gestur diam tetap boleh selagi istirahat.", `ditolak: ${eGlow?.message}`);

  info("6. A little better? (tanpa disimpan → detail dihapus)");
  const { error: eBetter } = await asKeeper.rpc("care_after", { p_session: c1.id, p_choice: "better", p_keep: false });
  const { data: closed } = await admin.from("care_sessions").select("status, kept, shared_note").eq("id", c1.id).single();
  const { data: privGone } = await admin.from("care_private").select("session_id").eq("session_id", c1.id);
  const { data: msgsGone } = await admin.from("care_actions").select("id").eq("session_id", c1.id).eq("kind", "message");
  expect(
    !eBetter && closed.status === "closed" && !closed.kept && privGone.length === 0 && msgsGone.length === 0,
    "ditutup, detail privat + pesan dihapus.",
    `gagal: ${eBetter?.message} ${JSON.stringify(closed)}`,
  );
  const { error: eAfterClose } = await act(asAuthor, c1.id, "gesture", "star");
  expect(eAfterClose?.message?.includes("care_closed"), "sesi tertutup nggak bisa dirawat lagi.", `diterima? ${eAfterClose?.message}`);

  info("7. Dibagikan + perlu diperiksa (author sakit)");
  const { data: c2, error: e2 } = await create(asAuthor, {
    p_share_details: true,
    p_share_note: true,
    p_note: "[test-care] dibagikan",
    p_severity: "severe",
    p_red_flags: ["repeated_vomiting"],
    p_wants: ["quiet", "drink"],
  });
  if (e2 || !c2?.id) throw new Error(`gagal membuat sesi 2: ${e2?.message}`);
  created.push(c2.id);
  const { data: kSees } = await asKeeper.from("care_sessions").select("*").eq("id", c2.id).single();
  expect(
    kSees?.shared_severity === "severe" && kSees.shared_note?.includes("dibagikan") && kSees.needs_check === true,
    "yang dibagikan + tanda \"perlu diperiksa\" terbaca partner.",
    JSON.stringify(kSees),
  );
  expect(kSees?.status === "resting", "Quiet Time → sesi mulai dalam mode istirahat.", `status ${kSees?.status}`);
  const { data: kPriv2 } = await asKeeper.from("care_private").select("red_flags").eq("session_id", c2.id);
  expect((kPriv2 ?? []).length === 0, "daftar tanda bahayanya tetap privat.", "tanda bahaya bocor!");

  info("8. Kedaluwarsa + hapus");
  await admin.from("care_sessions").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", c2.id);
  const { error: eExp } = await act(asKeeper, c2.id, "gesture", "hug");
  expect(eExp?.message?.includes("care_expired"), "sesi lewat waktu nggak bisa dirawat.", `diterima? ${eExp?.message}`);
  await asKeeper.rpc("care_tidy", { p_space: spaceId });
  const { data: exp } = await admin.from("care_sessions").select("status, shared_note").eq("id", c2.id).single();
  expect(exp.status === "expired" && exp.shared_note === null, "care_tidy menandai expired + menghapus detail.", JSON.stringify(exp));
  await asKeeper.from("care_sessions").delete().eq("id", c2.id);
  const { data: notDeleted } = await admin.from("care_sessions").select("id").eq("id", c2.id);
  expect(notDeleted.length === 1, "partner TIDAK bisa menghapus Little Care pasangannya.", "partner bisa menghapus!");
  await asAuthor.from("care_sessions").delete().eq("id", c2.id);
  const { data: deleted } = await admin.from("care_sessions").select("id").eq("id", c2.id);
  expect(deleted.length === 0, "pengirim bisa menghapusnya (hilang untuk berdua).", "pengirim gagal menghapus.");
} catch (err) {
  bad(String(err?.message ?? err));
} finally {
  if (created.length) await admin.from("care_sessions").delete().in("id", created);
  console.log("\n  (sesi test dibersihkan)");
}
