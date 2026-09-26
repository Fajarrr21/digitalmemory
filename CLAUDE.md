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
- **Our Soundtrack (done, no DB/migration).** `/soundtrack` — a full-screen,
  config-driven journey through 24 curated songs, each carrying a hand-written
  message from the author. All content lives in `app/(app)/soundtrack/
  soundtrack-config.ts` (title/artist/`youtubeId`/`startSeconds`/`cover`/
  `message[]`); song count auto-derives from the array. Client component
  (`soundtrack.tsx`) uses the official **YouTube IFrame Player API** (loaded once,
  hidden audio-only player) for a real now-playing card: synced progress bar +
  time, play/pause, click-to-seek; cover falls back to the YT thumbnail. Progress
  hearts, resume via `localStorage` (`soundtrack:progress`), prev/next. The last
  song's music carries into a short closing screen → **Back to our space ♡**;
  deliberately does NOT link to `/bloom` (keeps that surprise separate). In the
  nav as "Songs".
- **Someday, With You (done, no DB/migration).** `/someday` — a slow, page-by-page
  cinematic journey about memories that *haven't happened yet* (tagline "Some
  memories haven't happened yet"). Deliberately **photo-less**: built entirely
  from typography, motion, and abstract line art. Like `/bloom`, it's a
  discoverable surprise and is **NOT in the nav** (reached by opening `/someday`).
  All copy lives in `app/(app)/someday/someday-config.ts`; the client component
  (`someday.tsx`) renders a sequence of "scenes" — opening → chapters → ending —
  cross-fading with `motion`, over floating particles + a warm glow. Chapter
  `kind`s: `prose` (tap-to-reveal beats, optional `art:"two-cups"` line
  illustration + `mood:"intimate"` for the hidden reassurance chapter), `cards`
  (tap prompt cards to reveal replies), `polaroid` (an intentionally empty frame,
  "Keep this empty ♡"), `checklist` (a "someday list" that stays unchecked). The
  ending darkens as it reveals a staggered someday-list, an epigraph, then
  replay / back. Optional ambient music via a hidden YouTube iframe (bloom-style
  `song.youtubeId`, mounted after "Begin" so autoplay works; `""` = no music,
  the default). Progress dots + a back-one-step arrow; full `useReducedMotion`
  support. **"Building Our Someday" visual layer** (`someday-art.tsx`, line-art
  only, no photos): a persistent bottom sketch that *grows* each chapter (one dot
  → two dots meeting → table/chairs → a window → a camera → plants → a warm
  lamp), a camera-click white flash on the empty-polaroid chapter, and at the
  ending all of it resolves into a small lit **house** (dusk sky, glowing window,
  path, swaying plants, two tiny figures, gentle zoom-out) — echoing the song
  "Kita Usahakan Rumah Itu". Purely additive: chapter flow/text unchanged.
- **The Road That Made Me (done, no DB/migration).** `/road` — a cinematic
  night→dawn journey in THREE acts about the author's own past: the things he
  lost, let go, and the road he's still walking. Like `/someday` & `/bloom` it's
  a discoverable surprise, **NOT in the nav** (reached by opening `/road`). All
  copy lives in `app/(app)/road/road-config.ts`; the client component
  (`road.tsx`) renders opening → act cards → chapters → a final **question** →
  one of two endings, cross-fading with `motion`. **One song per act, switched
  automatically** (config `acts[].song.youtubeId`, hidden looping YouTube iframe
  remounted by act, mute persisted via `&mute=`): Act I *Sesi Potret* (Enau ft.
  Ari Lesmana), Act II *Bunga Terakhir* (Romeo), Act III *Kita Usahakan Rumah
  Itu* (Sal Priadi); the Act II card is deliberately `silent` for a hush. A
  three-layer sky (night/heavy/dawn) cross-fades by act so the mood literally
  warms from night to morning; palette is explicit light-on-dark (not theme
  tokens) since it renders on its own dark backdrop. Line-art only, no photos
  (`road-art.tsx`): per-chapter motifs (a spark, two fires with one dimming, a
  form, train rails + city lights, a white cloth, ascending steps, an open road,
  two dots, a sunrise) + an intentionally empty graduation polaroid. The final
  question ("apakah kamu masih ingin berjalan bersamaku?") offers **two choices**
  — *tetap berjalan* → a warm ending where a small **home builds** stage by stage
  (chairs → table → plants → house → lamp on), or *butuh waktu* → a gentle,
  no-pressure ending that still offers to reconsider. Full `useReducedMotion`
  support; progress dots + back-one-step arrow.
- **How Today Felt — coloring (done, migration 0010).** An extension of the
  daily rating on `/today`: the rating save flow is unchanged (rating + message
  + WhatsApp), but on success it shows a "Your day is saved ♡" prompt offering
  **Selesai** or **🎨 Gambarkan Hariku**. Colouring opens an inline canvas
  (`how-today-felt.tsx`) — a *random* line-art scene (there's no literal mapping
  from the score) that the user taps to fill with a 14-colour palette
  (fill/undo/redo/reset/eraser/🎲 ganti gambar), then previews as a little
  "A Little Piece of Today" memory card and taps **Simpan ke Diary**. Stored as
  **vector data, not an image**: `daily_coloring` (0010) holds `template_id` +
  a `fills` jsonb region→colour map (one per rating, `uq_coloring_per_rating`;
  RLS mirrors `daily_ratings` — members read, owner writes). Scenes + palette
  live in `app/(app)/today/coloring-config.ts`; the shared renderer
  `components/coloring/coloring-svg.tsx` (`currentColor` strokes, theme-aware) is
  reused interactively and read-only on `/today` and the diary day page
  (`lib/coloring.ts` reads it). **Colouring never sends WhatsApp** — only the
  rating save does. **Share to story**: after saving (and on the diary day
  page) a "📤 Bagikan ke story" button (`components/coloring/
  coloring-share-button.tsx`) renders the memory card as a 1080×1920 PNG on a
  canvas (`components/coloring/share-card.ts`, fixed warm light palette +
  next/font families) and hands it to `navigator.share` with the file — on a
  phone that surfaces IG Story / WA Status; desktops without file share get a
  download instead.
- **Meanwhile… (done, migration 0011).** `/meanwhile` — a little space to visit
  while the other is busy living their own life. Home card adapts to the
  partner's **manual away status** (`away_status`: working/playing/outside/
  sleeping/busy; set on /meanwhile, NO live tracking ever). Each visit draws
  ONE random **Moment** from a config pool (`meanwhile-config.ts`): 💭 tiny
  question · 🎲 pick one · 📸 tiny photo (storage `…/meanwhile/`, key kept in
  payload — not the `media` table) · 🎧 Spotify song (oEmbed like letters) ·
  🎨 little creation (reuses coloring templates) · 🫶 from-me (rare, ✏️ author-
  edited config) · ✉️ micro-letter (very rare) · 🧩 memory/find-the-heart/
  reaction · 🌱 slow down (10s countdown) · 😈 silly. Rules: skip is always
  free ("Not feeling it →"), ONE moment per visit (localStorage-gated soft
  gate), keeping is optional, sharing is manual ("Send to partner" =
  `shared` flag, RLS lets the partner read only shared rows), and NOTHING
  notifies (no WhatsApp here by design). Kept moments live in
  `meanwhile_moments` (payload jsonb per category) and show in
  `/meanwhile/archive` grouped by day with emotional milestone copy at
  7/10/25 ("little collection"). Client experience in `meanwhile.tsx`
  (motion, typewriter title, floating dust, full reduced-motion support).
- **Our Little Flame (done, migration 0012).** Presence streak: a flame day =
  BOTH members opened the app that calendar day (own profile timezone).
  Presence recorded by `recordPresence` in the authed layout on any page view
  (`presence_days`, insert-only) — deliberately NO forced midnight logout and
  no activity requirement: opening the app *is* showing up. Streak math is
  pure + unit-tested (`lib/flame-logic.ts` + `.test.ts`), computed on read
  from presence rows — statuses lit / waiting ("🕯️ waiting for one more") /
  quiet / out, plus derived run history (never deleted). **Flame Recovery**:
  a one-day gap can be patched via `flame_recoveries` (unique per space+day,
  either member, max 5 per calendar month) — a deliberate button ("Restore
  Flame" / "Let it rest"), never automatic. The flame **evolves visually** by
  tier (`flame-config.ts`: First Spark → … → Eternal Flame; scale/colors/
  glow/particles/sparkles) via `components/flame/flame.tsx` (CSS teardrop
  layers + motion, reduced-motion safe). `/flame`: big flame, month calendar
  (🔥 days, 🕯️ bridged), milestones (1/3/10/30/50/100/150/200/365, each with
  its own line) with **story share cards** (canvas 1080×1920, both avatars +
  quote, `share-flame-card.ts`, navigator.share → IG/WA), history, recovery
  count. Profile revamped: photo (upload/replace/remove, centre-square crop +
  resize client-side to `…/avatar/`, used on profile/flame/share card), name +
  "nickname", flame summary card → View Streak, editable name/nickname/
  birthday (`edit-profile.tsx`). Tone rule: never guilt, no countdowns —
  "We both showed up today."
- Next (post-MVP, optional): Comfort Room, For You (special_messages), Night
  Reflection, unlockables, offline AI letter drafting. Then
  polish/a11y/perf pass and Vercel deploy.
- Accounts: author fajarardiansyah912@gmail.com (Testing#2007) / keeper
  auliaareregita@gmail.com (mygravita) — both live in Supabase, email-confirmed.
  SEED_* still in .env.local — remove before sharing the repo.
