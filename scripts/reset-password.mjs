/**
 * Reset password satu akun (pakai service_role). Setup lokal saja.
 *   node --env-file=.env.local scripts/reset-password.mjs <email> <password-baru>
 */
import { createClient } from "@supabase/supabase-js";

const [email, newPassword] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !newPassword) {
  console.log("Pakai: node --env-file=.env.local scripts/reset-password.mjs <email> <password-baru>");
  process.exit(1);
}

const admin = createClient(url, service, { auth: { persistSession: false } });
const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (error) {
  console.log("✗ gagal baca users:", error.message);
  process.exit(1);
}
const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.log(`✗ akun ${email} tidak ditemukan.`);
  process.exit(1);
}
const { error: uErr } = await admin.auth.admin.updateUserById(user.id, {
  password: newPassword,
  email_confirm: true,
});
if (uErr) {
  console.log("✗ gagal update password:", uErr.message);
  process.exit(1);
}
console.log(`\x1b[32m✓ Password untuk ${email} sudah direset.\x1b[0m`);
process.exit(0);
