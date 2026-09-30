import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { WatchSourceKind, WatchStatus } from "@/lib/supabase/database.types";

/**
 * Server-side reads for Watch Together. Everything runs as the signed-in user,
 * so RLS (`is_member(space_id)`) is the real gate — these helpers only shape
 * the rows into something a page can render.
 */

export type WatchRoomRow = {
  id: string;
  spaceId: string;
  status: WatchStatus;
  sourceKind: WatchSourceKind;
  sourceUrl: string;
  videoId: string | null;
  title: string;
  subtitle: string | null;
  posterUrl: string | null;
  hostId: string;
  guestId: string | null;
  isPlaying: boolean;
  positionSeconds: number;
  positionAt: string;
  durationSeconds: number | null;
  updatedBy: string | null;
  startedAt: string | null;
  endedAt: string | null;
  expiresAt: string;
  createdAt: string;
};

const ROOM_COLUMNS =
  "id, space_id, status, source_kind, source_url, video_id, title, subtitle, poster_url, " +
  "host_id, guest_id, is_playing, position_seconds, position_at, duration_seconds, " +
  "updated_by, started_at, ended_at, expires_at, created_at";

type RawRoom = {
  id: string;
  space_id: string;
  status: WatchStatus;
  source_kind: WatchSourceKind;
  source_url: string;
  video_id: string | null;
  title: string;
  subtitle: string | null;
  poster_url: string | null;
  host_id: string;
  guest_id: string | null;
  is_playing: boolean;
  position_seconds: number;
  position_at: string;
  duration_seconds: number | null;
  updated_by: string | null;
  started_at: string | null;
  ended_at: string | null;
  expires_at: string;
  created_at: string;
};

function toRoom(r: RawRoom): WatchRoomRow {
  return {
    id: r.id,
    spaceId: r.space_id,
    status: r.status,
    sourceKind: r.source_kind,
    sourceUrl: r.source_url,
    videoId: r.video_id,
    title: r.title,
    subtitle: r.subtitle,
    posterUrl: r.poster_url,
    hostId: r.host_id,
    guestId: r.guest_id,
    isPlaying: r.is_playing,
    positionSeconds: Number(r.position_seconds),
    positionAt: r.position_at,
    durationSeconds: r.duration_seconds === null ? null : Number(r.duration_seconds),
    updatedBy: r.updated_by,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  };
}

/** A room is only "gone" once it ends, or once an unjoined invite goes stale. */
export function isRoomAlive(room: WatchRoomRow, now: number = Date.now()): boolean {
  if (room.status === "ended") return false;
  if (room.status === "waiting" && new Date(room.expiresAt).getTime() < now) return false;
  return true;
}

export async function getRoom(roomId: string): Promise<WatchRoomRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("watch_rooms")
    .select(ROOM_COLUMNS)
    .eq("id", roomId)
    .maybeSingle<RawRoom>();
  return data ? toRoom(data) : null;
}

/**
 * Is anything on right now? The newest room that hasn't ended and hasn't gone
 * stale — what the Home card and /watch landing both key off.
 */
export async function getLiveRoom(spaceId: string): Promise<WatchRoomRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("watch_rooms")
    .select(ROOM_COLUMNS)
    .eq("space_id", spaceId)
    .neq("status", "ended")
    .order("created_at", { ascending: false })
    .limit(4)
    .returns<RawRoom[]>();

  const rooms = (data ?? []).map(toRoom);
  return rooms.find((r) => isRoomAlive(r)) ?? null;
}

export type WatchChatMessage = {
  id: string;
  userId: string;
  body: string;
  replyTo: string | null;
  atSeconds: number | null;
  createdAt: string;
};

/** Little Chat, oldest first — a reload keeps the conversation. */
export async function getRoomMessages(roomId: string, limit = 200): Promise<WatchChatMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("watch_messages")
    .select("id, user_id, body, reply_to, at_seconds, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(limit);

  return (data ?? []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    body: m.body,
    replyTo: m.reply_to,
    atSeconds: m.at_seconds === null ? null : Number(m.at_seconds),
    createdAt: m.created_at,
  }));
}

export type WatchMemory = {
  id: string;
  roomId: string | null;
  createdBy: string;
  title: string;
  subtitle: string | null;
  sourceKind: WatchSourceKind;
  sourceUrl: string | null;
  posterUrl: string | null;
  watchedDate: string;
  minutes: number;
  messageCount: number;
  reactionCount: number;
  note: string | null;
  createdAt: string;
};

const MEMORY_COLUMNS =
  "id, room_id, created_by, title, subtitle, source_kind, source_url, poster_url, " +
  "watched_date, minutes, message_count, reaction_count, note, created_at";

type RawMemory = {
  id: string;
  room_id: string | null;
  created_by: string;
  title: string;
  subtitle: string | null;
  source_kind: WatchSourceKind;
  source_url: string | null;
  poster_url: string | null;
  watched_date: string;
  minutes: number;
  message_count: number;
  reaction_count: number;
  note: string | null;
  created_at: string;
};

function toMemory(m: RawMemory): WatchMemory {
  return {
    id: m.id,
    roomId: m.room_id,
    createdBy: m.created_by,
    title: m.title,
    subtitle: m.subtitle,
    sourceKind: m.source_kind,
    sourceUrl: m.source_url,
    posterUrl: m.poster_url,
    watchedDate: m.watched_date,
    minutes: m.minutes,
    messageCount: m.message_count,
    reactionCount: m.reaction_count,
    note: m.note,
    createdAt: m.created_at,
  };
}

/** Things We Watched, newest first. */
export async function getWatchMemories(spaceId: string, limit = 50): Promise<WatchMemory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("watch_memories")
    .select(MEMORY_COLUMNS)
    .eq("space_id", spaceId)
    .order("watched_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<RawMemory[]>();
  return (data ?? []).map(toMemory);
}

export async function getWatchMemory(id: string): Promise<WatchMemory | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("watch_memories")
    .select(MEMORY_COLUMNS)
    .eq("id", id)
    .maybeSingle<RawMemory>();
  return data ? toMemory(data) : null;
}

/** The wrap card already saved for a room, if there is one. */
export async function getMemoryForRoom(roomId: string): Promise<WatchMemory | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("watch_memories")
    .select(MEMORY_COLUMNS)
    .eq("room_id", roomId)
    .maybeSingle<RawMemory>();
  return data ? toMemory(data) : null;
}
