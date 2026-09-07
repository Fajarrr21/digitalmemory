/**
 * Update akun keeper: ganti email placeholder -> email asli, set password.
 *   node --env-file=.env.local scripts/update-keeper.mjs
 * Baca OLD_EMAIL dari argv[2], SEED_KEEPER_EMAIL / SEED_KEEPER_PASSWORD dari env.
 */
import { createClient } from "@supabase/supabase-js";

const oldEmail = process.argv[2] || "emaildia@contoh.com";
const newEmail = process.env.SEED_KEEPER_EMAIL;
const newPassword = process.env.SEED_KEEPER_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!newEmail || !newPassword) {
  console.log("✗ SEED_KEEPER_EMAIL / SEED_KEEPER_PASSWORD belum diisi di .env.local");
  process.exit(1);
}

const admin = createClient(url, service, { auth: { persistSession: false } });
const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (error) {
  console.log("✗ gagal baca users:", error.message);
  process.exit(1);
}

// Cari keeper: dulu placeholder, atau mungkin sudah email baru (idempoten).
let user =
  data.users.find((u) => u.email?.toLowerCase() === oldEmail.toLowerCase()) ||
  data.users.find((u) => u.email?.toLowerCase() === newEmail.toLowerCase());

if (!user) {
  console.log(`✗ akun keeper tidak ketemu (cari ${oldEmail} atau ${newEmail}).`);
  console.log("   users yang ada:", data.users.map((u) => u.email).join(", "));
  process.exit(1);
}

const { error: uErr } = await admin.auth.admin.updateUserById(user.id, {
  email: newEmail,
  password: newPassword,
  email_confirm: true,
});
if (uErr) {
  console.log("✗ gagal update:", uErr.message);
  process.exit(1);
}
console.log(`\x1b[32m✓ Keeper diupdate: ${user.email} -> ${newEmail}, password di-set.\x1b[0m`);
console.log(`  user id: ${user.id}`);
process.exit(0);
