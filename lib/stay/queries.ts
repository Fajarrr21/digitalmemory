import "server-only";
import { createClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/media";
import type { Database, StayLamp, StayScene } from "@/lib/supabase/database.types";

type GiftRow = Database["public"]["Tables"]["stay_gifts"]["Row"];

export type StayGift = GiftRow & { audioUrl: string | null };

export type StayPrefs = {
  scene: StayScene;
  lamp: StayLamp;
  show_character: boolean;
  calm_motion: boolean;
  intro_seen_at: string | null;
};

export const DEFAULT_PREFS: StayPrefs = {
  scene: "rain",
  lamp: "warm",
  show_character: true,
  calm_motion: false,
  intro_seen_at: null,
};

const GIFT_COLS =
  "id, space_id, sender_id, recipient_id, kind, object_kind, body, audio_path, audio_mime, audio_seconds, opened_at, put_away_at, edited_at, notified_at, created_at, updated_at";

async function withAudio(rows: GiftRow[]): Promise<StayGift[]> {
  const signed = await signPaths(rows.map((r) => r.audio_path).filter((p): p is string => !!p));
  return rows.map((r) => ({ ...r, audioUrl: r.audio_path ? (signed[r.audio_path] ?? null) : null }));
}

export type StayRoomData = {
  /** False when migration 0020 hasn't been run yet. */
  ready: boolean;
  prefs: StayPrefs;
  /** Everything left in MY room, newest first. */
  gifts: StayGift[];
};

export async function getStayRoom(spaceId: string, userId: string): Promise<StayRoomData> {
  const supabase = await createClient();
  const [{ data: prefs, error }, { data: gifts }] = await Promise.all([
    supabase
      .from("stay_rooms")
      .select("scene, lamp, show_character, calm_motion, intro_seen_at")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("stay_gifts")
      .select(GIFT_COLS)
      .eq("space_id", spaceId)
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);
  if (error) return { ready: false, prefs: DEFAULT_PREFS, gifts: [] };
  return { ready: true, prefs: prefs ?? DEFAULT_PREFS, gifts: await withAudio(gifts ?? []) };
}

/** What I've left in my partner's room — for the "leave something" page. */
export async function getSentGifts(spaceId: string, userId: string): Promise<{ ready: boolean; gifts: StayGift[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stay_gifts")
    .select(GIFT_COLS)
    .eq("space_id", spaceId)
    .eq("sender_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return { ready: false, gifts: [] };
  return { ready: true, gifts: await withAudio(data ?? []) };
}

/** Unopened gifts in my room — Home card + 🔔. Cheap; never throws. */
export async function countStayUnopened(userId: string): Promise<number | null> {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("stay_gifts")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .is("opened_at", null);
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}
