/**
 * Bikin akun + satu "space" + surat awal. Dijalankan pakai service_role
 * (bypass RLS) — HANYA untuk setup lokal.
 *
 *   node --env-file=.env.local scripts/seed-space.mjs
 *
 * Wajib di .env.local:
 *   SEED_AUTHOR_EMAIL=...      SEED_AUTHOR_PASSWORD=...      (kamu)
 * Opsional (boleh nyusul — kosongin dulu kalau belum ada):
 *   SEED_KEEPER_EMAIL=...      SEED_KEEPER_PASSWORD=...      (dia)
 *
 * Aman dijalankan berkali-kali (idempotent). Jalanin lagi setelah ngisi email
 * keeper → akun dia otomatis ditambahkan ke space yang sama.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AUTHOR_EMAIL = process.env.SEED_AUTHOR_EMAIL;
const AUTHOR_PW = process.env.SEED_AUTHOR_PASSWORD;
const KEEPER_EMAIL = process.env.SEED_KEEPER_EMAIL;
const KEEPER_PW = process.env.SEED_KEEPER_PASSWORD;

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const note = (m) => console.log(`  \x1b[33m·\x1b[0m ${m}`);
const info = (m) => console.log(`\n\x1b[36m${m}\x1b[0m`);
const die = (m) => {
  console.log(`\n\x1b[31m✗ ${m}\x1b[0m\n`);
  process.exit(1);
};

if (!url || !service) die("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum ada.");
if (!AUTHOR_EMAIL || !AUTHOR_PW) die("Isi dulu SEED_AUTHOR_EMAIL & SEED_AUTHOR_PASSWORD di .env.local (akun kamu).");

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ensureUser(email, password, label) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) die(`gagal baca users — ${error.message}`);
  const existing = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    ok(`${label}: akun sudah ada (${email}).`);
    return existing;
  }
  if (!password) die(`${label}: SEED_..._PASSWORD kosong, gak bisa bikin akun ${email}.`);
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // langsung bisa login, tanpa verifikasi email
  });
  if (cErr) die(`gagal bikin akun ${label} — ${cErr.message}`);
  ok(`${label}: akun dibuat (${email}).`);
  return created.user;
}

async function addMember(spaceId, userId, role) {
  const { error } = await admin
    .from("space_members")
    .upsert({ space_id: spaceId, user_id: userId, role }, { onConflict: "space_id,user_id" });
  if (error) die(`gagal set anggota (${role}) — ${error.message}`);
}

info("1. Akun");
const author = await ensureUser(AUTHOR_EMAIL, AUTHOR_PW, "author (kamu)");
await admin.from("profiles").upsert({ id: author.id, display_name: "me" });

let keeper = null;
if (KEEPER_EMAIL) {
  keeper = await ensureUser(KEEPER_EMAIL, KEEPER_PW, "keeper (dia)");
  await admin.from("profiles").upsert({ id: keeper.id, display_name: "my love", nickname: "beautiful" });
} else {
  note("keeper (dia): email belum diisi — dilewati dulu, bisa nyusul.");
}

info("2. Space");
const { data: existing } = await admin.from("spaces").select("id").limit(1);
let spaceId;
if (existing && existing.length > 0) {
  spaceId = existing[0].id;
  ok("space sudah ada — dipakai lagi.");
} else {
  const { data: space, error } = await admin
    .from("spaces")
    .insert({ name: "our little universe", created_by: author.id })
    .select("id")
    .single();
  if (error) die(`gagal bikin space — ${error.message}`);
  spaceId = space.id;
  ok("space dibuat.");
}
await addMember(spaceId, author.id, "author");
ok("author terhubung ke space.");
if (keeper) {
  await addMember(spaceId, keeper.id, "keeper");
  ok("keeper terhubung ke space.");
}

info("3. Surat awal");
const { count } = await admin.from("letter_pool").select("*", { count: "exact", head: true });
if ((count ?? 0) > 0) {
  ok(`sudah ada ${count} surat — dilewati.`);
} else {
  const letters = [
    ["good_morning", "Selamat pagi. Sebelum harimu dimulai, aku cuma mau bilang: kamu nggak harus jadi sempurna hari ini. Cukup jadi kamu. Aku sudah bangga dari sini."],
    ["comfort", "Kalau hari ini terasa berat, letakkan dulu semuanya sebentar. Kamu boleh capek. Kamu boleh pelan. Aku di sini, dan aku nggak ke mana-mana."],
    ["romantic", "Aku suka cara kamu memperhatikan hal-hal kecil — hal yang orang lain lewatkan. Dunia jadi lebih hangat karena kamu melihatnya begitu."],
    ["good_night", "Hari ini sudah cukup. Apa pun yang belum selesai, biarkan menunggu sampai besok. Sekarang tutup matamu. Kamu aman. Selamat tidur, sayang."],
  ];
  const { error } = await admin.from("letter_pool").insert(
    letters.map(([category, body]) => ({ space_id: spaceId, category, body, author_id: author.id })),
  );
  if (error) die(`gagal isi surat — ${error.message}`);
  ok(`${letters.length} surat awal dimasukkan.`);
}

console.log("\n\x1b[32mSelesai! ♡\x1b[0m");
if (!keeper)
  console.log("\x1b[33mNanti kalau email dia udah dapet: isi SEED_KEEPER_EMAIL (+ PASSWORD) di .env.local, lalu jalankan `npm run seed:space` lagi.\x1b[0m");
console.log("");
process.exit(0);
