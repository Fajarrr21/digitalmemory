/**
 * Integration test buat little words. (migration 0022) — lawan DB beneran.
 *   node --env-file=.env.local scripts/test-words.mjs
 *
 * Login lewat sesi buatan service role (nggak butuh SEED_*_PASSWORD).
 *
 * Menguji privasi & aturannya:
 *  - karya (draft maupun selesai) cuma bisa dibaca/diubah/dihapus penulisnya;
 *    revisi & Lines I Love juga milik sendiri;
 *  - kiriman = SNAPSHOT: mengubah karya nggak mengubah yang sudah dikirim;
 *  - kirim cuma SEBAGAI diri sendiri, KE pasangan, dari karya sendiri, segar;
 *  - kiriman terkunci (unlock_at) isinya benar-benar nggak kebaca penerima,
 *    words_sealed() cuma kasih tahu bahwa ada & kapan; words_open menolak;
 *  - cuma penerima yang membuka / memfavoritkan / mengarsipkan;
 *  - pengirim bisa menarik cuma selama belum dibuka;
 *  - balasan cuma ke sesuatu yang dikirim KE kamu;
 *  - hapus karya: revisi ikut hilang, kiriman & baris tetap (work_id null).
 * Semua data test dihapus lagi di akhir. Nggak ada notifikasi apa pun.
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
const TAG = "__test_words__";

info("0. Tabel dari migration 0022");
for (const table of ["literary_works", "literary_revisions", "literary_deliveries", "literary_lines", "literary_ai_usage"]) {
  const { error } = await admin.from(table).select("*").limit(1);
  if (error) {
    bad(`tabel ${table} belum ada — jalanin dulu supabase/migrations/0022_little_words.sql di SQL editor. (${error.message})`);
    process.exit(1);
  }
}
ok("semua tabel little words. siap.");

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
    bad(`gagal login sebagai ${email}: ${error.message}`);
    process.exit(1);
  }
  return client;
}

const A = await signInAs(author.user_id); // the author
const K = await signInAs(keeper.user_id); // the keeper
const future = new Date(Date.now() + 3 * 24 * 3600_000).toISOString();

try {
  info("1. Karya cuma milik penulisnya");
  const { data: work, error: wErr } = await A.from("literary_works")
    .insert({ space_id: spaceId, author_id: author.user_id, title: `${TAG} hujan`, content: "Kau datang seperti hujan pertama.", work_type: "poetry" })
    .select("id")
    .single();
  expect(!wErr && work, "penulis bisa membuat draft.", `gagal membuat karya: ${wErr?.message}`);
  const { data: kSees } = await K.from("literary_works").select("id").eq("id", work.id);
  expect(kSees?.length === 0, "pasangan TIDAK bisa membaca draft itu.", "pasangan bisa membaca draft!");
  const { data: kUpd } = await K.from("literary_works").update({ title: "diubah" }).eq("id", work.id).select("id");
  expect(!kUpd?.length, "pasangan tidak bisa mengubahnya.", "pasangan bisa mengubah karya!");
  const { data: kDel } = await K.from("literary_works").delete().eq("id", work.id).select("id");
  expect(!kDel?.length, "pasangan tidak bisa menghapusnya.", "pasangan bisa menghapus karya!");
  const { error: spoof } = await K.from("literary_works").insert({ space_id: spaceId, author_id: author.user_id, title: TAG, content: "x" });
  expect(!!spoof, "tidak bisa menulis atas nama orang lain.", "bisa membuat karya atas nama pasangan!");
  const { error: aFinish } = await A.from("literary_works").update({ status: "finished" }).eq("id", work.id);
  const { data: kSees2 } = await K.from("literary_works").select("id").eq("id", work.id);
  expect(!aFinish && kSees2?.length === 0, "karya selesai pun tetap privat (berbagi hanya lewat kiriman).", "karya selesai terlihat pasangan!");

  info("2. Revisi milik sendiri");
  const { error: revErr } = await A.from("literary_revisions").insert({ work_id: work.id, author_id: author.user_id, title: TAG, content: "v1", kind: "created" });
  expect(!revErr, "penulis bisa menyimpan revisi.", `revisi gagal: ${revErr?.message}`);
  const { data: kRev } = await K.from("literary_revisions").select("id").eq("work_id", work.id);
  expect(kRev?.length === 0, "pasangan tidak bisa membaca riwayat revisi.", "revisi bocor ke pasangan!");
  const { error: kRevIns } = await K.from("literary_revisions").insert({ work_id: work.id, author_id: keeper.user_id, content: "x", kind: "manual" });
  expect(!!kRevIns, "pasangan tidak bisa menambah revisi ke karya orang.", "pasangan bisa menyelipkan revisi!");

  info("3. Mengirim = snapshot, dengan aturan ketat");
  const base = { space_id: spaceId, work_id: work.id, sender_id: author.user_id, recipient_id: keeper.user_id, work_type: "poetry" };
  const { data: d1, error: d1Err } = await A.from("literary_deliveries")
    .insert({ ...base, title: `${TAG} hujan`, content: "Kau datang seperti hujan pertama.", intro: "untukmu" })
    .select("id")
    .single();
  expect(!d1Err && d1, "penulis bisa mengirim ke pasangan.", `gagal mengirim: ${d1Err?.message}`);
  await A.from("literary_works").update({ content: "SUDAH DIUBAH" }).eq("id", work.id);
  const { data: kRead } = await K.from("literary_deliveries").select("content").eq("id", d1.id).single();
  expect(kRead?.content === "Kau datang seperti hujan pertama.", "penerima membaca snapshot — editan karya tidak mengubahnya.", "kiriman ikut berubah / tak terbaca!");
  const { data: kEdit } = await K.from("literary_deliveries").update({ content: "dipalsukan" }).eq("id", d1.id).select("id");
  expect(!kEdit?.length, "penerima tidak bisa mengubah isi kiriman.", "isi kiriman bisa diubah!");
  const { data: aEdit } = await A.from("literary_deliveries").update({ content: "ditulis ulang" }).eq("id", d1.id).select("id");
  expect(!aEdit?.length, "pengirim pun tidak bisa menulis ulang yang sudah diberikan.", "pengirim bisa mengubah kiriman!");

  const { error: asOther } = await K.from("literary_deliveries").insert({ ...base, title: TAG, content: "x" });
  expect(!!asOther, "tidak bisa mengirim atas nama pasangan.", "bisa mengirim sebagai orang lain!");
  const { error: toSelf } = await A.from("literary_deliveries").insert({ ...base, recipient_id: author.user_id, title: TAG, content: "x" });
  expect(!!toSelf, "tidak bisa mengirim ke diri sendiri.", "bisa mengirim ke diri sendiri!");
  const { error: preOpened } = await A.from("literary_deliveries").insert({ ...base, title: TAG, content: "x", opened_at: new Date().toISOString() });
  expect(!!preOpened, "tidak bisa mengirim yang sudah 'dibuka'.", "bisa mengirim dalam keadaan terbuka!");
  const { data: kWork } = await K.from("literary_works")
    .insert({ space_id: spaceId, author_id: keeper.user_id, title: `${TAG} milik dia`, content: "punyaku" })
    .select("id")
    .single();
  const { error: foreignWork } = await A.from("literary_deliveries").insert({ ...base, work_id: kWork.id, title: TAG, content: "x" });
  expect(!!foreignWork, "tidak bisa mengirim karya milik orang lain.", "bisa mengirim karya pasangan!");

  info("4. Kiriman terkunci benar-benar terkunci");
  const { data: locked } = await A.from("literary_deliveries")
    .insert({ ...base, title: `${TAG} ulang tahun`, content: "RAHASIA", open_when: "birthday", unlock_at: future })
    .select("id")
    .single();
  const { data: kLocked } = await K.from("literary_deliveries").select("content").eq("id", locked.id);
  expect(kLocked?.length === 0, "penerima tidak bisa membaca isinya sebelum waktunya.", "isi kiriman terkunci terbaca!");
  const { data: sealed } = await K.rpc("words_sealed", { p_space: spaceId });
  const s = sealed?.find((x) => x.id === locked.id);
  expect(s && !("content" in s) && !("title" in s) && s.open_when === "birthday", "words_sealed() hanya memberi tahu bahwa ada & kapan.", "words_sealed bocor / tak menemukan!");
  const { error: openLocked } = await K.rpc("words_open", { p_delivery: locked.id });
  expect(/words_locked/.test(openLocked?.message ?? ""), "membuka sebelum waktunya ditolak.", "kiriman terkunci bisa dibuka!");
  const { error: lineLocked } = await K.from("literary_lines").insert({ space_id: spaceId, user_id: keeper.user_id, text: "RAHASIA", delivery_id: locked.id });
  expect(!!lineLocked, "tidak bisa menyimpan baris dari kiriman terkunci.", "bisa menyimpan baris dari kiriman terkunci!");
  const { data: aLocked } = await A.from("literary_deliveries").select("content").eq("id", locked.id).single();
  expect(aLocked?.content === "RAHASIA", "pengirim tetap bisa melihat apa yang dia kunci.", "pengirim tak bisa melihat kirimannya!");

  info("5. Membuka, favorit, arsip — hanya penerima");
  const { error: aOpens } = await A.rpc("words_open", { p_delivery: d1.id });
  expect(/words_forbidden/.test(aOpens?.message ?? ""), "pengirim tidak bisa menandai kirimannya 'dibuka'.", "pengirim bisa membuka untuk penerima!");
  const { error: kOpens } = await K.rpc("words_open", { p_delivery: d1.id });
  const { data: afterOpen } = await K.from("literary_deliveries").select("opened_at").eq("id", d1.id).single();
  expect(!kOpens && afterOpen?.opened_at, "penerima membukanya.", `gagal membuka: ${kOpens?.message}`);
  const { error: kMark } = await K.rpc("words_mark", { p_delivery: d1.id, p_favorite: true, p_archived: null });
  const { data: afterMark } = await K.from("literary_deliveries").select("recipient_favorite, recipient_archived").eq("id", d1.id).single();
  expect(!kMark && afterMark?.recipient_favorite && !afterMark.recipient_archived, "penerima memfavoritkan (arsip tak tersentuh).", "words_mark salah!");
  const { error: aMark } = await A.rpc("words_mark", { p_delivery: d1.id, p_favorite: false, p_archived: true });
  expect(/words_forbidden/.test(aMark?.message ?? ""), "pengirim tidak bisa mengubah tanda milik penerima.", "pengirim bisa mengarsipkan milik penerima!");

  info("6. Menarik kembali — hanya selama belum dibuka");
  const { data: wOpened } = await A.from("literary_deliveries").delete().eq("id", d1.id).select("id");
  expect(!wOpened?.length, "yang sudah dibuka tidak bisa ditarik.", "kiriman yang sudah dibaca bisa ditarik!");
  const { data: kWithdraw } = await K.from("literary_deliveries").delete().eq("id", locked.id).select("id");
  expect(!kWithdraw?.length, "penerima tidak bisa menghapus pemberian.", "penerima bisa menghapus kiriman!");
  const { data: wLocked } = await A.from("literary_deliveries").delete().eq("id", locked.id).select("id");
  expect(wLocked?.length === 1, "pengirim bisa menarik yang belum dibuka.", "pengirim tak bisa menarik kiriman yang belum dibuka!");

  info("7. Balasan & Lines I Love");
  const { data: reply, error: replyErr } = await K.from("literary_deliveries")
    .insert({ space_id: spaceId, work_id: kWork.id, sender_id: keeper.user_id, recipient_id: author.user_id, work_type: "prose", title: `${TAG} balasan`, content: "balasanku", reply_to: d1.id })
    .select("id")
    .single();
  expect(!replyErr && reply, "penerima bisa membalas dengan karyanya.", `balasan gagal: ${replyErr?.message}`);
  const { error: badReply } = await A.from("literary_deliveries").insert({ ...base, title: TAG, content: "x", reply_to: d1.id });
  expect(!!badReply, "tidak bisa 'membalas' kiriman yang bukan untukmu.", "bisa membalas kiriman sendiri!");
  const { data: line, error: lineErr } = await K.from("literary_lines")
    .insert({ space_id: spaceId, user_id: keeper.user_id, text: "hujan pertama", delivery_id: d1.id, source_title: TAG })
    .select("id")
    .single();
  expect(!lineErr && line, "penerima menyimpan satu baris dari kiriman.", `gagal menyimpan baris: ${lineErr?.message}`);
  const { data: aLines } = await A.from("literary_lines").select("id").eq("id", line.id);
  expect(aLines?.length === 0, "Lines I Love tidak terlihat pasangan.", "baris favorit bocor!");
  const { error: foreignLine } = await K.from("literary_lines").insert({ space_id: spaceId, user_id: keeper.user_id, text: "x", work_id: work.id });
  expect(!!foreignLine, "tidak bisa menautkan baris ke karya orang lain.", "bisa menautkan baris ke karya pasangan!");
  const { data: aLine } = await A.from("literary_lines")
    .insert({ space_id: spaceId, user_id: author.user_id, text: "hujan", work_id: work.id, source_title: TAG })
    .select("id")
    .single();

  info("8. Menghapus karya");
  await A.from("literary_works").delete().eq("id", work.id);
  const { count: revLeft } = await admin.from("literary_revisions").select("id", { count: "exact", head: true }).eq("work_id", work.id);
  expect(revLeft === 0, "revisinya ikut terhapus.", "revisi yatim tertinggal!");
  const { data: dAfter } = await K.from("literary_deliveries").select("content, work_id").eq("id", d1.id).single();
  expect(dAfter?.content && dAfter.work_id === null, "yang sudah diberikan tetap ada di penerima.", "kiriman ikut hilang!");
  const { data: lAfter } = await A.from("literary_lines").select("text, work_id").eq("id", aLine.id).single();
  expect(lAfter?.text === "hujan" && lAfter.work_id === null, "baris yang disimpan tetap ada.", "baris ikut hilang!");

  info("9. Jejak AI tidak menyimpan tulisan & milik sendiri");
  const { error: useErr } = await A.from("literary_ai_usage").insert({ user_id: author.user_id, kind: "explain" });
  const { data: kUse } = await K.from("literary_ai_usage").select("id").eq("user_id", author.user_id);
  expect(!useErr && kUse?.length === 0, "catatan pemakaian AI milik sendiri, tanpa teks.", "catatan AI bocor / gagal!");
} catch (err) {
  bad(`error tak terduga: ${err?.message ?? err}`);
} finally {
  info("Bersih-bersih");
  await admin.from("literary_lines").delete().eq("space_id", spaceId).eq("source_title", TAG);
  await admin.from("literary_deliveries").delete().eq("space_id", spaceId).like("title", `${TAG}%`);
  await admin.from("literary_works").delete().eq("space_id", spaceId).like("title", `${TAG}%`);
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  await admin.from("literary_ai_usage").delete().eq("user_id", author.user_id).eq("kind", "explain").gte("created_at", since);
  const { count } = await admin.from("literary_deliveries").select("id", { count: "exact", head: true }).like("title", `${TAG}%`);
  expect(count === 0, "data test sudah dihapus.", "masih ada data test tertinggal!");
}
