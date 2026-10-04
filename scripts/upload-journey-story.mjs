/**
 * Upload foto/video "cerita awal kita" (Sejauh Ini, Kita) ke Storage privat.
 *   node --env-file=.env.local scripts/upload-journey-story.mjs <folder>
 *
 * <folder> berisi file dengan nama persis seperti `key` di
 * app/(app)/journey/story-config.ts (tanpa prefix `journey-story/`):
 *   first-call.jpg · dunia-1.jpg · reel.mp4
 * Disimpan ke `media/{space_id}/journey-story/<nama>` (upsert — aman diulang).
 * File-nya sengaja TIDAK disimpan di repo / public/: cuma anggota space yang
 * bisa membukanya, lewat signed URL.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("pakai: node --env-file=.env.local scripts/upload-journey-story.mjs <folder>");
  process.exit(1);
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".mp4": "video/mp4" };

const { data: spaces, error } = await admin.from("spaces").select("id").limit(2);
if (error || !spaces?.length) {
  console.error("space tidak ditemukan:", error?.message);
  process.exit(1);
}
if (spaces.length > 1) {
  console.error("lebih dari satu space — script ini mengira cuma ada satu.");
  process.exit(1);
}
const spaceId = spaces[0].id;

for (const name of readdirSync(dir)) {
  const type = TYPES[extname(name).toLowerCase()];
  if (!type) continue;
  const path = `${spaceId}/journey-story/${name}`;
  const { error: upErr } = await admin.storage
    .from("media")
    .upload(path, readFileSync(join(dir, name)), { contentType: type, upsert: true });
  console.log(upErr ? `  ✗ ${name}: ${upErr.message}` : `  ✓ ${name} → ${path}`);
  if (upErr) process.exitCode = 1;
}
