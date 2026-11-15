/**
 * Integration test buat Roll the Love Dice (migration 0029) — lawan DB beneran.
 *   node --env-file=.env.local scripts/test-dice.mjs
 * Game nggak bisa ditulis dari client; tantangan rahasia nggak kebaca pasangan;
 * kenangan milik berdua; satu kenangan per giliran. Data test dihapus di akhir.
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
const TAG = "__test_dice__";

info("0. Tabel dari migration 0029");
for (const table of ["dice_games", "dice_players", "dice_turns", "dice_custom", "dice_memories"]) {
  const { error } = await admin.from(table).select("*").limit(1);
  if (error) {
    bad(`tabel ${table} belum ada — jalanin dulu supabase/migrations/0029_love_dice.sql di SQL editor. (${error.message})`);
    process.exit(1);
  }
}
ok("semua tabel Roll the Love Dice siap.");

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
let gameId = null;

try {
  info("1. Game cuma lewat server");
  const { error: cIns } = await A.from("dice_games").insert({ space_id: spaceId, created_by: author.user_id });
  expect(cIns, "client ditolak bikin game.", "client BISA bikin game!");
  // pakai game live yang ada kalau ada, biar nggak nabrak unique index
  const { data: live } = await admin.from("dice_games").select("id").eq("space_id", spaceId).in("status", ["lobby", "playing"]).maybeSingle();
  if (live) {
    ok("ada game live — tes tulis-game pakai itu (nggak diubah).");
    gameId = null;
  } else {
    const { data: g } = await admin.from("dice_games").insert({ space_id: spaceId, created_by: author.user_id }).select("id").single();
    gameId = g.id;
  }
  const target = gameId ?? live.id;
  const { data: kSee } = await K.from("dice_games").select("id").eq("id", target);
  expect(kSee?.length === 1, "anggota bisa baca game.", "anggota NGGAK bisa baca game.");
  const { data: kUpd } = await K.from("dice_games").update({ done_count: 999 }).eq("id", target).select("id");
  expect(!kUpd?.length, "client nggak bisa ubah game.", "client BISA ubah game!");

  info("2. Tantangan rahasia");
  const { data: made, error: aIns } = await A.from("dice_custom")
    .insert([
      { space_id: spaceId, author_id: author.user_id, category: "sweet", text: `${TAG} biasa`, secret: false },
      { space_id: spaceId, author_id: author.user_id, category: "sweet", text: `${TAG} rahasia`, secret: true },
    ])
    .select("id, text");
  expect(!aIns && made?.length === 2, "author nulis 2 tantangan.", `gagal nulis: ${aIns?.message}`);
  const { data: kCustom } = await K.from("dice_custom").select("text").like("text", `${TAG}%`);
  expect(kCustom?.length === 1 && kCustom[0].text.endsWith("biasa"), "pasangan cuma lihat yang bukan rahasia.", `pasangan lihat: ${kCustom?.map((x) => x.text)}`);
  const { error: kFake } = await K.from("dice_custom").insert({ space_id: spaceId, author_id: author.user_id, category: "sweet", text: `${TAG} palsu` });
  expect(kFake, "nggak bisa nulis atas nama pasangan.", "BISA nulis atas nama pasangan!");
  const { data: kDel } = await K.from("dice_custom").delete().eq("id", made[0].id).select("id");
  expect(!kDel?.length, "nggak bisa hapus punya pasangan.", "BISA hapus punya pasangan!");

  info("3. Kenangan milik berdua, satu per giliran");
  const g2 = gameId ?? (await admin.from("dice_games").insert({ space_id: spaceId, created_by: author.user_id, status: "ended" }).select("id").single()).data.id;
  if (!gameId) gameId = g2;
  const { data: turn } = await admin
    .from("dice_turns")
    .insert({ game_id: g2, space_id: spaceId, player_id: keeper.user_id, category: "sweet", cards: [{ key: "t", text: TAG, kind: "a" }], status: "done" })
    .select("id")
    .single();
  const mem = { space_id: spaceId, turn_id: turn.id, game_id: g2, player_id: keeper.user_id, category: "sweet", challenge: TAG };
  const { data: m1, error: mErr } = await A.from("dice_memories").insert({ ...mem, saved_by: author.user_id }).select("id").single();
  expect(!mErr, "anggota bisa simpan kenangan.", `gagal simpan: ${mErr?.message}`);
  const { error: dup } = await K.from("dice_memories").insert({ ...mem, saved_by: keeper.user_id });
  expect(dup?.code === "23505", "giliran yang sama nggak tersimpan dua kali.", `duplikat lolos: ${dup?.message}`);
  const { data: kNote } = await K.from("dice_memories").update({ note: "aww", favorite: true }).eq("id", m1.id).select("id");
  expect(kNote?.length === 1, "pasangan bisa kasih catatan + favorit.", "pasangan NGGAK bisa kasih catatan.");
} finally {
  await admin.from("dice_custom").delete().like("text", `${TAG}%`);
  await admin.from("dice_memories").delete().eq("challenge", TAG);
  if (gameId) await admin.from("dice_games").delete().eq("id", gameId);
  info("bersih-bersih selesai.");
}
