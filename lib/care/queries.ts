import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { effectiveStatus, isLive, waitingForCarer } from "@/lib/care/logic";

type SessionRow = Database["public"]["Tables"]["care_sessions"]["Row"];
type ActionRow = Database["public"]["Tables"]["care_actions"]["Row"];
type PrivateRow = Database["public"]["Tables"]["care_private"]["Row"];

export type CareSession = SessionRow;
export type CareAction = ActionRow;
export type CarePrivate = Pick<PrivateRow, "symptoms" | "severity" | "note" | "red_flags">;

const SESSION_COLS =
  "id, space_id, sender_id, recipient_id, wants, shared_symptoms, shared_severity, shared_note, needs_check, status, after_choice, after_at, rest_since, kept, client_key, notified_at, sender_notified_at, opened_at, last_care_at, closed_at, expires_at, created_at, updated_at";

function settle(row: SessionRow): SessionRow {
  return { ...row, status: effectiveStatus(row) };
}

export type CareOverview = {
  /** False when migration 0019 hasn't been run yet. */
  ready: boolean;
  mine: SessionRow | null;
  /** Live sessions my partner opened for me. */
  forMe: SessionRow[];
  /** Ended & kept — shown as a quiet list, never with health details. */
  kept: (SessionRow & { careCount: number })[];
};

/** Everything the /care home needs. Runs the lazy tidy first — best-effort. */
export async function getCareOverview(spaceId: string, userId: string): Promise<CareOverview> {
  const supabase = await createClient();
  const empty: CareOverview = { ready: false, mine: null, forMe: [], kept: [] };

  await supabase.rpc("care_tidy", { p_space: spaceId });

  const [live, kept] = await Promise.all([
    supabase
      .from("care_sessions")
      .select(SESSION_COLS)
      .eq("space_id", spaceId)
      .in("status", ["open", "resting"])
      .order("created_at", { ascending: false }),
    supabase
      .from("care_sessions")
      .select(SESSION_COLS)
      .eq("space_id", spaceId)
      .eq("kept", true)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  if (live.error) return empty;

  const keptRows = (kept.data ?? []).map(settle);
  const counts = new Map<string, number>();
  if (keptRows.length) {
    const { data: acts } = await supabase
      .from("care_actions")
      .select("session_id")
      .in(
        "session_id",
        keptRows.map((s) => s.id),
      );
    for (const a of acts ?? []) counts.set(a.session_id, (counts.get(a.session_id) ?? 0) + 1);
  }

  const rows = (live.data ?? []).map(settle);
  return {
    ready: true,
    mine: rows.find((r) => r.sender_id === userId && isLive(r.status)) ?? null,
    forMe: rows.filter((r) => r.recipient_id === userId && isLive(r.status)),
    kept: keptRows.map((s) => ({ ...s, careCount: counts.get(s.id) ?? 0 })),
  };
}

export type CareDetail = {
  session: SessionRow;
  actions: ActionRow[];
  /** Only ever filled for the sender — RLS returns nothing to the partner. */
  privateNote: CarePrivate | null;
};

export async function getCareSession(id: string): Promise<CareDetail | null> {
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("care_sessions")
    .select(SESSION_COLS)
    .eq("id", id)
    .maybeSingle();
  if (!session) return null;

  const [{ data: actions }, { data: priv }] = await Promise.all([
    supabase
      .from("care_actions")
      .select("id, session_id, author_id, kind, variant, message, answer, answered_at, client_key, created_at")
      .eq("session_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("care_private")
      .select("symptoms, severity, note, red_flags")
      .eq("session_id", id)
      .maybeSingle(),
  ]);

  return { session: settle(session), actions: actions ?? [], privateNote: priv ?? null };
}

const GLANCE_COLS = "id, sender_id, recipient_id, status, expires_at, last_care_at, after_choice, after_at, created_at, updated_at";

/** Live sessions where I'm the carer and I'm being waited for. Never throws. */
async function waitingRows(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("care_sessions")
    .select(GLANCE_COLS)
    .eq("recipient_id", userId)
    .in("status", ["open", "resting"]);
  if (error) return null;
  return (data ?? []).filter((r) => waitingForCarer(r));
}

/** For the 🔔 center: just THAT someone needs a little care — never what. */
export async function getCareWaiting(userId: string) {
  try {
    return (await waitingRows(userId)) ?? [];
  } catch {
    return [];
  }
}

export async function countCareWaiting(userId: string): Promise<number> {
  return (await getCareWaiting(userId)).length;
}

export type CareGlance = {
  ready: boolean;
  /** A live session my partner opened for me (whether or not I've cared yet). */
  forMe: { id: string; waiting: boolean } | null;
  mine: { id: string; status: SessionRow["status"]; cared: boolean } | null;
};

/** For the Home card — one small read, no tidy. Never throws. */
export async function getCareGlance(userId: string): Promise<CareGlance> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("care_sessions")
      .select(GLANCE_COLS)
      .in("status", ["open", "resting"])
      .order("created_at", { ascending: false });
    if (error) return { ready: false, forMe: null, mine: null };
    const live = (data ?? []).map((r) => ({ ...r, status: effectiveStatus(r) })).filter((r) => isLive(r.status));
    const mine = live.find((r) => r.sender_id === userId);
    const forMe = live.find((r) => r.recipient_id === userId);
    return {
      ready: true,
      forMe: forMe ? { id: forMe.id, waiting: waitingForCarer(forMe) } : null,
      mine: mine ? { id: mine.id, status: mine.status, cared: !!mine.last_care_at } : null,
    };
  } catch {
    return { ready: false, forMe: null, mine: null };
  }
}
