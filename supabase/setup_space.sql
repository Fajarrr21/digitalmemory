-- ============================================================================
--  setup_space — run ONCE after you've created the two accounts.
--
--  1. In Supabase → Authentication → Users, add two users (Add user →
--     "Create new user", set email + password). One is the Keeper (her),
--     one is the Author (you).
--  2. Disable public sign-ups: Authentication → Providers → Email →
--     turn OFF "Allow new users to sign up".
--  3. Edit the two emails below, then run this whole script in the SQL editor.
-- ============================================================================

do $$
declare
  keeper_email text := 'her@example.com';   -- << CHANGE ME
  author_email text := 'you@example.com';   -- << CHANGE ME (your account)
  keeper_id uuid;
  author_id uuid;
  space_id  uuid;
begin
  select id into keeper_id from auth.users where email = keeper_email;
  select id into author_id from auth.users where email = author_email;

  if keeper_id is null or author_id is null then
    raise exception 'Create both auth users first (keeper: %, author: %).', keeper_email, author_email;
  end if;

  -- Give them nicer names (edit freely later in the app).
  update public.profiles set display_name = 'my love', nickname = 'beautiful' where id = keeper_id;
  update public.profiles set display_name = 'me' where id = author_id;

  insert into public.spaces (name, created_by)
  values ('our little universe', author_id)
  returning id into space_id;

  insert into public.space_members (space_id, user_id, role) values
    (space_id, keeper_id, 'keeper'),
    (space_id, author_id, 'author');

  -- A few starter letters so day one isn't empty. REPLACE these with your own
  -- words in the app's Author mode — they should sound like you, not a template.
  insert into public.letter_pool (space_id, category, title, body, author_id) values
    (space_id, 'good_morning', null,
     'Selamat pagi. Sebelum harimu dimulai, aku cuma mau bilang: kamu nggak harus jadi sempurna hari ini. Cukup jadi kamu. Aku sudah bangga dari sini.', author_id),
    (space_id, 'comfort', null,
     'Kalau hari ini terasa berat, letakkan dulu semuanya sebentar. Kamu boleh capek. Kamu boleh pelan. Aku di sini, dan aku nggak ke mana-mana.', author_id),
    (space_id, 'romantic', null,
     'Aku suka cara kamu memperhatikan hal-hal kecil — hal yang orang lain lewatkan. Dunia jadi lebih hangat karena kamu melihatnya begitu.', author_id),
    (space_id, 'good_night', null,
     'Hari ini sudah cukup. Apa pun yang belum selesai, biarkan menunggu sampai besok. Sekarang tutup matamu. Kamu aman. Selamat tidur, sayang.', author_id);

  raise notice 'Space % ready. Keeper %, Author %.', space_id, keeper_id, author_id;
end $$;
