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
  "We both showed up today." **Milestone popup**: opening Home when a
  milestone was newly reached shows a one-time (per device, localStorage
  `flame:celebrated:*`) full-screen celebration (`components/flame/
  milestone-celebration.tsx`: flame + DAY N + both photos + quote + manual
  Share-to-story); only the highest un-celebrated milestone shows, then all
  below are marked seen. **Avatar adjuster**: the profile photo opens an
  IG-style crop modal (pan by drag + zoom slider in a circular viewport,
  canvas-exported square) before upload.
- **A Little Photo Booth (done, migrations 0013 + 0014 — run both in the SQL
  editor).** `/photobooth` — "Two people. One little frame." Entry card on
  Home (not in the nav). Mode is chosen FIRST (Just Me / Both of Us), then the
  frame is picked **live**: the camera shows through the chosen frame's photo
  window with a thumbnail carousel underneath (`booth-stage.tsx`, the shared
  stage for both modes). **Frames are real image templates** (29 of them,
  `public/photobooth/frames/*.webp`, ~4 MB): curated from the user's
  frame-photobooth pack, their photo windows punched TRANSPARENT offline
  (scratchpad sharp tooling — flat-region detection + small-hole fill), so
  photos render BEHIND the template: tilted polaroids / curved TV screens clip
  themselves and decorations overlapping a window stay on top. Normalized slot
  bboxes live in `photobooth-config.ts` (`BOOTH_TEMPLATES`, 1–4 slots each);
  `compose-strip.ts` exports the strip at template aspect, 1920px tall.
  **👤 Just Me** is fully client-side (no DB): shoot each window in turn
  (3-2-1 countdown, mirrored, optional 🎲 pose prompt), tap a filled window to
  retake, ✨ compose → reveal → result. **♡ Both of Us** (session row id IS the
  invite link `/photobooth/session/{id}`; RLS `is_member`; signed-out partner
  round-trips via `/sign-in?next=…`): waiting → join → lobby ("You're both
  here ♡" — frame picked together on the live stage, either member; shot_count
  follows the template, migration 0014 relaxes the old (1,4) check) → **slots
  alternate creator⇄partner top-to-bottom**, each shoots their own windows on
  their own camera (uploads to `…/photobooth/{session}/`, one row per
  (member, shot) in `photobooth_photos`), partner windows show 🤫 until the
  shared reveal; sync is plain polling (2.5s `getBoothState`), no realtime.
  Unjoined sessions expire after 24h. 1-slot templates are solo-only
  (`DUO_TEMPLATES` filter). Result actions: ↓ Download · ♡ Save (album
  "My Photobooth"/"Our Photobooth" via `ensureBoothAlbum` + `addAlbumMedia`) ·
  ↗ Share (navigator.share → IG Story / WA Status, download fallback). Flame
  milestone celebration links to `/photobooth` ("A little milestone deserves a
  little memory"). **Photo source: camera OR gallery.** The stage has a
  📸 Kamera / 🖼️ Galeri toggle (`BoothSource` in `booth-stage.tsx`); in gallery
  mode no camera is requested at all — the empty window becomes a "＋ pilih
  foto" target and a hidden `<input type="file" accept="image/*" multiple>`
  fills it. Picked files are decoded with `createImageBitmap(…,
  {imageOrientation:"from-image"})` (EXIF-safe) and kept as a ≤2000px "working"
  image, un-mirrored, so both sources feed the same composer.
  **IG-story-style adjuster**: a picked photo lands in its window as a live
  pan/zoom — drag to move, two-finger pinch, mouse wheel (native non-passive
  listener; React's `onWheel` is passive) or a zoom slider, all rendered inside
  the real frame so it's WYSIWYG. Zoom is clamped to [1, 4] where 1 exactly
  covers the window, and the offset is clamped so a window can never show a
  gap. The maths is pure + unit-tested in `lib/booth-adjust.ts` (+ `.test.ts`);
  the component only turns pointer events into calls on it and works in the
  window's own export-pixel space (`slotOut`), bridged to screen px by one
  ResizeObserver on the stage. Keep bakes exactly what's shown. Picking several
  photos at once fills the remaining own windows cover-fitted; the stage holds
  each original (per frame) so tapping a window re-opens its adjuster with the
  last pan/zoom restored. Entry has a third card 🖼️ **From My Gallery**
  (= solo booth with `initialSource="upload"`); the duo shooting stage gets the
  toggle too, and a camera error now offers "🖼️ Pakai galeri". No WhatsApp
  anywhere in the booth — invites are shared by hand. Frame tooling lives in the session scratchpad (detect-slots.mjs /
  build-frames.mjs) — regenerate configs from new template JPGs if more frames
  are ever added.
- **Little Things To Do (done, migration 0015 — run it in the SQL editor).**
  `/tasks` — "So you don't have to keep everything in your head." PR, deadlines,
  errands, janji, hal kecil yang takut kelupaan. `tasks` (due_date + optional
  due_time, `assigned_to` null = BOTH of us, `started_at` = ◐ in progress,
  `repeat_kind`, `notify_whatsapp`), `task_completions` (one row per member —
  a solo thing is done when its assignee ticks it, a shared one only when BOTH
  do, so "Fajar ○ / Dia ✓" is readable), `task_reminders` (several per task:
  on the day / 1–2 days / 1 week before / custom, each with its own time;
  `remind_at` pinned to the owner's wall clock via `zonedDateTimeToUTC`). RLS:
  both members read/add/edit/delete the list (either may write a task FOR the
  other), but you can only ever tick your OWN box. Status is derived, never
  stored — pure + unit-tested in `lib/tasks/logic.ts` (+ `.test.ts`): upcoming /
  in-progress / completed / overdue, grouped TODAY · TOMORROW · THIS WEEK ·
  LATER · COMPLETED with overdue kept at the top (nothing is ever auto-deleted).
  **Quick Add** parses "PR matematika besok jam 8" offline — no AI — in
  `lib/tasks/parse.ts` (+ `.test.ts`: besok/lusa/weekday names/tanggal 30
  september/30-9/ISO, jam 8 vs jam 8 malam, filler stripping, emoji guess); it
  only ever pre-fills the form, the user confirms. **Reminders**: in-app nudges
  are derived from `remind_at` (showing one never consumes it) and surface in
  the 🔔 **reminder center** `/notifications` (task nudges + sealed letters +
  a waiting flame, with "oke ♡" to dismiss a nudge), badge in the app header.
  WhatsApp is **opt-in per task** (`notify_whatsapp`) and deliberately gentle
  (`lib/notify/task.ts` — "Sedikit pengingat dari space kita ♡", never a
  🚨 deadline alarm); assigning a task to the partner also sends a heads-up.
  There's no always-on worker, so `lib/tasks/dispatch.ts` runs from two places —
  the authed layout via `after()` whenever either of you opens the app, and
  `/api/cron/reminders` (guarded by `CRON_SECRET`, wired in `vercel.json` at
  01:00 UTC daily; Hobby allows one run/day, raise to hourly on Pro). Each
  reminder is **claimed** (`update … where sent_at is null` returning rows)
  before sending, so it can never go out twice; `sent_at` means only "the
  WhatsApp went out". Entry is the Home card (📝 Little Things → what's coming);
  a day with little things shows 📝 on `/calendar` and opens `/tasks?date=…`.
  Repeating things spawn the next occurrence when fully done, keeping history.
  Integration test: `node --env-file=.env.local scripts/test-tasks.mjs`.
- **Watch Together (done, migration 0016 — run it in the SQL editor).**
  `/watch` — "Bring something to watch. We'll watch it together." One room, one
  watching, two people, plus mic + chat. Home card adapts: no room → the
  three-line invitation; a live room → "{partner} is waiting for you. ♡" /
  "Kembali ke room". Not in the nav. Routes exactly as planned: `/watch` landing
  · `/watch/create` · `/watch/join/[token]` · `/watch/room/[roomId]` ·
  `/watch/history` · `/watch/[watchId]` (the last is a dynamic segment that
  Next resolves *after* the static ones; it 404s on anything that isn't a uuid).
  **Sources — YouTube is only one door** (`lib/watch/source.ts`, pure +
  unit-tested): `youtube` (IFrame Player API → genuinely synced), `file` (a
  direct video URL in `<video>` → genuinely synced), `embed` (someone else's
  page in an iframe → NOT controllable, so the room counts you in and says so
  instead of faking it). "Check video" (`checkWatchSource`) fetches the URL
  server-side, reads `content-type`, then `X-Frame-Options` / CSP
  `frame-ancestors` via `framingVerdict` and **takes no for an answer** — we
  never strip or work around a site's protection; a refusal becomes "⚠️ Can't
  play this video here". Titles/posters come from YouTube oEmbed or the page's
  own `og:` tags (best-effort, capped at 64KB of HTML).
  **The shared clock** is one claim on `watch_rooms` — `is_playing` +
  `position_seconds` + `position_at` ("we were at 12:43 as of then") — so a
  reload or a late join derives the present instead of waiting to be told.
  Maths is pure + unit-tested in `lib/watch/sync.ts` (+ `.test.ts`):
  `expectedPosition`, `shouldResync` (1.5s tolerance — below that a seek is
  more jarring than the drift), `claimAt`, `minutesTogether`. Transport is
  **Supabase Realtime** (the first use of it in this app — everything else
  polls): broadcast for play/pause/seek/chat/reactions/countdown + the WebRTC
  handshake, presence for watching / stepped away / on mic / speaking. The row
  is the durable truth and a 6s poll is the safety net; the host re-states its
  position every 5s (DB write only every 20s). Programmatic follows are guarded
  by a `suppressUntil` window so following a pause can't echo back as a new one.
  Room status only ever moves forward (`STATUS_RANK`), so a slow poll can't drag
  the room back to the lobby.
  **Voice** (`use-voice.ts`) is plain one-to-one WebRTC signalled over the same
  channel; the host always makes the offer. Public STUN only, no TURN — a
  hostile NAT can defeat it and the room says so rather than leaving a dead mic
  lit. Mic is OFF on arrival, never recorded, never stored. The speaking ring
  comes from a local RMS meter (rises instantly, falls slowly).
  **Lobby ready-ticks are load-bearing**, not decoration: each person's tap is
  the user gesture browsers require before audio may autoplay, so "Start
  watching" can actually start on both sides. Then 3 → 2 → 1 → PLAY, and the
  host publishes the play claim when it lands (`startWatching` deliberately
  leaves the row paused at 0, so a reload mid-countdown doesn't land 3s in).
  Other touches: 🎧 Quiet Watch (mic off, chat hidden, reactions kept),
  🍿 Snack break after a 45s pause, auto-pause when the partner steps away
  ("nobody gets left behind"), 💬 Little Chat persisted in `watch_messages`
  (optimistic send, reply, video timestamp) — a panel on desktop, a drawer on
  a phone. **Nothing here notifies** — no WhatsApp anywhere in Watch Together;
  invites are shared by hand, exactly like the photobooth.
  **Privacy:** no public rooms; the room id *is* the invite token; RLS is
  `is_member(space_id)` on all four tables, and you may only ever write chat or
  reactions AS yourself. The Realtime channel `watch:{roomId}` is opened as a
  **private** channel, gated by the `watch_rooms_realtime` policy on
  `realtime.messages` in 0016 (join `watch:<id>` only if you're a member of
  that room's space). That policy is a plain statement, NOT wrapped in an
  exception handler — an early version guarded it, which swallowed a real
  failure and reported success while the privacy boundary was off; it must fail
  loudly instead. At runtime the client still falls back once to a public
  channel on the same unguessable topic rather than breaking a room, logging a
  warning that names the migration. Unjoined rooms expire after 24h (checked in
  the actions, no cron). **Saving is optional**: "That's a wrap" offers a note,
  and `watch_memories` (one per room, `uq_watch_memory_per_room`, so both
  pressing Save edits one card) keeps title/minutes/💬/❤️ + the line. Counts are
  re-read from the tables, never trusted from the screen that pressed the
  button. A memory survives its room (`on delete set null`); it shows on
  `/watch/[watchId]`, in `/watch/history` ("Things We Watched"), and as a
  compact strip on `/us`.
  Integration test: `node --env-file=.env.local scripts/test-watch.mjs`.
  Note: `lib/youtube.ts` now owns the `window.YT` types + the one-time API
  loader — `/soundtrack` was refactored to import from it so the global is
  declared in exactly one place.
- **Sejauh Ini, Kita (done, migration 0017 — run it in the SQL editor).**
  `/journey` — "A story of how two people became “us”." A full-screen cinematic
  journey (like `/road`/`/someday`, explicit night palette, `motion`, full
  reduced-motion support) with the song *Kita Lewati Berdua* (Overnight) as its
  soul: one hidden YouTube IFrame API player that fades in on "Mulai
  perjalanan", is NOT looped, pauses while a Spotify/voice preview plays, and
  when it ends the last screen says "lagunya sudah selesai. jalannya belum."
  Flow: opening (two dots, two worlds, meeting on one road) → 01 When We Found
  Each Other (config `FIRSTS` + derived first day/first letter) → 02 Somewhere
  Along The Way (first-of-each-kind stones) → 03 Little Things We Did (the whole
  road, grouped by month, tap a stone → preview sheet with "Open →" into the
  real feature) → 04 The Days That Were Not Easy (rain, grey sky, optional
  hand-picked `HARD_DAYS` — never auto from chats) → 05 Even From Far Away
  (split road + counts of the ways we stayed present) → 06 We Know Each Other A
  Little Better Now (Things I Know About You) → "Wait. Look how far we've
  come." (road zooms out, numbers count up — not achievements, zeros hidden)
  → NOW ("This is us.") → the road ahead (empty dashed road, "let's keep
  going. ♡"). **The road is never stored**: `lib/journey/queries.ts` derives
  every footprint on read from the tables that own it (direct letters — a
  sequence = one stone, sealed ones keep their secret; first opened daily
  letter; our_memories; completed duo photobooth sessions; watch_memories;
  albums; first voice note / rating / coloring; SHARED meanwhile moments + songs;
  flame milestones re-derived from presence + bridges; first presence day = 🌱),
  so it grows by itself. Pure + unit-tested in `lib/journey/logic.ts`
  (`buildRoad`, `FIRST_ONLY` kinds, `groupLetters`, `flameMilestoneDates`,
  `daysTogether`, `journeyStats`). Only two things get tables (0017):
  `journey_notes` — **Presence Notes** ("🌙 Fajar left something here") left at
  a stop, found by the partner when they reach it; `journey_knowings` — written
  BY you ABOUT your partner (RLS + check forbid writing about yourself or as
  someone else). Neither ever notifies. Without 0017 the page still renders,
  just with the composers hidden (`writable=false`). All copy, the song, the
  `STARTED_ON` date and `FIRSTS` (✏️ fill them in — empty ones are hidden) live
  in `app/(app)/journey/journey-config.ts`. Home card shows the tip of the road
  + "N jejak · N hari · +N minggu ini". Not in the nav.
  Integration test: `node --env-file=.env.local scripts/test-journey.mjs`.
- Next (post-MVP, optional): Comfort Room, For You (special_messages), Night
  Reflection, unlockables, offline AI letter drafting. Then
  polish/a11y/perf pass and Vercel deploy.
- Accounts: author fajarardiansyah912@gmail.com (Testing#2007) / keeper
  auliaareregita@gmail.com (mygravita) — both live in Supabase, email-confirmed.
  SEED_* still in .env.local — remove before sharing the repo.
