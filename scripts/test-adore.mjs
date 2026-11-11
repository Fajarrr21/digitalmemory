/**
 * Integration test buat the way i adore you. (migration 0023) — lawan DB beneran.
 *   node --env-file=.env.local scripts/test-adore.mjs
 * Draft/terjadwal/arsip nggak kebaca keeper; cuma author yang menulis;
 * tanda keeper cuma lewat adore_mark. Data test dihapus lagi di akhir.
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
const TAG = "__test_adore__";

info("0. Tabel dari migration 0023");
for (const table of ["adore_contents"]) {
  const { error } = await admin.from(table).select("*").limit(1);
  if (error) {
    bad(`tabel ${table} belum ada — jalanin dulu supabase/migrations/0023_the_way_i_adore_you.sql di SQL editor. (${error.message})`);
    process.exit(1);
  }
}
ok("semua tabel the way i adore you. siap.");

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


const A = await signInAs(author.user_id);
const K = await signInAs(keeper.user_id);
const future = new Date(Date.now() + 3 * 24 * 3600_000).toISOString();
const past = new Date(Date.now() - 3600_000).toISOString();
const row = (status, publish_at, title) => ({
  space_id: spaceId, author_id: author.user_id, content_type: "reason", title: `${TAG} ${title}`, body: "isi", status, publish_at,
});

try {
  info("1. Cuma author yang menulis");
  const { error: kIns } = await K.from("adore_contents").insert({ ...row("published", past, "dari keeper"), author_id: keeper.user_id });
  expect(kIns, "keeper ditolak menulis.", "keeper BISA menulis!");
  const { data: made, error: aIns } = await A.from("adore_contents")
    .insert([row("published", past, "live"), row("draft", past, "draft"), row("published", future, "scheduled"), row("archived", past, "arsip")])
    .select("id, title");
  expect(!aIns && made?.length === 4, "author bikin 4 baris.", `author gagal: ${aIns?.message}`);
  const id = (t) => made.find((m) => m.title.endsWith(t)).id;

  info("2. Keeper cuma lihat yang published + sudah waktunya");
  const { data: seen } = await K.from("adore_contents").select("title").like("title", `${TAG}%`);
  expect(seen?.length === 1 && seen[0].title.endsWith("live"), "keeper cuma lihat 'live'.", `keeper lihat: ${seen?.map((s) => s.title)}`);
  const { data: direct } = await K.from("adore_contents").select("body").eq("id", id("scheduled"));
  expect(direct?.length === 0, "query langsung ke yang terjadwal kosong.", "isi terjadwal BOCOR!");
  const { data: sealed } = await K.rpc("adore_sealed", { p_space: spaceId });
  const s = sealed?.find((x) => x.id === id("scheduled"));
  expect(s && !("title" in s) && !("body" in s), "adore_sealed kasih tahu ada & kapan, tanpa isi.", "adore_sealed salah.");

  info("3. Tanda dari keeper cuma lewat adore_mark");
  const { error: kUpd, count } = await K.from("adore_contents").update({ title: "hack" }, { count: "exact" }).eq("id", id("live"));
  expect(kUpd || !count, "keeper nggak bisa update langsung.", "keeper BISA update!");
  const { error: m1 } = await K.rpc("adore_mark", { p_id: id("live"), p_favorite: true, p_reaction: "smile" });
  const { data: after } = await A.from("adore_contents").select("opened_at, favorite, reaction").eq("id", id("live")).single();
  expect(!m1 && after.opened_at && after.favorite && after.reaction === "smile", "buka + favorit + reaksi tercatat.", `adore_mark gagal: ${m1?.message}`);
  const { error: m2 } = await K.rpc("adore_mark", { p_id: id("scheduled"), p_favorite: null, p_reaction: null });
  expect(m2, "adore_mark menolak yang masih tersegel.", "yang tersegel BISA dibuka!");
  const { error: m3 } = await A.rpc("adore_mark", { p_id: id("live"), p_favorite: false, p_reaction: null });
  expect(m3, "author nggak bisa menandai atas nama dia.", "author BISA menandai!");

  info("4. A Thousand Times, You — nomor otomatis, nggak dobel (0024)");
  const t = (title) => ({ ...row("published", past, title), content_type: "thousand", body: "" });
  const [r1, r2] = await Promise.all([
    A.from("adore_contents").insert(t("seribu-a")).select("number").single(),
    A.from("adore_contents").insert(t("seribu-b")).select("number").single(),
  ]);
  expect(
    !r1.error && !r2.error && r1.data.number !== r2.data.number && Math.abs(r1.data.number - r2.data.number) === 1,
    `dua simpan barengan dapat nomor beda (${r1.data?.number}, ${r2.data?.number}).`,
    `nomor gagal: ${r1.error?.message ?? r2.error?.message}`,
  );
  const { error: empty } = await A.from("adore_contents").insert({ ...row("draft", past, "kosong"), body: "" });
  expect(empty, "reason biasa tetap wajib ada isi.", "reason kosong LOLOS!");

  info("5. Surprise pool cuma dari yang boleh dia baca");
  await A.from("adore_contents").update({ in_pool: true }).in("id", [id("live"), id("draft"), id("scheduled")]);
  const { data: pool } = await K.from("adore_contents").select("id").eq("in_pool", true).like("title", `${TAG}%`);
  expect(pool?.length === 1 && pool[0].id === id("live"), "pool keeper cuma berisi yang live.", "pool BOCOR draft/terjadwal!");

  info("6. A Future With You — dua-duanya bisa memindahkan status (0025)");
  const { data: wish } = await A.from("adore_contents")
    .insert({ ...row("published", past, "wish"), content_type: "future_wish", wish_state: "someday" })
    .select("id")
    .single();
  const { error: w1 } = await K.rpc("adore_wish", { p_id: wish.id, p_state: "fulfilled", p_note: "akhirnya ke pantai" });
  const { data: w } = await A.from("adore_contents").select("wish_state, wish_note, fulfilled_at").eq("id", wish.id).single();
  expect(!w1 && w.wish_state === "fulfilled" && w.fulfilled_at && w.wish_note === "akhirnya ke pantai", "keeper menandai fulfilled + cerita.", `adore_wish gagal: ${w1?.message}`);
  const { error: w2 } = await K.rpc("adore_wish", { p_id: id("live"), p_state: "planned", p_note: null });
  expect(w2, "adore_wish menolak yang bukan wish.", "reason BISA jadi wish!");
  const { data: hidden } = await A.from("adore_contents")
    .insert({ ...row("draft", past, "draft-wish"), content_type: "future_wish" })
    .select("id")
    .single();
  const { error: w3 } = await K.rpc("adore_wish", { p_id: hidden.id, p_state: "planned", p_note: null });
  expect(w3, "keeper nggak bisa menyentuh wish yang masih draft.", "draft wish BISA diubah keeper!");

  info("7. Balasan + lokasi media (0026)");
  const { error: rp1 } = await K.rpc("adore_reply", { p_id: id("live"), p_text: "makasih ya ♡" });
  const { data: rr } = await A.from("adore_contents").select("reply_text, replied_at").eq("id", id("live")).single();
  expect(!rp1 && rr.reply_text === "makasih ya ♡" && rr.replied_at, "keeper membalas, author bisa baca.", `adore_reply gagal: ${rp1?.message}`);
  const { error: rp2 } = await K.rpc("adore_reply", { p_id: id("scheduled"), p_text: "intip" });
  expect(rp2, "balasan ke yang tersegel ditolak.", "yang tersegel BISA dibalas!");
  const { error: rp3 } = await A.rpc("adore_reply", { p_id: id("live"), p_text: "palsu" });
  expect(rp3, "author nggak bisa membalas atas nama dia.", "author BISA membalas!");
  const { error: badPath } = await A.from("adore_contents")
    .update({ photo_path: `${spaceId}/${keeper.user_id}/adore/x.jpg` })
    .eq("id", id("live"));
  expect(badPath, "foto di folder orang lain ditolak.", "path media orang lain DITERIMA!");
} finally {
  await admin.from("adore_contents").delete().like("title", `${TAG}%`);
  info("Data test dibersihkan.");
}
