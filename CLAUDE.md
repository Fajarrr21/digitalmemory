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
  memories/messages). Author tooling lives under `/author` (built later), never a
  visible admin panel.
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
- Next (post-MVP, optional): Comfort Room, For You (special_messages), Night
  Reflection, unlockables, offline AI letter drafting. Then
  polish/a11y/perf pass and Vercel deploy.
- Accounts: author fajarardiansyah912@gmail.com (Testing#2007) / keeper
  auliaareregita@gmail.com (mygravita) — both live in Supabase, email-confirmed.
  SEED_* still in .env.local — remove before sharing the repo.
