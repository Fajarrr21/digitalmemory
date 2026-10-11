import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { effectiveStatus, isLive } from "@/lib/hold/logic";

type SessionRow = Database["public"]["Tables"]["hold_sessions"]["Row"];
type ReplyRow = Database["public"]["Tables"]["hold_replies"]["Row"];

export type HoldSession = SessionRow;
export type HoldReply = ReplyRow;

const SESSION_COLS =
  "id, space_id, sender_id, recipient_id, feeling, need, timing, shared_intensity, shared_context, status, round, after_choice, kept, client_key, notified_at, opened_at, responded_at, closed_at, expires_at, created_at, updated_at";

/** With the effective (time-aware) status folded in. */
function settle(row: SessionRow): SessionRow {
  return { ...row, status: effectiveStatus(row) };
}

export type HoldOverview = {
  /** False when migration 0018 hasn't been run yet. */
  ready: boolean;
  /** My own session that's still open, if any. */
  mine: SessionRow | null;
  /** Sessions my partner opened for me that are still live. */
  forMe: SessionRow[];
  /** Ended in the last few days, so a closing word can still be read. */
  recentlyEnded: SessionRow[];
  keptCount: number;
};

/**
 * Everything the /hold landing needs. Runs the lazy tidy first (settle
 * expired sessions, purge un-kept shells after a week) — best-effort.
 */
export async function getHoldOverview(spaceId: string, userId: string): Promise<HoldOverview> {
  const supabase = await createClient();
  const empty: HoldOverview = { ready: false, mine: null, forMe: [], recentlyEnded: [], keptCount: 0 };

  await supabase.rpc("hold_tidy", { p_space: spaceId });

  const since = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const [live, ended, kept] = await Promise.all([
    supabase
      .from("hold_sessions")
      .select(SESSION_COLS)
      .eq("space_id", spaceId)
      .in("status", ["pending", "opened", "responded", "continued"])
      .order("created_at", { ascending: false }),
    supabase
      .from("hold_sessions")
      .select(SESSION_COLS)
      .eq("space_id", spaceId)
      .in("status", ["closed", "expired"])
      .gte("closed_at", since)
      .order("closed_at", { ascending: false })
      .limit(4),
    supabase
      .from("hold_sessions")
      .select("id", { count: "exact", head: true })
      .eq("space_id", spaceId)
      .eq("kept", true),
  ]);
  if (live.error) return empty;

  const rows = (live.data ?? []).map(settle);
  return {
    ready: true,
    mine: rows.find((r) => r.sender_id === userId && isLive(r.status)) ?? null,
    forMe: rows.filter((r) => r.recipient_id === userId && isLive(r.status)),
    recentlyEnded: (ended.data ?? []).map(settle),
    keptCount: kept.count ?? 0,
  };
}

export type HoldDetail = {
  session: SessionRow;
  replies: ReplyRow[];
  /** Only ever filled for the sender — RLS returns nothing to the partner. */
  privateNote: { intensity: number | null; context: string | null } | null;
};

export async function getHoldSession(id: string): Promise<HoldDetail | null> {
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("hold_sessions")
    .select(SESSION_COLS)
    .eq("id", id)
    .maybeSingle();
  if (!session) return null;

  const [{ data: replies }, { data: priv }] = await Promise.all([
    supabase
      .from("hold_replies")
      .select("id, session_id, author_id, round, kind, action, gesture, message, client_key, created_at")
      .eq("session_id", id)
      .order("round", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("hold_private")
      .select("intensity, context")
      .eq("session_id", id)
      .maybeSingle(),
  ]);

  return { session: settle(session), replies: replies ?? [], privateNote: priv ?? null };
}

export type PastHold = SessionRow & { actions: ReplyRow["action"][] };

/** Past Holds — only the sessions someone chose to keep. */
export async function getPastHolds(spaceId: string): Promise<PastHold[]> {
  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("hold_sessions")
    .select(SESSION_COLS)
    .eq("space_id", spaceId)
    .eq("kept", true)
    .order("created_at", { ascending: false })
    .limit(100);
  if (!sessions?.length) return [];

  const { data: replies } = await supabase
    .from("hold_replies")
    .select("session_id, action")
    .in(
      "session_id",
      sessions.map((s) => s.id),
    )
    .eq("kind", "support");

  return sessions.map((s) => ({
    ...settle(s),
    actions: (replies ?? []).filter((r) => r.session_id === s.id).map((r) => r.action),
  }));
}

/** For the 🔔 badge: live sessions waiting for my gesture. Cheap; never throws. */
export async function countHoldWaiting(userId: string): Promise<number> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("hold_sessions")
      .select("status, expires_at")
      .eq("recipient_id", userId)
      .in("status", ["pending", "opened", "continued"]);
    return (data ?? []).filter((r) => effectiveStatus(r) !== "expired").length;
  } catch {
    return 0;
  }
}

export type HoldGlance = {
  ready: boolean;
  /** Live sessions waiting for my gesture. */
  waitingForMe: number;
  /** The status of my own open session, if any. */
  mine: { id: string; status: SessionRow["status"] } | null;
};

/** For the Home card — one small read, no tidy. Never throws. */
export async function getHoldGlance(userId: string): Promise<HoldGlance> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("hold_sessions")
      .select("id, sender_id, recipient_id, status, expires_at, created_at")
      .in("status", ["pending", "opened", "responded", "continued"])
      .order("created_at", { ascending: false });
    if (error) return { ready: false, waitingForMe: 0, mine: null };
    const live = (data ?? []).map((r) => ({ ...r, status: effectiveStatus(r) })).filter((r) => isLive(r.status));
    const mine = live.find((r) => r.sender_id === userId);
    return {
      ready: true,
      waitingForMe: live.filter((r) => r.recipient_id === userId && r.status !== "responded").length,
      mine: mine ? { id: mine.id, status: mine.status } : null,
    };
  } catch {
    return { ready: false, waitingForMe: 0, mine: null };
  }
}
