/**
 * Integration test buat Watch Together (migration 0016) — lawan DB beneran.
 *   node --env-file=.env.local scripts/test-watch.mjs
 *
 * Login-nya lewat sesi yang dibikin service role, jadi nggak butuh SEED_*_PASSWORD.
 *
 * Menguji: tabel ada, RLS (dua-duanya boleh baca + menggerakkan room, tapi cuma
 * boleh nulis chat/reaksi ATAS NAMA SENDIRI), satu memory per room, dan cascade
 * saat room dihapus. Semua baris test dipakein judul bertanda dan dihapus lagi
 * di akhir, jadi aman dijalanin berkali-kali.
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

const TAG = "[test-watch]";

info("0. Tabel dari migration 0016");
const { error: missing } = await admin.from("watch_rooms").select("id").limit(1);
if (missing) {
  bad(
    `tabel watch_rooms belum ada — jalanin dulu supabase/migrations/0016_watch_together.sql di SQL editor. (${missing.message})`,
  );
  process.exit(1);
}
ok("watch_rooms / watch_messages / watch_reactions / watch_memories siap.");

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
await admin.from("watch_rooms").delete().eq("space_id", spaceId).like("title", `${TAG}%`);
await admin.from("watch_memories").delete().eq("space_id", spaceId).like("title", `${TAG}%`);

info("1. Author buka room (dia jadi host)");
const { data: room, error: e1 } = await asAuthor
  .from("watch_rooms")
  .insert({
    space_id: spaceId,
    host_id: author.user_id,
    source_kind: "youtube",
    source_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    video_id: "dQw4w9WgXcQ",
    title: `${TAG} Jujutsu Kaisen`,
    subtitle: "Episode 12",
  })
  .select("id, status")
  .single();
if (e1 || !room) {
  bad(`gagal buka room: ${e1?.message}`);
  process.exit(1);
}
ok(`room kebikin, status "${room.status}" — id-nya juga token undangannya.`);

info("2. Host nggak bisa ngaku-ngaku orang lain");
const { error: e2 } = await asAuthor.from("watch_rooms").insert({
  space_id: spaceId,
  host_id: keeper.user_id,
  source_kind: "youtube",
  source_url: "https://youtu.be/dQw4w9WgXcQ",
  title: `${TAG} bukan punyaku`,
});
if (e2) ok(`ditolak RLS (${e2.code}).`);
else bad("BAHAYA: author bisa bikin room atas nama keeper.");

info("3. Keeper bisa baca room itu, lalu masuk");
const { data: seen } = await asKeeper
  .from("watch_rooms")
  .select("id, title")
  .eq("id", room.id)
  .maybeSingle();
if (seen) ok(`kebaca keeper: "${seen.title}"`);
else bad("keeper nggak bisa baca room pasangannya (RLS kelewat ketat).");

const { error: e3 } = await asKeeper
  .from("watch_rooms")
  .update({ guest_id: keeper.user_id, status: "ready" })
  .eq("id", room.id);
if (e3) bad(`keeper gagal masuk room: ${e3.message}`);
else ok("keeper masuk, status → ready.");

info("4. Dua-duanya boleh menggerakkan playback (siapa pun bisa pause)");
const { error: e4a } = await asKeeper
  .from("watch_rooms")
  .update({
    status: "watching",
    started_at: new Date().toISOString(),
    is_playing: true,
    position_seconds: 0,
    position_at: new Date().toISOString(),
    updated_by: keeper.user_id,
  })
  .eq("id", room.id);
const { error: e4b } = await asAuthor
  .from("watch_rooms")
  .update({
    is_playing: false,
    position_seconds: 763,
    position_at: new Date().toISOString(),
    updated_by: author.user_id,
  })
  .eq("id", room.id);
if (e4a || e4b) bad(`harusnya dua-duanya boleh: ${e4a?.message ?? ""} ${e4b?.message ?? ""}`);
else ok("keeper mulai, author pause di 12:43 — dua-duanya diterima.");

info("5. Chat: cuma boleh atas nama sendiri");
const { data: line, error: e5a } = await asKeeper
  .from("watch_messages")
  .insert({
    room_id: room.id,
    space_id: spaceId,
    user_id: keeper.user_id,
    body: "ANJIRRR 😭",
    at_seconds: 763,
  })
  .select("id")
  .single();
if (e5a) bad(`keeper gagal nulis pesannya sendiri: ${e5a.message}`);
else ok("pesan keeper masuk.");

const { error: e5b } = await asKeeper.from("watch_messages").insert({
  room_id: room.id,
  space_id: spaceId,
  user_id: author.user_id,
  body: "pura-pura jadi dia",
});
if (e5b) ok(`nulis atas nama orang lain ditolak RLS (${e5b.code}).`);
else bad("BAHAYA: keeper bisa nulis chat atas nama author.");

const { data: authorSees } = await asAuthor
  .from("watch_messages")
  .select("id")
  .eq("id", line?.id ?? "00000000-0000-0000-0000-000000000000");
if (authorSees?.length === 1) ok("author bisa baca pesan keeper.");
else bad("pasangan nggak bisa baca chat room-nya sendiri.");

info("6. Reaksi kehitung buat memory");
for (const emoji of ["❤️", "😂", "😭"]) {
  await asAuthor.from("watch_reactions").insert({
    room_id: room.id,
    space_id: spaceId,
    user_id: author.user_id,
    emoji,
  });
}
const { count: reactions } = await admin
  .from("watch_reactions")
  .select("*", { count: "exact", head: true })
  .eq("room_id", room.id);
if (reactions === 3) ok("3 reaksi tercatat.");
else bad(`harusnya 3 reaksi, dapat ${reactions}`);

info("7. Satu memory per room (simpan dua kali = ngedit yang sama)");
const payload = {
  space_id: spaceId,
  room_id: room.id,
  created_by: author.user_id,
  title: `${TAG} Jujutsu Kaisen`,
  subtitle: "Episode 12",
  source_kind: "youtube",
  source_url: "https://youtu.be/dQw4w9WgXcQ",
  watched_date: "2099-12-30",
  minutes: 24,
  message_count: 1,
  reaction_count: 3,
  note: "Kita malah lebih banyak ketawa daripada nonton 😭",
};
const { data: mem, error: e7a } = await asAuthor
  .from("watch_memories")
  .upsert(payload, { onConflict: "room_id" })
  .select("id")
  .single();
if (e7a || !mem) bad(`gagal simpan memory: ${e7a?.message}`);
else ok("memory tersimpan.");

const { error: e7b } = await asKeeper
  .from("watch_memories")
  .upsert({ ...payload, created_by: keeper.user_id, note: "aku juga nyimpen" }, { onConflict: "room_id" })
  .select("id")
  .single();
const { count: memCount } = await admin
  .from("watch_memories")
  .select("*", { count: "exact", head: true })
  .eq("room_id", room.id);
if (!e7b && memCount === 1) ok("keeper nyimpen juga → tetap satu kartu, cuma ter-update.");
else bad(`harusnya tetap 1 memory, dapat ${memCount} (${e7b?.message ?? "tanpa error"})`);

info("8. Channel Realtime privat: cuma anggota space yang boleh gabung");
/**
 * Yang beneran dicek di sini: policy `watch_rooms_realtime` di realtime.messages
 * (blok `do` di akhir migration 0016). Kalau policy-nya nggak kebikin, channel
 * privat bakal ditolak — dan di app-nya itu diam-diam jatuh ke channel publik,
 * jadi ini satu-satunya cara tahu bedanya.
 */
async function joinPrivate(client, roomId, label) {
  const channel = client.channel(`watch:${roomId}`, { config: { private: true } });
  const status = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve("TIMEOUT"), 12000);
    channel.subscribe((s) => {
      if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
        clearTimeout(timer);
        resolve(s);
      }
    });
  });
  await client.removeChannel(channel);
  return { status, label };
}

const mine = await joinPrivate(asKeeper, room.id, "keeper");
if (mine.status === "SUBSCRIBED") {
  ok("keeper bisa gabung channel privat room-nya.");
} else if (mine.status === "CHANNEL_ERROR") {
  bad(
    "channel privat ditolak — policy realtime-nya nggak kebikin. Jalanin ulang blok `do $$ ... $$` di akhir 0016 (app-nya tetap jalan, tapi lewat channel publik).",
  );
} else {
  bad(`channel privat nggak ngasih jawaban (${mine.status}).`);
}

// Cuma berarti kalau channel privatnya emang kepakai: kalau semua ditolak,
// "ditolak" di sini nggak membuktikan apa-apa.
if (mine.status === "SUBSCRIBED") {
  const strangerTopic = "00000000-0000-0000-0000-0000000000ff";
  const outsider = await joinPrivate(asKeeper, strangerTopic, "room asing");
  if (outsider.status === "CHANNEL_ERROR") ok("room yang bukan miliknya ditolak.");
  else bad(`BAHAYA: channel room asing malah ${outsider.status} — policy-nya kelewat longgar.`);
} else {
  console.log("  [33m–[0m cek room asing dilewati (channel privatnya belum aktif).");
}

info("9. Hapus room → chat & reaksi ikut hilang, memory tetap ada");
await asAuthor.from("watch_rooms").delete().eq("id", room.id);
const { count: orphanMsgs } = await admin
  .from("watch_messages")
  .select("*", { count: "exact", head: true })
  .eq("room_id", room.id);
const { data: survivor } = await admin
  .from("watch_memories")
  .select("id, room_id")
  .eq("id", mem?.id ?? "00000000-0000-0000-0000-000000000000")
  .maybeSingle();
if (orphanMsgs === 0) ok("chat ikut kehapus (cascade).");
else bad(`masih ada ${orphanMsgs} pesan nyangkut.`);
if (survivor && survivor.room_id === null) ok("memory-nya selamat, room_id jadi null.");
else bad("memory ikut kehapus — padahal kenangannya harus tetap ada.");

info("10. Beres-beres");
await admin.from("watch_memories").delete().eq("space_id", spaceId).like("title", `${TAG}%`);
await admin.from("watch_rooms").delete().eq("space_id", spaceId).like("title", `${TAG}%`);
const { data: left } = await admin.from("watch_rooms").select("id").like("title", `${TAG}%`);
const { data: leftMem } = await admin.from("watch_memories").select("id").like("title", `${TAG}%`);
if ((left?.length ?? 0) === 0 && (leftMem?.length ?? 0) === 0) ok("semua baris test kehapus.");
else bad(`masih ada sisa: ${left?.length ?? 0} room, ${leftMem?.length ?? 0} memory.`);

console.log(
  process.exitCode ? "\n\x1b[31mAda yang gagal.\x1b[0m" : "\n\x1b[32mSemua lolos ♡\x1b[0m",
);
