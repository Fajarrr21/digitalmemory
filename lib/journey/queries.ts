import "server-only";
import { createClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/media";
import { getFlameData } from "@/lib/flame";
import { localDateISO } from "@/lib/date";
import { MILESTONES } from "@/app/(app)/flame/flame-config";
import type { JourneyStop } from "@/lib/supabase/database.types";
import {
  buildRoad,
  daysTogether,
  flameMilestoneDates,
  groupLetters,
  journeyStats,
  type Footprint,
  type JourneyStat,
} from "./logic";

/**
 * Sejauh Ini, Kita — everything the journey reads, gathered from the tables that
 * already own it. Runs as the viewer (RLS on), so the road only ever shows what
 * this person is allowed to see; anything private to the partner never walks
 * onto it. A table that doesn't exist yet (migration not run) just contributes
 * nothing — the road is a nicety and must never break a page.
 */

export type PresenceNote = {
  id: string;
  stop: JourneyStop;
  authorId: string;
  body: string;
  createdAt: string;
};

export type Knowing = {
  id: string;
  authorId: string;
  aboutId: string;
  emoji: string;
  label: string;
  body: string;
};

export type JourneyWays = Record<
  "meanwhile" | "watch" | "voice" | "letters" | "ratings" | "flame",
  number
>;

export type JourneyData = {
  today: string;
  /** The day the story is counted from (config, else the first footprint). */
  startDate: string | null;
  road: Footprint[];
  stats: JourneyStat[];
  ways: JourneyWays;
  notes: PresenceNote[];
  knowings: Knowing[];
  /** False until migration 0017 has been run — the composers hide themselves. */
  writable: boolean;
};

type Viewer = {
  spaceId: string;
  userId: string;
  partnerId: string | null;
  timezone: string;
};

const EXCERPT = 180;
const excerpt = (s: string | null | undefined) =>
  !s ? null : s.length > EXCERPT ? `${s.slice(0, EXCERPT).trimEnd()}…` : s;

/** `?who=partner` when the diary day belongs to the other person. */
const diaryHref = (date: string, ownerId: string, viewerId: string) =>
  `/diary/${date}${ownerId === viewerId ? "" : "?who=partner"}`;

/**
 * Collect every footprint candidate + the raw counts. `withPreviews` signs
 * storage URLs for the little preview cards — the Home glance skips that.
 */
async function collect(v: Viewer, withPreviews: boolean) {
  const supabase = await createClient();
  const day = (instant: string) => localDateISO(v.timezone, new Date(instant));
  const count = (r: { count: number | null }) => r.count ?? 0;

  const [
    letters,
    dailyFirst,
    dailyOpened,
    memories,
    booths,
    watchMems,
    watchSessions,
    albums,
    voiceFirst,
    voiceCount,
    ratingFirst,
    ratingCount,
    coloringFirst,
    coloringCount,
    meanwhile,
    activities,
    presenceFirst,
  ] = await Promise.all([
    supabase
      .from("direct_letters")
      .select("id, sender_id, recipient_id, title, body, song_track_id, batch_id, sort_index, status, created_at")
      .eq("space_id", v.spaceId)
      .order("created_at", { ascending: true })
      .limit(1000),
    supabase
      .from("daily_letters")
      .select("id, letter_date, recipient_id, title, body")
      .eq("space_id", v.spaceId)
      .eq("status", "opened")
      .order("letter_date", { ascending: true })
      .limit(1),
    supabase
      .from("daily_letters")
      .select("id", { count: "exact", head: true })
      .eq("space_id", v.spaceId)
      .eq("status", "opened"),
    supabase
      .from("our_memories")
      .select("id, title, description, memory_date, created_at, created_by")
      .eq("space_id", v.spaceId)
      .limit(1000),
    supabase
      .from("photobooth_sessions")
      .select("id, creator_id, updated_at")
      .eq("space_id", v.spaceId)
      .eq("status", "completed")
      .limit(500),
    supabase
      .from("watch_memories")
      .select("id, title, poster_url, note, watched_date, created_by")
      .eq("space_id", v.spaceId)
      .limit(500),
    supabase
      .from("watch_rooms")
      .select("id", { count: "exact", head: true })
      .eq("space_id", v.spaceId)
      .not("started_at", "is", null),
    supabase
      .from("albums")
      .select("id, title, created_at, created_by")
      .eq("space_id", v.spaceId)
      .limit(500),
    supabase
      .from("media")
      .select("id, owner_id, storage_path, rating_id, activity_id, created_at")
      .eq("space_id", v.spaceId)
      .eq("type", "audio")
      .order("created_at", { ascending: true })
      .limit(1),
    supabase
      .from("media")
      .select("id", { count: "exact", head: true })
      .eq("space_id", v.spaceId)
      .eq("type", "audio"),
    supabase
      .from("daily_ratings")
      .select("id, user_id, rating_date, score")
      .eq("space_id", v.spaceId)
      .order("rating_date", { ascending: true })
      .limit(1),
    supabase
      .from("daily_ratings")
      .select("id", { count: "exact", head: true })
      .eq("space_id", v.spaceId),
    supabase
      .from("daily_coloring")
      .select("id, user_id, rating_id, created_at")
      .eq("space_id", v.spaceId)
      .order("created_at", { ascending: true })
      .limit(1),
    supabase
      .from("daily_coloring")
      .select("id", { count: "exact", head: true })
      .eq("space_id", v.spaceId),
    // Only what was SHARED — even your own private moments stay off "our" road.
    supabase
      .from("meanwhile_moments")
      .select("id, user_id, category, prompt, payload, moment_date")
      .eq("space_id", v.spaceId)
      .eq("shared", true)
      .limit(1000),
    supabase
      .from("daily_activities")
      .select("id", { count: "exact", head: true })
      .eq("space_id", v.spaceId)
      .eq("visibility", "shared"),
    supabase
      .from("presence_days")
      .select("day")
      .eq("space_id", v.spaceId)
      .order("day", { ascending: true })
      .limit(1),
  ]);

  const flame = await getFlameData(v.spaceId, v.userId, v.partnerId, v.timezone);

  // ---- storage paths that the previews need signed --------------------------
  const boothIds = (booths.data ?? []).map((b) => b.id);
  const memoryIds = (memories.data ?? []).map((m) => m.id);
  const [boothPhotos, memoryMedia, voiceDay, coloringRating] = await Promise.all([
    withPreviews && boothIds.length > 0
      ? supabase
          .from("photobooth_photos")
          .select("session_id, storage_path, shot_index")
          .in("session_id", boothIds)
          .order("shot_index", { ascending: true })
      : Promise.resolve({ data: [] as { session_id: string; storage_path: string }[] }),
    withPreviews && memoryIds.length > 0
      ? supabase
          .from("media")
          .select("memory_id, storage_path, type, created_at")
          .in("memory_id", memoryIds)
          .eq("type", "image")
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as { memory_id: string | null; storage_path: string }[] }),
    // Which diary day the first voice note belongs to.
    (async () => {
      const vn = voiceFirst.data?.[0];
      if (!vn) return null;
      if (vn.rating_id) {
        const { data } = await supabase
          .from("daily_ratings")
          .select("rating_date, user_id")
          .eq("id", vn.rating_id)
          .maybeSingle();
        return data ? { date: data.rating_date, owner: data.user_id } : null;
      }
      if (vn.activity_id) {
        const { data } = await supabase
          .from("daily_activities")
          .select("activity_date, user_id")
          .eq("id", vn.activity_id)
          .maybeSingle();
        return data ? { date: data.activity_date, owner: data.user_id } : null;
      }
      return null;
    })(),
    (async () => {
      const c = coloringFirst.data?.[0];
      if (!c) return null;
      const { data } = await supabase
        .from("daily_ratings")
        .select("rating_date")
        .eq("id", c.rating_id)
        .maybeSingle();
      return data?.rating_date ?? null;
    })(),
  ]);

  const firstBoothPhoto = new Map<string, string>();
  for (const p of boothPhotos.data ?? []) {
    if (!firstBoothPhoto.has(p.session_id)) firstBoothPhoto.set(p.session_id, p.storage_path);
  }
  const firstMemoryImage = new Map<string, string>();
  for (const m of memoryMedia.data ?? []) {
    if (m.memory_id && !firstMemoryImage.has(m.memory_id)) {
      firstMemoryImage.set(m.memory_id, m.storage_path);
    }
  }
  const meanwhilePhotoPaths = (meanwhile.data ?? [])
    .map((m) => (m.category === "photo" ? (m.payload as { path?: string }).path : undefined))
    .filter((p): p is string => typeof p === "string" && p.length > 0);
  const voicePath = voiceFirst.data?.[0]?.storage_path;

  const signed = withPreviews
    ? await signPaths([
        ...firstBoothPhoto.values(),
        ...firstMemoryImage.values(),
        ...meanwhilePhotoPaths,
        ...(voicePath ? [voicePath] : []),
      ])
    : {};
  const sign = (p: string | undefined | null) => (p ? (signed[p] ?? null) : null);

  // ---- footprint candidates -------------------------------------------------
  const candidates: Footprint[] = [];

  const firstPresence = presenceFirst.data?.[0]?.day;
  if (firstPresence) {
    candidates.push({
      id: `start:${firstPresence}`,
      kind: "start",
      date: firstPresence,
      label: null,
      byId: null,
      href: null,
    });
  }

  const letterRows = (letters.data ?? []).map((l) => ({
    ...l,
    batchId: l.batch_id,
    sortIndex: l.sort_index,
    date: day(l.created_at),
  }));
  for (const { lead, count: n } of groupLetters(letterRows)) {
    // A letter still sealed for the viewer keeps its secret on the road too.
    const sealed = lead.status === "sealed" && lead.recipient_id === v.userId;
    candidates.push({
      id: `letter:${lead.id}`,
      kind: "letter",
      date: lead.date,
      label: sealed ? null : lead.title,
      byId: lead.sender_id,
      href: "/letter",
      count: n,
      preview: withPreviews
        ? {
            sealed,
            text: sealed ? null : excerpt(lead.body),
            spotifyTrackId: sealed ? null : lead.song_track_id,
          }
        : undefined,
    });
  }

  const daily = dailyFirst.data?.[0];
  if (daily) {
    candidates.push({
      id: `daily:${daily.id}`,
      kind: "daily-letter",
      date: daily.letter_date,
      label: daily.title,
      byId: null,
      href: "/letter",
      preview: withPreviews ? { text: excerpt(daily.body) } : undefined,
    });
  }

  for (const m of memories.data ?? []) {
    candidates.push({
      id: `memory:${m.id}`,
      kind: "memory",
      date: m.memory_date ?? day(m.created_at),
      label: m.title,
      byId: m.created_by,
      href: "/us",
      preview: withPreviews
        ? { text: excerpt(m.description), image: sign(firstMemoryImage.get(m.id)) }
        : undefined,
    });
  }

  for (const b of booths.data ?? []) {
    candidates.push({
      id: `booth:${b.id}`,
      kind: "photobooth",
      date: day(b.updated_at),
      label: null,
      byId: null,
      href: `/photobooth/session/${b.id}`,
      preview: withPreviews ? { image: sign(firstBoothPhoto.get(b.id)) } : undefined,
    });
  }

  for (const w of watchMems.data ?? []) {
    candidates.push({
      id: `watch:${w.id}`,
      kind: "watch",
      date: w.watched_date,
      label: w.title,
      byId: null,
      href: `/watch/${w.id}`,
      preview: withPreviews ? { image: w.poster_url, text: w.note } : undefined,
    });
  }

  for (const a of albums.data ?? []) {
    candidates.push({
      id: `album:${a.id}`,
      kind: "album",
      date: day(a.created_at),
      label: a.title,
      byId: a.created_by,
      href: `/album/${a.id}`,
    });
  }

  const vn = voiceFirst.data?.[0];
  if (vn) {
    candidates.push({
      id: `voice:${vn.id}`,
      kind: "voice",
      date: voiceDay?.date ?? day(vn.created_at),
      label: null,
      byId: vn.owner_id,
      href: voiceDay ? diaryHref(voiceDay.date, voiceDay.owner, v.userId) : null,
      preview: withPreviews ? { audio: sign(vn.storage_path) } : undefined,
    });
  }

  const r = ratingFirst.data?.[0];
  if (r) {
    candidates.push({
      id: `rating:${r.id}`,
      kind: "rating",
      date: r.rating_date,
      label: null,
      byId: r.user_id,
      href: diaryHref(r.rating_date, r.user_id, v.userId),
      preview: withPreviews ? { text: `${r.score}/10` } : undefined,
    });
  }

  const c = coloringFirst.data?.[0];
  if (c) {
    const date = coloringRating ?? day(c.created_at);
    candidates.push({
      id: `coloring:${c.id}`,
      kind: "coloring",
      date,
      label: null,
      byId: c.user_id,
      href: diaryHref(date, c.user_id, v.userId),
    });
  }

  let songCount = letterRows.filter((l) => !!l.song_track_id).length;
  for (const m of meanwhile.data ?? []) {
    const p = m.payload as Record<string, unknown>;
    const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : null);
    if (m.category === "song") {
      songCount += 1;
      candidates.push({
        id: `song:${m.id}`,
        kind: "song",
        date: m.moment_date,
        label: str("title"),
        byId: m.user_id,
        href: "/meanwhile/archive",
        preview: withPreviews ? { spotifyTrackId: str("trackId"), text: m.prompt } : undefined,
      });
      continue;
    }
    const answer = str("answer") ?? str("choice");
    candidates.push({
      id: `meanwhile:${m.id}`,
      kind: "meanwhile",
      date: m.moment_date,
      label: m.prompt,
      byId: m.user_id,
      href: "/meanwhile/archive",
      preview: withPreviews
        ? { text: answer, image: m.category === "photo" ? sign(str("path")) : null }
        : undefined,
    });
  }

  for (const ms of flameMilestoneDates(
    flame.flameDays,
    flame.bridgedDays,
    MILESTONES.map((m) => m.day),
  )) {
    const meta = MILESTONES.find((m) => m.day === ms.day);
    candidates.push({
      id: `flame:${ms.day}`,
      kind: "flame",
      date: ms.date,
      label: `Day ${ms.day}${meta ? ` — ${meta.title}` : ""}`,
      byId: null,
      href: "/flame",
      preview: withPreviews && meta ? { text: meta.line } : undefined,
    });
  }

  const meanwhileShared = (meanwhile.data ?? []).length;
  const letterCount = letterRows.length + count(dailyOpened);

  return {
    candidates,
    today: flame.today,
    counts: {
      letters: letterCount,
      memories: (memories.data ?? []).length,
      watch: count(watchSessions),
      photobooth: boothIds.length,
      flame: flame.flameDays.length,
      songs: songCount,
      voice: count(voiceCount),
      moments: count(activities) + meanwhileShared + count(coloringCount),
    },
    ways: {
      meanwhile: meanwhileShared,
      watch: count(watchSessions),
      voice: count(voiceCount),
      letters: letterCount,
      ratings: count(ratingCount),
      flame: flame.flameDays.length,
    } satisfies JourneyWays,
  };
}

/** The whole journey, previews and all — for /journey. */
export async function getJourney(v: Viewer, startedOn: string): Promise<JourneyData> {
  const supabase = await createClient();
  const [collected, notes, knowings] = await Promise.all([
    collect(v, true),
    supabase
      .from("journey_notes")
      .select("id, stop, author_id, body, created_at")
      .eq("space_id", v.spaceId)
      .order("created_at", { ascending: true }),
    supabase
      .from("journey_knowings")
      .select("id, author_id, about_id, emoji, label, body")
      .eq("space_id", v.spaceId)
      .order("created_at", { ascending: true }),
  ]);

  const road = buildRoad(collected.candidates);
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(startedOn) ? startedOn : (road[0]?.date ?? null);

  return {
    today: collected.today,
    startDate,
    road,
    stats: journeyStats({ days: daysTogether(startDate, collected.today), ...collected.counts }),
    ways: collected.ways,
    notes: (notes.data ?? []).map((n) => ({
      id: n.id,
      stop: n.stop,
      authorId: n.author_id,
      body: n.body,
      createdAt: n.created_at,
    })),
    knowings: (knowings.data ?? []).map((k) => ({
      id: k.id,
      authorId: k.author_id,
      aboutId: k.about_id,
      emoji: k.emoji,
      label: k.label,
      body: k.body,
    })),
    writable: !notes.error && !knowings.error,
  };
}

/** Just the road (no signed previews) — the Home card's little glance. */
export async function getJourneyGlance(v: Viewer, startedOn: string) {
  const collected = await collect(v, false);
  const road = buildRoad(collected.candidates);
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(startedOn) ? startedOn : (road[0]?.date ?? null);
  return {
    today: collected.today,
    road,
    days: daysTogether(startDate, collected.today),
  };
}
