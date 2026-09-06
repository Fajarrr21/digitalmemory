/**
 * Integration test buat Activity + Media — lawan DB + Storage asli (service role).
 *   node --env-file=.env.local scripts/test-media.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

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

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const { data: keeper } = await admin
  .from("space_members")
  .select("user_id, space_id")
  .eq("role", "keeper")
  .maybeSingle();
if (!keeper) {
  bad("keeper tidak ada.");
  process.exit(1);
}
const spaceId = keeper.space_id;
const userId = keeper.user_id;
const group = randomUUID();
const path = `${spaceId}/${userId}/${group}/test.png`;
const D = "2099-12-29";

let activityId;
try {
  info("1. Upload ke Storage (bucket privat 'media')");
  const up = await admin.storage.from("media").upload(path, PNG_1x1, { contentType: "image/png", upsert: true });
  if (up.error) bad(`upload gagal: ${up.error.message}`);
  else ok(`terupload: ${path}`);

  info("2. Buat activity + media row");
  const { data: act, error: aErr } = await admin
    .from("daily_activities")
    .insert({ space_id: spaceId, user_id: userId, activity_date: D, title: "test momen" })
    .select("id")
    .single();
  if (aErr) throw aErr;
  activityId = act.id;
  ok(`activity dibuat (${activityId}).`);

  const { error: mErr } = await admin.from("media").insert({
    space_id: spaceId,
    owner_id: userId,
    activity_id: activityId,
    type: "image",
    storage_path: path,
    mime: "image/png",
    size_bytes: PNG_1x1.length,
    width: 1,
    height: 1,
  });
  if (mErr) bad(`insert media gagal: ${mErr.message}`);
  else ok("media row tersimpan.");

  info("3. Signed URL bisa diakses");
  const { data: signed } = await admin.storage.from("media").createSignedUrls([path], 60);
  const url = signed?.[0]?.signedUrl;
  if (!url) bad("gagal bikin signed URL.");
  else {
    const res = await fetch(url);
    if (res.status === 200) ok(`signed URL OK (HTTP 200, ${res.headers.get("content-type")}).`);
    else bad(`signed URL balik HTTP ${res.status}.`);
  }

  info("4. Constraint 'satu induk' (media tanpa parent harus ditolak)");
  const { error: cErr } = await admin.from("media").insert({
    space_id: spaceId,
    owner_id: userId,
    type: "image",
    storage_path: `${spaceId}/${userId}/${group}/orphan.png`,
    mime: "image/png",
    size_bytes: 1,
  });
  if (cErr) ok(`ditolak (${cErr.code}).`);
  else bad("media tanpa induk malah keterima!");
} finally {
  info("5. Bersih-bersih");
  await admin.storage.from("media").remove([path]);
  if (activityId) await admin.from("daily_activities").delete().eq("id", activityId);
  ok("storage + activity (cascade media) dibersihkan.");
}

console.log(
  process.exitCode === 1
    ? "\n\x1b[31mAda test gagal.\x1b[0m\n"
    : "\n\x1b[32mActivity + Media lulus semua. ♡\x1b[0m\n",
);
