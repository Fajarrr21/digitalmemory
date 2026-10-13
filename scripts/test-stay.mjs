/**
 * Integration test buat stay, my love. (migration 0020) — lawan DB beneran.
 *   node --env-file=.env.local scripts/test-stay.mjs
 *
 * Login lewat sesi buatan service role (nggak butuh SEED_*_PASSWORD).
 *
 * Menguji: Little Care sudah pensiun, hadiah cuma bisa dikirim SEBAGAI diri
 * sendiri KE pasangan, bentuk hadiah divalidasi DB, audio harus di folder
 * sendiri, cuma penerima yang bisa membuka / menyimpan ke kotak, cuma
 * pengirim yang bisa mengubah kata-kata dan mengambil kembali, voice nggak
 * bisa "diedit", preferensi kamar cuma milik sendiri, dan channel Realtime
 * privat bisa di-join anggota. Semua data test dihapus lagi di akhir.
 */
import { randomUUID } from "node:crypto";
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

info("0. Tabel dari migration 0020");
for (const table of ["stay_gifts", "stay_rooms"]) {
  const { error } = await admin.from(table).select("*").limit(1);
  if (error) {
    bad(`tabel ${table} belum ada — jalanin dulu supabase/migrations/0020_stay_my_love.sql di SQL editor. (${error.message})`);
    process.exit(1);
  }
}
ok("stay_gifts / stay_rooms siap.");
const { error: careGone } = await admin.from("care_sessions").select("id").limit(1);
expect(!!careGone, "tabel Little Care sudah dihapus.", "care_sessions masih ada!");

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
const uploaded = [];

const gift = (overrides = {}) => ({
  space_id: spaceId,
  sender_id: author.user_id,
  recipient_id: keeper.user_id,
  kind: "note",
  body: "[test-stay] hey, love.",
  ...overrides,
});

try {
  info("1. Mengirim");
  const { data: g1, error: e1 } = await asAuthor.from("stay_gifts").insert(gift()).select("id").single();
  if (e1 || !g1) throw new Error(`gagal mengirim note: ${e1?.message}`);
  created.push(g1.id);
  ok("author meninggalkan note di kamar keeper.");

  const { error: eAs } = await asAuthor.from("stay_gifts").insert(gift({ sender_id: keeper.user_id, recipient_id: author.user_id }));
  expect(!!eAs, "nggak bisa mengirim atas nama orang lain.", "bisa mengirim sebagai pasangan!");
  const { error: eSelf } = await asAuthor.from("stay_gifts").insert(gift({ recipient_id: author.user_id }));
  expect(!!eSelf, "nggak bisa mengirim ke kamar sendiri.", "bisa mengirim ke diri sendiri!");
  const { error: eOpened } = await asAuthor.from("stay_gifts").insert(gift({ opened_at: new Date().toISOString() }));
  expect(!!eOpened, "nggak bisa mengirim yang sudah 'dibuka'.", "bisa memalsukan opened_at!");
  const { error: eShape } = await asAuthor.from("stay_gifts").insert(gift({ kind: "object", body: null }));
  expect(!!eShape, "objek tanpa jenis ditolak DB.", "objek tanpa jenis diterima!");
  const { error: eComfortLong } = await asAuthor.from("stay_gifts").insert(gift({ kind: "comfort", body: "x".repeat(301) }));
  expect(!!eComfortLong, "comfort message > 300 karakter ditolak.", "comfort kepanjangan diterima!");
  const { error: eAudio } = await asAuthor
    .from("stay_gifts")
    .insert(gift({ kind: "voice", body: null, audio_path: `${spaceId}/${keeper.user_id}/stay/x.webm`, audio_seconds: 5 }));
  expect(!!eAudio, "audio di folder orang lain ditolak.", "audio di folder orang lain diterima!");

  info("2. Voice di Storage privat");
  const path = `${spaceId}/${author.user_id}/stay/${randomUUID()}.webm`;
  const { error: upErr } = await asAuthor.storage.from("media").upload(path, new Blob([new Uint8Array(64)], { type: "audio/webm" }), { contentType: "audio/webm" });
  if (upErr) bad(`upload gagal: ${upErr.message}`);
  else uploaded.push(path);
  const { data: gv, error: ev } = await asAuthor
    .from("stay_gifts")
    .insert(gift({ kind: "voice", body: null, audio_path: path, audio_mime: "audio/webm", audio_seconds: 4 }))
    .select("id")
    .single();
  expect(!ev && gv, "voice gift dengan audio di folder sendiri diterima.", `gagal: ${ev?.message}`);
  if (gv) created.push(gv.id);
  const { data: signed } = await asKeeper.storage.from("media").createSignedUrl(path, 60);
  expect(!!signed?.signedUrl, "penerima bisa memutar lewat signed URL.", "penerima nggak bisa memutar.");
  const { data: pub } = await fetch(`${url}/storage/v1/object/public/media/${path}`).then((r) => ({ data: r.ok }));
  expect(!pub, "audio TIDAK terbuka lewat URL publik.", "audio bisa diakses publik!");
  const { error: eEditVoice } = await asAuthor.rpc("stay_edit", { p_gift: gv?.id, p_body: "ubah" });
  expect(eEditVoice?.message?.includes("stay_invalid"), "voice nggak bisa diedit (rekam baru saja).", `diterima? ${eEditVoice?.message}`);

  info("3. Membuka + kotak kecil");
  await asAuthor.rpc("stay_open", { p_gift: g1.id });
  const { data: notOpened } = await admin.from("stay_gifts").select("opened_at").eq("id", g1.id).single();
  expect(notOpened.opened_at === null, "pengirim nggak bisa menandai hadiahnya sendiri sudah dibuka.", "pengirim bisa menandai dibuka!");
  await asKeeper.rpc("stay_open", { p_gift: g1.id });
  const { data: opened } = await admin.from("stay_gifts").select("opened_at").eq("id", g1.id).single();
  expect(!!opened.opened_at, "penerima membukanya.", "gagal membuka.");
  const { error: eAwayWrong } = await asAuthor.rpc("stay_put_away", { p_gift: g1.id, p_away: true });
  expect(eAwayWrong?.message?.includes("stay_forbidden"), "pengirim nggak bisa memindahkan ke kotak.", "pengirim bisa!");
  await asKeeper.rpc("stay_put_away", { p_gift: g1.id, p_away: true });
  const { data: away } = await admin.from("stay_gifts").select("put_away_at").eq("id", g1.id).single();
  expect(!!away.put_away_at, "penerima menyimpannya ke kotak kecil.", "gagal menyimpan.");
  await asKeeper.rpc("stay_put_away", { p_gift: g1.id, p_away: false });
  const { data: back } = await admin.from("stay_gifts").select("put_away_at").eq("id", g1.id).single();
  expect(back.put_away_at === null, "…dan menaruhnya lagi di meja.", "gagal menaruh lagi.");

  info("4. Mengubah + mengambil kembali");
  const { error: eEditWrong } = await asKeeper.rpc("stay_edit", { p_gift: g1.id, p_body: "[test-stay] diubah penerima" });
  expect(eEditWrong?.message?.includes("stay_forbidden"), "penerima nggak bisa mengubah kata-kata pengirim.", "penerima bisa mengubah!");
  await asKeeper.from("stay_gifts").update({ body: "hack" }).eq("id", g1.id);
  const { data: stillBody } = await admin.from("stay_gifts").select("body").eq("id", g1.id).single();
  expect(stillBody.body === "[test-stay] hey, love.", "update langsung nggak mengubah apa-apa.", "update langsung berhasil!");
  const { error: eEdit } = await asAuthor.rpc("stay_edit", { p_gift: g1.id, p_body: "[test-stay] diubah" });
  const { data: edited } = await admin.from("stay_gifts").select("body, edited_at").eq("id", g1.id).single();
  expect(!eEdit && edited.body === "[test-stay] diubah" && edited.edited_at, "pengirim mengubah note-nya.", `gagal: ${eEdit?.message}`);
  await asKeeper.from("stay_gifts").delete().eq("id", g1.id);
  const { data: notDeleted } = await admin.from("stay_gifts").select("id").eq("id", g1.id);
  expect(notDeleted.length === 1, "penerima TIDAK bisa menghapus hadiah.", "penerima bisa menghapus!");
  await asAuthor.from("stay_gifts").delete().eq("id", g1.id);
  const { data: deleted } = await admin.from("stay_gifts").select("id").eq("id", g1.id);
  expect(deleted.length === 0, "pengirim bisa mengambilnya kembali.", "pengirim gagal mengambil kembali.");

  info("5. Kamar milik sendiri");
  const { data: kRoom } = await admin.from("stay_rooms").select("*").eq("user_id", keeper.user_id).maybeSingle();
  const { error: eRoom } = await asKeeper.from("stay_rooms").upsert({ user_id: keeper.user_id, space_id: spaceId, scene: "night" }, { onConflict: "user_id" });
  expect(!eRoom, "keeper menyimpan preferensi kamarnya.", `gagal: ${eRoom?.message}`);
  const { data: aSees } = await asAuthor.from("stay_rooms").select("*").eq("user_id", keeper.user_id);
  expect((aSees ?? []).length === 0, "pasangan nggak bisa membaca preferensi kamar orang lain.", "preferensi bocor!");
  const { error: eRoomOther } = await asAuthor.from("stay_rooms").upsert({ user_id: keeper.user_id, space_id: spaceId, scene: "rain" }, { onConflict: "user_id" });
  const { data: kRoomAfter } = await admin.from("stay_rooms").select("scene").eq("user_id", keeper.user_id).single();
  expect(!!eRoomOther || kRoomAfter.scene === "night", "pasangan nggak bisa mengubah kamar orang lain.", "pasangan bisa mengubah!");
  if (kRoom) await admin.from("stay_rooms").update({ scene: kRoom.scene }).eq("user_id", keeper.user_id);
  else await admin.from("stay_rooms").delete().eq("user_id", keeper.user_id);

  info("6. Channel Realtime privat");
  const joined = await new Promise((resolve) => {
    const ch = asKeeper.channel(`stay:${spaceId}`, { config: { private: true } });
    const t = setTimeout(() => {
      void asKeeper.removeChannel(ch);
      resolve("timeout");
    }, 8000);
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR") {
        clearTimeout(t);
        void asKeeper.removeChannel(ch);
        resolve(status);
      }
    });
  });
  expect(joined === "SUBSCRIBED", "anggota bisa join channel privat stay:<space>.", `status: ${joined}`);
} catch (err) {
  bad(String(err?.message ?? err));
} finally {
  if (created.length) await admin.from("stay_gifts").delete().in("id", created);
  if (uploaded.length) await admin.storage.from("media").remove(uploaded);
  console.log("\n  (data test dibersihkan)");
  process.exit();
}
