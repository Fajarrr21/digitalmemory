import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AwayKind, MeanwhileCategory } from "@/lib/supabase/database.types";

export type AwayStatus = {
  kind: AwayKind;
  active: boolean;
  updatedAt: string;
};

/** A member's away status row, or null if they never set one. */
export async function getAwayStatus(
  spaceId: string,
  userId: string,
): Promise<AwayStatus | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("away_status")
    .select("kind, active, updated_at")
    .eq("space_id", spaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return { kind: data.kind, active: data.active, updatedAt: data.updated_at };
}

/** "Just came back": status turned off less than 2 hours ago. */
export function isJustBack(status: AwayStatus | null): boolean {
  if (!status || status.active) return false;
  return Date.now() - new Date(status.updatedAt).getTime() < 2 * 60 * 60 * 1000;
}

export type MeanwhileMoment = {
  id: string;
  userId: string;
  category: MeanwhileCategory;
  prompt: string;
  payload: Record<string, unknown>;
  shared: boolean;
  momentDate: string;
  createdAt: string;
};

/**
 * The archive, newest first: everything of your own + the partner's shared
 * moments (RLS enforces exactly that — this select just asks for the space).
 */
export async function getMeanwhileMoments(
  spaceId: string,
  limit = 80,
): Promise<MeanwhileMoment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meanwhile_moments")
    .select("id, user_id, category, prompt, payload, shared, moment_date, created_at")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    category: m.category,
    prompt: m.prompt,
    payload: (m.payload ?? {}) as Record<string, unknown>,
    shared: m.shared,
    momentDate: m.moment_date,
    createdAt: m.created_at,
  }));
}

/** How many little moments the user has kept (their own only). */
export async function countOwnMoments(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("meanwhile_moments")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  return count ?? 0;
}
