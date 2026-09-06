import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.argv[2] ?? process.env.SEED_AUTHOR_EMAIL;
const password = process.argv[3] ?? process.env.SEED_AUTHOR_PASSWORD;

console.log("email:", JSON.stringify(email));
console.log("password length:", password ? password.length : "(kosong)");

const supabase = createClient(url, anon, { auth: { persistSession: false } });
const { data, error } = await supabase.auth.signInWithPassword({ email, password });

if (error) {
  console.log("\n\x1b[31mLOGIN GAGAL:\x1b[0m", error.status, "-", error.message, "(code:", error.code + ")");
} else {
  console.log("\n\x1b[32mLOGIN BERHASIL\x1b[0m — user:", data.user.email, "id:", data.user.id);
}
process.exit(error ? 1 : 0);
