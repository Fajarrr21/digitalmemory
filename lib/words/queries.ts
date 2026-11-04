import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { LibraryItem } from "./logic";

/**
 * little words. — reads. Everything runs as the signed-in user, so RLS
 * (0022) decides what exists: my own works/revisions/lines, deliveries I
 * sent, and deliveries given to me once they're unlocked. Nothing here can
 * see the partner's works — by design there is no query that could.
 */

export type Work = Database["public"]["Tables"]["literary_works"]["Row"];
export type Revision = Database["public"]["Tables"]["literary_revisions"]["Row"];
export type Delivery = Database["public"]["Tables"]["literary_deliveries"]["Row"];
export type Line = Database["public"]["Tables"]["literary_lines"]["Row"];
export type Sealed = Database["public"]["Functions"]["words_sealed"]["Returns"][number];

const WORK_COLS =
  "id, space_id, author_id, title, content, work_type, style, theme, genre, mood, language, literary_depth, status, origin, is_favorite, created_at, updated_at";
const DELIVERY_COLS =
  "id, space_id, work_id, sender_id, recipient_id, title, content, work_type, genre, mood, language, intro, open_when, open_when_label, unlock_at, reply_to, opened_at, recipient_favorite, recipient_archived, created_at";

export type WordsHome = {
  /** False when migration 0022 hasn't been run yet. */
  ready: boolean;
  recent: Work[];
  counts: { works: number; drafts: number; lines: number; received: number };
  /** Given to me, unlocked, not yet opened. */
  waiting: number;
  /** Given to me, still locked until a date. */
  sealed: number;
  recentLines: Line[];
};

export async function getWordsHome(spaceId: string, userId: string): Promise<WordsHome> {
  const supabase = await createClient();
  const [recent, works, drafts, lines, received, waiting, sealed, recentLines] = await Promise.all([
    supabase.from("literary_works").select(WORK_COLS).eq("author_id", userId).order("updated_at", { ascending: false }).limit(4),
    supabase.from("literary_works").select("id", { count: "exact", head: true }).eq("author_id", userId),
    supabase.from("literary_works").select("id", { count: "exact", head: true }).eq("author_id", userId).eq("status", "draft"),
    supabase.from("literary_lines").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("literary_deliveries").select("id", { count: "exact", head: true }).eq("recipient_id", userId),
    supabase
      .from("literary_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .is("opened_at", null),
    supabase.rpc("words_sealed", { p_space: spaceId }),
    supabase.from("literary_lines").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(3),
  ]);
  if (recent.error) {
    return { ready: false, recent: [], counts: { works: 0, drafts: 0, lines: 0, received: 0 }, waiting: 0, sealed: 0, recentLines: [] };
  }
  return {
    ready: true,
    recent: recent.data ?? [],
    counts: { works: works.count ?? 0, drafts: drafts.count ?? 0, lines: lines.count ?? 0, received: received.count ?? 0 },
    waiting: waiting.count ?? 0,
    sealed: sealed.data?.length ?? 0,
    recentLines: recentLines.data ?? [],
  };
}

export type WorkDetail = {
  work: Work;
  revisions: Revision[];
  /** Times I gave this work to my partner (snapshots). */
  sent: Pick<Delivery, "id" | "created_at" | "opened_at" | "open_when" | "open_when_label" | "unlock_at">[];
  lines: Line[];
};

export async function getWork(id: string, userId: string): Promise<WorkDetail | null> {
  const supabase = await createClient();
  const { data: work } = await supabase.from("literary_works").select(WORK_COLS).eq("id", id).eq("author_id", userId).maybeSingle();
  if (!work) return null;
  const [revisions, sent, lines] = await Promise.all([
    supabase.from("literary_revisions").select("*").eq("work_id", id).order("created_at", { ascending: false }).limit(50),
    supabase
      .from("literary_deliveries")
      .select("id, created_at, opened_at, open_when, open_when_label, unlock_at")
      .eq("work_id", id)
      .eq("sender_id", userId)
      .order("created_at", { ascending: false }),
    supabase.from("literary_lines").select("*").eq("work_id", id).eq("user_id", userId).order("created_at", { ascending: false }),
  ]);
  return { work, revisions: revisions.data ?? [], sent: sent.data ?? [], lines: lines.data ?? [] };
}

export async function getLibrary(userId: string, partnerName: string): Promise<{ ready: boolean; items: LibraryItem[] }> {
  const supabase = await createClient();
  const [works, received, sent] = await Promise.all([
    supabase.from("literary_works").select(WORK_COLS).eq("author_id", userId).order("created_at", { ascending: false }).limit(500),
    supabase
      .from("literary_deliveries")
      .select(DELIVERY_COLS)
      .eq("recipient_id", userId)
      .eq("recipient_archived", false)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("literary_deliveries").select("work_id").eq("sender_id", userId).not("work_id", "is", null),
  ]);
  if (works.error) return { ready: false, items: [] };

  const sentCount = new Map<string, number>();
  for (const s of sent.data ?? []) if (s.work_id) sentCount.set(s.work_id, (sentCount.get(s.work_id) ?? 0) + 1);

  const mine: LibraryItem[] = (works.data ?? []).map((w) => ({
    source: "work",
    id: w.id,
    title: w.title,
    content: w.content,
    work_type: w.work_type,
    genre: w.genre,
    mood: w.mood,
    status: w.status,
    favorite: w.is_favorite,
    author: "me",
    mine: true,
    date: w.created_at,
    updated: w.updated_at,
    sentCount: sentCount.get(w.id) ?? 0,
    href: `/words/w/${w.id}`,
  }));
  const gifts: LibraryItem[] = (received.data ?? [])
    // An "Open when…" envelope stays sealed in the library too, until opened.
    .filter((d) => d.opened_at || !d.open_when)
    .map((d) => ({
      source: "received",
      id: d.id,
      title: d.title,
      content: d.content,
      work_type: d.work_type,
      genre: d.genre,
      mood: d.mood,
      status: "received",
      favorite: d.recipient_favorite,
      author: partnerName,
      mine: false,
      date: d.created_at,
      updated: d.created_at,
      sentCount: 0,
      href: `/words/to-you/${d.id}`,
    }));
  return { ready: true, items: [...mine, ...gifts] };
}

export async function getLines(userId: string): Promise<{ ready: boolean; lines: Line[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("literary_lines")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);
  return { ready: !error, lines: data ?? [] };
}

export type ToYou = {
  ready: boolean;
  received: Delivery[];
  sealed: Sealed[];
  sent: Delivery[];
  archived: Delivery[];
};

export async function getToYou(spaceId: string, userId: string): Promise<ToYou> {
  const supabase = await createClient();
  const [received, sealed, sent] = await Promise.all([
    supabase
      .from("literary_deliveries")
      .select(DELIVERY_COLS)
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.rpc("words_sealed", { p_space: spaceId }),
    supabase.from("literary_deliveries").select(DELIVERY_COLS).eq("sender_id", userId).order("created_at", { ascending: false }).limit(100),
  ]);
  if (received.error) return { ready: false, received: [], sealed: [], sent: [], archived: [] };
  const all = received.data ?? [];
  return {
    ready: true,
    received: all.filter((d) => !d.recipient_archived),
    sealed: sealed.data ?? [],
    sent: sent.data ?? [],
    archived: all.filter((d) => d.recipient_archived),
  };
}

/** A delivery still locked for me — only that it exists and when it opens. */
export async function getSealedOne(spaceId: string, id: string): Promise<Sealed | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("words_sealed", { p_space: spaceId });
  return data?.find((s) => s.id === id) ?? null;
}

export type DeliveryDetail = {
  delivery: Delivery;
  /** The delivery this one answers, if I can see it. */
  replyTo: Pick<Delivery, "id" | "title" | "sender_id"> | null;
  /** Replies to this delivery that I can see. */
  replies: Pick<Delivery, "id" | "title" | "sender_id" | "created_at" | "opened_at">[];
  lines: Line[];
};

export async function getDelivery(id: string, userId: string): Promise<DeliveryDetail | null> {
  const supabase = await createClient();
  const { data: delivery } = await supabase.from("literary_deliveries").select(DELIVERY_COLS).eq("id", id).maybeSingle();
  if (!delivery) return null;
  const [replyTo, replies, lines] = await Promise.all([
    delivery.reply_to
      ? supabase.from("literary_deliveries").select("id, title, sender_id").eq("id", delivery.reply_to).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("literary_deliveries")
      .select("id, title, sender_id, created_at, opened_at")
      .eq("reply_to", id)
      .order("created_at", { ascending: true }),
    supabase.from("literary_lines").select("*").eq("delivery_id", id).eq("user_id", userId),
  ]);
  return { delivery, replyTo: replyTo.data ?? null, replies: replies.data ?? [], lines: lines.data ?? [] };
}

/** Given to me, unlocked, unopened — Home card + 🔔. Cheap; never throws. */
export async function countWordsWaiting(userId: string): Promise<number | null> {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("literary_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .is("opened_at", null);
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}
