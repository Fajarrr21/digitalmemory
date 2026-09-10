# A little place made for you

**Live:** https://digitalmemory-two.vercel.app · Repo: github.com/Fajarrr21/digitalmemory · Deploy: Vercel (auto-deploys on push to `main`).

A private digital journal & love-letter space for one specific person. Not social
media, not an admin dashboard — a small, warm digital home. See the full plan:
https://claude.ai/code/artifact/7306fae6-d808-44ed-b085-e238b4786a1b

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase
(Auth + Postgres + Storage) · Vercel. Zod for validation, `motion` for animation,
`browser-image-compression` for client-side media, `date-fns` + `@date-fns/tz`
for timezone-aware dates, Vitest for unit tests.

## Commands
- `npm run dev` — dev server
- `npm run build` — production build (also runs TS check)
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Vitest unit tests

## First-time Supabase setup (required to actually run)
1. Create a project at supabase.com. Copy the URL + anon key + service-role key
   into `.env.local` (template in `.env.local.example`).
2. In the SQL editor, run `supabase/migrations/0001_init.sql` then
   `supabase/migrations/0002_rls.sql`.
3. Auth → Users: create two users (the Keeper = her, the Author = you).
   Auth → Providers → Email: turn OFF "Allow new users to sign up" (invite-only).
4. Edit the two emails in `supabase/setup_space.sql`, then run it once. It creates
   the shared space, memberships, and a few starter letters.

## Architecture notes / conventions
- **Two-person "space" model.** Every content row has `space_id`; RLS reduces to
  `is_member(space_id)` (+ `has_role(space_id,'author')` for author-only writes).
- **Roles:** `keeper` (her — journals) and `author` (you — writes letters, seeds
  messages). Author tooling lives under `/author` (built later), never a
  visible admin panel. NOTE: Our Little Universe memories are co-authored — both
  members add/delete them (migration 0007), so they're no longer author-only.
- **Supabase clients:** `lib/supabase/client.ts` (browser), `server.ts` (RSC/actions,
  runs as user, RLS on), `admin.ts` (service-role, RLS BYPASS — trusted server only,
  guarded by `server-only`). Session refresh + route guard in `proxy.ts`.
- **Timezone:** the user's day comes from `profiles.timezone`, computed server-side
  via `lib/date.ts`. Never trust UTC or the device clock for "today".
- **Daily Letter (Phase 2):** ONE per (recipient, date), enforced by DB unique
  constraint `uq_letter_per_day`. Assignment is race-safe via the admin client with
  `insert … on conflict do nothing` then re-read. Letter text is **snapshotted** onto
  `daily_letters` so editing the pool never rewrites history.
- **⚠ No runtime AI letter generation.** Letters come from a human-written
  `letter_pool` (they must sound like you, not AI). Any AI is an offline drafting aid.
- **Design system** in `app/globals.css`: semantic CSS-variable color tokens
  (`bg-ground`, `text-ink`, `bg-paper`, `text-accent-ink`, …) that auto-resolve for
  light / dark / system. Fonts: Fraunces (display), Instrument Sans (body), Caveat
  (handwritten accents), IBM Plex Mono (metadata). Keep pink an accent, not a flood.
- **Media:** private Storage bucket `media`, keys `{space_id}/{owner_id}/…`, served
  via short-lived signed URLs. Storage RLS mirrors table RLS.

## Structure
`app/(auth)` sign-in · `app/(app)` authed shell + feature pages · `app/auth/*` routes
· `lib/` supabase/date/greeting/auth/env · `components/` ui + nav · `supabase/`
migrations + setup.

## Status — MVP COMPLETE ✅
- Phase 1 Foundation · Phase 2 Daily Letter · Phase 3 Rating + Activity + media ·
  Phase 4 Timeline + Calendar · Phase 5 Our Memories — all done & verified against
  the live DB/Storage (scripts/test-*.mjs).
- Routes: `/` home · `/letter` · `/today` (rating + activity composer) · `/diary`
  timeline · `/diary/[date]` day detail · `/calendar` · `/us` Our Little Universe ·
  `/profile`. `/comfort` still a placeholder.
- **Note visibility + WhatsApp notifications (done, migrations 0003/0004).**
  `daily_activities.visibility` ('shared'|'private'): author sees everything
  (own + partner's) via `has_role`; keeper sees own always and author's entries
  only when shared. Author-only toggle in the `/today` composer. Saving a daily
  rating notifies the partner over WhatsApp (bidirectional) via the Fonnte
  gateway (`lib/notify/*`, `FONNTE_TOKEN`), capped at 2/day per person
  (`daily_ratings.notify_count`); best-effort, never blocks the save.
- **Partner timeline + voice notes (done, migration 0005).** Diary/Calendar/day
  detail have an "Aku / Dia" toggle (`?who=partner`) to view the partner's
  timeline (RLS-filtered); partner content is read-only. Voice notes: `media`
  gains type `'audio'` and a `rating_id` parent, recorded in-browser via
  MediaRecorder (`components/media/voice-recorder.tsx`), attachable to a daily
  activity and to a daily rating's story; played back with a signed URL.
- **Shared albums (done, migration 0006).** `/album` — many named albums
  (`albums` table); BOTH members create albums and upload photos/videos, and
  BOTH can delete any item or album (destructive deletes of the partner's files
  run via the admin client). `media` gains an `album_id` parent. Grid + lightbox
  viewer; uploads reuse the client compress+upload path.
- **Direct letters — bidirectional (done, migration 0009).** Separate from the
  auto-drip Daily Letter: `direct_letters` (`sender_id`/`recipient_id`, title,
  body, sealed→opened) lets EITHER member write a letter on the spot to their
  partner — so the keeper can write to the author, not only receive. RLS: both
  read (`is_member`), you send only AS yourself to the other member, only the
  recipient opens, sender may delete own. On `/letter`: a received inbox (sealed
  envelopes, tap to open) + a compose box addressed to the partner. Sending fires
  a best-effort WhatsApp heads-up (`lib/notify/letter.ts`), never blocks the send.
  Each direct letter can carry an optional **song** (Instagram-notes style): the
  sender pastes a Spotify track link (`song_track_id`/`song_title`/`song_image`
  columns in 0009), and the opened letter renders the official Spotify embed
  player. No API key — track id parsed via `lib/spotify.ts`, title/cover fetched
  best-effort from Spotify oEmbed at send time. No CSP in the app, so the embed
  iframe loads as-is.
  The composer (`letter-composer.tsx`) can send **a sequence of letters at once**
  (add/remove/reorder, ≤10, each with its own one song) via `sendLetterSequence`.
  A 2+ sequence shares a `batch_id` with per-letter `sort_index` (0009); a single
  letter has `batch_id = null`. **Sequential unlock**: the recipient's inbox keeps
  letter N locked until letter N-1 is opened (computed in `page.tsx` from the
  batch grouping; presentational gating — opening revalidates `/letter` to unlock
  the next). Inbox orders by `created_at desc, sort_index asc` so a sequence reads
  top→bottom 1→N with the newest send on top.
- Next (post-MVP, optional): Comfort Room, For You (special_messages), Night
  Reflection, unlockables, offline AI letter drafting. Then
  polish/a11y/perf pass and Vercel deploy.
- Accounts: author fajarardiansyah912@gmail.com (Testing#2007) / keeper
  auliaareregita@gmail.com (mygravita) — both live in Supabase, email-confirmed.
  SEED_* still in .env.local — remove before sharing the repo.
