"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSpaceContext } from "@/lib/auth";
import { localDateISO } from "@/lib/date";
import type { WatchSourceKind } from "@/lib/supabase/database.types";
import {
  classifySource,
  extractOgImage,
  extractPageTitle,
  framingVerdict,
  isStreamPlaylist,
  kindFromContentType,
  titleFromUrl,
} from "@/lib/watch/source";
import { clampToDuration, isControllable, minutesTogether } from "@/lib/watch/sync";
import { getMemoryForRoom, getRoom, isRoomAlive, type WatchRoomRow } from "@/lib/watch/queries";
import { CHAT_MAX, REACTIONS, sourceNote } from "./watch-config";

/**
 * Watch Together — the server side. Every action re-derives the space context;
 * RLS underneath is the real gate. Rooms are driven by BOTH members (either of
 * you may pause, seek, or call it a night), so the policies are deliberately
 * symmetric and these actions don't add a host-only rule the UI would have to
 * apologise for.
 */

export type WatchActionResult = { ok?: boolean; error?: string; id?: string };

/** Our own origin — what a site's frame-ancestors / ALLOW-FROM is checked against. */
async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// ---------------------------------------------------------------------------
//  "Check video" — can this actually play inside the room?
// ---------------------------------------------------------------------------

export type CheckedSource = {
  kind: WatchSourceKind;
  url: string;
  videoId: string | null;
  title: string;
  posterUrl: string | null;
  /** What the room can and can't do with it. */
  note: string;
  /** A caveat worth showing even though it passed (e.g. HLS in Chrome). */
  warning?: string;
};

export type SourceCheck = { ok?: boolean; error?: string; source?: CheckedSource };

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 64 * 1024;
const UA = "Mozilla/5.0 (compatible; ALittlePlace WatchTogether/1.0)";

/**
 * Ask the source whether it can be shown here — and take no for an answer.
 * Nothing in this path strips or works around a site's protection: we read the
 * two headers browsers enforce and, if they say no, the room says no too.
 */
export async function checkWatchSource(rawUrl: string): Promise<SourceCheck> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const guess = classifySource(rawUrl ?? "");
  if (!guess) return { error: "Itu belum kelihatan seperti link. Tempel alamat lengkapnya ya. ♡" };

  if (guess.kind === "youtube") {
    const meta = await youtubeMeta(guess.videoId);
    return {
      ok: true,
      source: {
        kind: "youtube",
        url: guess.url,
        videoId: guess.videoId,
        title: meta.title ?? "YouTube video",
        posterUrl: meta.poster ?? `https://i.ytimg.com/vi/${guess.videoId}/hqdefault.jpg`,
        note: sourceNote("youtube"),
      },
    };
  }

  if (guess.kind === "file") {
    const head = await probe(guess.url, "HEAD");
    if (head.error) return { error: head.error };
    // A "file" URL that turns out to serve HTML is really a page.
    if (kindFromContentType(head.contentType) === "page") {
      return checkPage(guess.url, await appOrigin());
    }
    return {
      ok: true,
      source: {
        kind: "file",
        url: guess.url,
        videoId: null,
        title: titleFromUrl(guess.url),
        posterUrl: null,
        note: sourceNote("file"),
        warning: isStreamPlaylist(guess.url)
          ? "Ini stream (.m3u8/.mpd) — beberapa browser (Chrome di laptop) nggak bisa memainkannya langsung. Kalau layarnya kosong, coba link lain ya."
          : undefined,
      },
    };
  }

  return checkPage(guess.url, await appOrigin());
}

async function checkPage(url: string, origin: string): Promise<SourceCheck> {
  const res = await probe(url, "GET");
  if (res.error) return { error: res.error };

  // Some hosts hand a direct video file off a pretty URL — then it's a file.
  if (kindFromContentType(res.contentType) === "file") {
    return {
      ok: true,
      source: {
        kind: "file",
        url,
        videoId: null,
        title: titleFromUrl(url),
        posterUrl: null,
        note: sourceNote("file"),
      },
    };
  }

  const verdict = framingVerdict(
    { xFrameOptions: res.xFrameOptions, contentSecurityPolicy: res.csp },
    origin,
  );
  if (!verdict.allowed) {
    return {
      error:
        verdict.reason ??
        "Situs ini nggak mengizinkan videonya diputar di dalam aplikasi lain.",
    };
  }

  const html = res.body ?? "";
  return {
    ok: true,
    source: {
      kind: "embed",
      url,
      videoId: null,
      title: extractPageTitle(html) ?? titleFromUrl(url),
      posterUrl: extractOgImage(html, url),
      note: sourceNote("embed"),
    },
  };
}

type Probe = {
  error?: string;
  contentType: string | null;
  xFrameOptions: string | null;
  csp: string | null;
  body?: string;
};

/** One careful request. Never follows a non-http scheme, never reads more than
 *  a page's head, and always gives up after a few seconds. */
async function probe(url: string, method: "HEAD" | "GET"): Promise<Probe> {
  const empty: Probe = { contentType: null, xFrameOptions: null, csp: null };
  try {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      cache: "no-store",
      headers: { "user-agent": UA, accept: "*/*" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (res.status === 401 || res.status === 403) {
      await res.body?.cancel().catch(() => {});
      return { ...empty, error: "Situs ini nggak mengizinkan kita mengambil videonya." };
    }
    if (!res.ok && res.status !== 405) {
      await res.body?.cancel().catch(() => {});
      return { ...empty, error: `Linknya nggak bisa dibuka (${res.status}). Coba link lain ya.` };
    }

    const out: Probe = {
      contentType: res.headers.get("content-type"),
      xFrameOptions: res.headers.get("x-frame-options"),
      csp:
        res.headers.get("content-security-policy") ??
        res.headers.get("content-security-policy-report-only"),
    };

    if (method === "GET") out.body = await readCapped(res);
    else await res.body?.cancel().catch(() => {});
    return out;
  } catch {
    return { ...empty, error: "Linknya nggak bisa dijangkau. Cek lagi alamatnya ya." };
  }
}

/** Read at most the first 64KB — enough for <head>, never a whole video. */
async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
      }
    }
  } catch {
    // partial is fine — we only wanted the head
  } finally {
    await reader.cancel().catch(() => {});
  }
  const merged = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    merged.set(c.subarray(0, Math.min(c.byteLength, total - at)), at);
    at += c.byteLength;
    if (at >= total) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

/** Title + cover for a YouTube id. oEmbed, so no API key. Best-effort. */
async function youtubeMeta(videoId: string): Promise<{ title: string | null; poster: string | null }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${videoId}`,
      )}&format=json`,
      { signal: AbortSignal.timeout(6000), cache: "no-store" },
    );
    if (!res.ok) return { title: null, poster: null };
    const j = (await res.json().catch(() => null)) as {
      title?: string;
      thumbnail_url?: string;
    } | null;
    return { title: j?.title ?? null, poster: j?.thumbnail_url ?? null };
  } catch {
    return { title: null, poster: null };
  }
}

// ---------------------------------------------------------------------------
//  Room lifecycle
// ---------------------------------------------------------------------------

const CreateSchema = z.object({
  kind: z.enum(["youtube", "file", "embed"]),
  url: z.string().trim().min(4).max(2000),
  videoId: z.string().trim().max(32).nullable().optional(),
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(200).optional().default(""),
  posterUrl: z.string().trim().max(1000).nullable().optional(),
});

export type CreateRoomInput = z.input<typeof CreateSchema>;

/**
 * Open a room. One room, one watching: whatever else was still open in this
 * space is closed first, so an invite link never points at a stale night.
 */
export async function createWatchRoom(input: CreateRoomInput): Promise<WatchActionResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { error: "Ada yang belum pas dengan videonya. Coba cek lagi ya." };
  const d = parsed.data;

  // Re-validate the URL rather than trusting a client round-trip.
  const guess = classifySource(d.url);
  if (!guess) return { error: "Linknya nggak valid." };
  if (guess.kind === "youtube" && d.kind !== "youtube") return { error: "Linknya nggak valid." };

  const supabase = await createClient();

  await supabase
    .from("watch_rooms")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("space_id", ctx.spaceId)
    .neq("status", "ended");

  const { data, error } = await supabase
    .from("watch_rooms")
    .insert({
      space_id: ctx.spaceId,
      host_id: ctx.userId,
      source_kind: d.kind,
      source_url: guess.url,
      video_id: d.kind === "youtube" ? (d.videoId ?? null) : null,
      title: d.title,
      subtitle: d.subtitle && d.subtitle.length > 0 ? d.subtitle : null,
      poster_url: d.posterUrl && d.posterUrl.length > 0 ? d.posterUrl : null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "Gagal membuka room. Coba lagi ya. ♡" };
  revalidatePath("/watch");
  return { ok: true, id: data.id };
}

export type RoomSnapshot = {
  id: string;
  status: WatchRoomRow["status"];
  sourceKind: WatchSourceKind;
  sourceUrl: string;
  videoId: string | null;
  title: string;
  subtitle: string | null;
  posterUrl: string | null;
  hostId: string;
  guestId: string | null;
  hostName: string;
  guestName: string | null;
  isPlaying: boolean;
  positionSeconds: number;
  /** Epoch ms — the client's playback clock works in numbers. */
  positionAt: number;
  durationSeconds: number | null;
  updatedBy: string | null;
  startedAt: string | null;
  endedAt: string | null;
  expired: boolean;
  controllable: boolean;
  /** Set once someone has saved the wrap card. */
  memoryId: string | null;
};

/** The poll target + what the room page renders from. */
export async function getRoomState(
  roomId: string,
): Promise<{ ok?: boolean; error?: string; room?: RoomSnapshot }> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const room = await getRoom(roomId);
  if (!room || room.spaceId !== ctx.spaceId) return { error: "Room ini nggak ditemukan." };

  const supabase = await createClient();
  const ids = [room.hostId, room.guestId].filter((v): v is string => !!v);
  const [{ data: profiles }, memory] = await Promise.all([
    supabase.from("profiles").select("id, nickname, display_name").in("id", ids),
    getMemoryForRoom(room.id),
  ]);

  const nameOf = (id: string | null) => {
    if (!id) return null;
    const p = (profiles ?? []).find((x) => x.id === id);
    return p ? p.nickname || p.display_name : "…";
  };

  return {
    ok: true,
    room: {
      id: room.id,
      status: room.status,
      sourceKind: room.sourceKind,
      sourceUrl: room.sourceUrl,
      videoId: room.videoId,
      title: room.title,
      subtitle: room.subtitle,
      posterUrl: room.posterUrl,
      hostId: room.hostId,
      guestId: room.guestId,
      hostName: nameOf(room.hostId) ?? "…",
      guestName: nameOf(room.guestId),
      isPlaying: room.isPlaying,
      positionSeconds: room.positionSeconds,
      positionAt: new Date(room.positionAt).getTime(),
      durationSeconds: room.durationSeconds,
      updatedBy: room.updatedBy,
      startedAt: room.startedAt,
      endedAt: room.endedAt,
      expired: !isRoomAlive(room),
      controllable: isControllable(room.sourceKind),
      memoryId: memory?.id ?? null,
    },
  };
}

/** Take the invite. The host "joining" their own room is a no-op. */
export async function joinWatchRoom(roomId: string): Promise<WatchActionResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const room = await getRoom(roomId);
  if (!room || room.spaceId !== ctx.spaceId) return { error: "Room ini nggak ditemukan." };
  if (room.status === "ended") return { error: "Room ini sudah ditutup. Buka yang baru ya. ♡" };
  if (!isRoomAlive(room))
    return { error: "Undangan ini sudah kedaluwarsa. Minta link baru ya. ♡" };
  if (room.hostId === ctx.userId) return { ok: true };
  if (room.guestId && room.guestId !== ctx.userId) return { error: "Room ini sudah penuh." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("watch_rooms")
    .update({
      guest_id: ctx.userId,
      status: room.status === "waiting" ? "ready" : room.status,
    })
    .eq("id", roomId);
  if (error) return { error: "Gagal masuk room. Coba lagi ya." };
  revalidatePath("/watch");
  return { ok: true };
}

/** 3 → 2 → 1 → PLAY. Either of you may start it, once you're both here. */
export async function startWatching(roomId: string): Promise<WatchActionResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const room = await getRoom(roomId);
  if (!room || room.spaceId !== ctx.spaceId) return { error: "Room ini nggak ditemukan." };
  if (!room.guestId) return { error: "Pasanganmu belum masuk room." };
  if (room.status === "watching") return { ok: true };

  const now = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase
    .from("watch_rooms")
    .update({
      status: "watching",
      started_at: room.startedAt ?? now,
      // Still paused at zero: the 3 → 2 → 1 countdown runs in the room, and the
      // host publishes "playing" when it lands. That way a reload during the
      // countdown doesn't arrive three seconds into the film.
      is_playing: false,
      position_seconds: 0,
      position_at: now,
      updated_by: ctx.userId,
    })
    .eq("id", roomId)
    .eq("status", "ready");
  if (error) return { error: "Gagal memulai. Coba lagi ya." };
  return { ok: true };
}

const PlaybackSchema = z.object({
  isPlaying: z.boolean(),
  positionSeconds: z.number().min(0).max(24 * 3600),
  durationSeconds: z.number().min(0).max(24 * 3600).nullable().optional(),
});

/**
 * Write the shared clock: "we are HERE, as of now." Either member may do it —
 * whoever pauses is simply the last one to speak. Broadcast carries the same
 * change instantly; this row is what a reload or a late join reads.
 */
export async function updatePlayback(
  roomId: string,
  state: z.input<typeof PlaybackSchema>,
): Promise<WatchActionResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const parsed = PlaybackSchema.safeParse(state);
  if (!parsed.success) return { error: "Posisi videonya nggak valid." };
  const { isPlaying, positionSeconds, durationSeconds } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("watch_rooms")
    .update({
      is_playing: isPlaying,
      position_seconds: clampToDuration(positionSeconds, durationSeconds ?? null),
      position_at: new Date().toISOString(),
      duration_seconds: durationSeconds ?? null,
      updated_by: ctx.userId,
    })
    .eq("id", roomId)
    .eq("space_id", ctx.spaceId)
    .eq("status", "watching");
  if (error) return { error: "Gagal menyamakan posisi video." };
  return { ok: true };
}

/** "That's a wrap." Ends the room for both of you. */
export async function endWatchRoom(roomId: string): Promise<WatchActionResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("watch_rooms")
    .update({ status: "ended", ended_at: new Date().toISOString(), is_playing: false })
    .eq("id", roomId)
    .eq("space_id", ctx.spaceId)
    .neq("status", "ended");
  if (error) return { error: "Gagal menutup room." };
  revalidatePath("/watch");
  return { ok: true };
}

// ---------------------------------------------------------------------------
//  Little Chat + reactions
// ---------------------------------------------------------------------------

export type SentMessage = {
  id: string;
  userId: string;
  body: string;
  replyTo: string | null;
  atSeconds: number | null;
  createdAt: string;
};

export async function sendWatchMessage(
  roomId: string,
  body: string,
  atSeconds?: number | null,
  replyTo?: string | null,
): Promise<{ ok?: boolean; error?: string; message?: SentMessage }> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const clean = z.string().trim().min(1).max(CHAT_MAX).safeParse(body);
  if (!clean.success) return { error: "Tulis sesuatu dulu ya." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("watch_messages")
    .insert({
      room_id: roomId,
      space_id: ctx.spaceId,
      user_id: ctx.userId,
      body: clean.data,
      reply_to: replyTo ?? null,
      at_seconds: typeof atSeconds === "number" && Number.isFinite(atSeconds) ? atSeconds : null,
    })
    .select("id, user_id, body, reply_to, at_seconds, created_at")
    .single();

  if (error || !data) return { error: "Pesannya nggak terkirim. Coba lagi ya." };
  return {
    ok: true,
    message: {
      id: data.id,
      userId: data.user_id,
      body: data.body,
      replyTo: data.reply_to,
      atSeconds: data.at_seconds === null ? null : Number(data.at_seconds),
      createdAt: data.created_at,
    },
  };
}

/** A tap on ❤️ — the animation is broadcast, this row is just so the memory
 *  can count them honestly. Failure is silent by design. */
export async function addWatchReaction(
  roomId: string,
  emoji: string,
  atSeconds?: number | null,
): Promise<WatchActionResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis." };
  if (!(REACTIONS as readonly string[]).includes(emoji)) return { error: "Reaksi nggak dikenal." };

  const supabase = await createClient();
  await supabase.from("watch_reactions").insert({
    room_id: roomId,
    space_id: ctx.spaceId,
    user_id: ctx.userId,
    emoji,
    at_seconds: typeof atSeconds === "number" && Number.isFinite(atSeconds) ? atSeconds : null,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
//  Watch Memory
// ---------------------------------------------------------------------------

/**
 * "Save this moment." Counts are read back from the tables rather than trusted
 * from whichever screen happened to press the button, and the row is keyed to
 * the room — so if you both press Save, you both edit the same card.
 */
export async function saveWatchMemory(
  roomId: string,
  note: string,
): Promise<WatchActionResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const clean = z.string().trim().max(2000).safeParse(note ?? "");
  if (!clean.success) return { error: "Catatannya terlalu panjang." };

  const room = await getRoom(roomId);
  if (!room || room.spaceId !== ctx.spaceId) return { error: "Room ini nggak ditemukan." };

  const supabase = await createClient();
  const [{ count: messages }, { count: reactions }] = await Promise.all([
    supabase
      .from("watch_messages")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId),
    supabase
      .from("watch_reactions")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId),
  ]);

  const { data, error } = await supabase
    .from("watch_memories")
    .upsert(
      {
        space_id: ctx.spaceId,
        room_id: roomId,
        created_by: ctx.userId,
        title: room.title,
        subtitle: room.subtitle,
        source_kind: room.sourceKind,
        source_url: room.sourceUrl,
        poster_url: room.posterUrl,
        watched_date: localDateISO(ctx.profile.timezone),
        minutes: minutesTogether(room.startedAt, room.endedAt ?? Date.now()),
        message_count: messages ?? 0,
        reaction_count: reactions ?? 0,
        note: clean.data.length > 0 ? clean.data : null,
      },
      { onConflict: "room_id" },
    )
    .select("id")
    .single();

  if (error || !data) return { error: "Gagal menyimpan momennya. Coba lagi ya." };
  revalidatePath("/watch");
  revalidatePath("/watch/history");
  revalidatePath("/us");
  return { ok: true, id: data.id };
}

/** Add or change the line underneath a saved memory. Either of you may. */
export async function updateWatchMemoryNote(
  memoryId: string,
  note: string,
): Promise<WatchActionResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const clean = z.string().trim().max(2000).safeParse(note ?? "");
  if (!clean.success) return { error: "Catatannya terlalu panjang." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("watch_memories")
    .update({ note: clean.data.length > 0 ? clean.data : null })
    .eq("id", memoryId)
    .eq("space_id", ctx.spaceId);
  if (error) return { error: "Gagal menyimpan catatannya." };
  revalidatePath(`/watch/${memoryId}`);
  revalidatePath("/watch/history");
  return { ok: true };
}

export async function deleteWatchMemory(memoryId: string): Promise<WatchActionResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("watch_memories")
    .delete()
    .eq("id", memoryId)
    .eq("space_id", ctx.spaceId);
  if (error) return { error: "Gagal menghapus momen ini." };
  revalidatePath("/watch/history");
  revalidatePath("/watch");
  revalidatePath("/us");
  return { ok: true };
}
