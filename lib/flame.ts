import "server-only";
import { createClient } from "@/lib/supabase/server";
import { localDateISO } from "@/lib/date";
import { computeFlame, type FlameState } from "@/lib/flame-logic";

export const MAX_RECOVERIES_PER_MONTH = 5;

/**
 * Record "I showed up today" — called from the authed layout on every page
 * view. Presence is the user's local calendar day. Insert-only; conflicts
 * (already recorded today) are ignored. Best-effort: never blocks a render.
 */
export async function recordPresence(spaceId: string, userId: string, timezone: string) {
  try {
    const supabase = await createClient();
    await supabase
      .from("presence_days")
      .upsert(
        { space_id: spaceId, user_id: userId, day: localDateISO(timezone) },
        { onConflict: "space_id,user_id,day", ignoreDuplicates: true },
      );
  } catch {
    // Presence is a nicety — a failed insert must never break the app shell.
  }
}

export type FlameData = {
  state: FlameState;
  today: string;
  /** Flame days (both present), ISO, for the calendar. */
  flameDays: string[];
  /** Bridged (restored) days, ISO. */
  bridgedDays: string[];
  recoveriesLeft: number;
};

/** Everything the flame pages need, computed fresh from presence rows. */
export async function getFlameData(
  spaceId: string,
  userId: string,
  partnerId: string | null,
  timezone: string,
): Promise<FlameData> {
  const supabase = await createClient();
  const today = localDateISO(timezone);

  const [{ data: presence }, { data: recoveries }] = await Promise.all([
    supabase
      .from("presence_days")
      .select("user_id, day")
      .eq("space_id", spaceId)
      .order("day", { ascending: false })
      .limit(1600), // ~2 years for two people
    supabase.from("flame_recoveries").select("day").eq("space_id", spaceId),
  ]);

  const you = new Set<string>();
  const partner = new Set<string>();
  for (const row of presence ?? []) {
    if (row.user_id === userId) you.add(row.day);
    else if (partnerId && row.user_id === partnerId) partner.add(row.day);
  }
  const bridged = new Set<string>((recoveries ?? []).map((r) => r.day));

  const state = computeFlame({ today, you, partner, bridged });

  const monthPrefix = today.slice(0, 7); // YYYY-MM
  const usedThisMonth = [...bridged].filter((d) => d.startsWith(monthPrefix)).length;

  const flameDays = [...you].filter((d) => partner.has(d)).sort();

  return {
    state,
    today,
    flameDays,
    bridgedDays: [...bridged].sort(),
    recoveriesLeft: Math.max(0, MAX_RECOVERIES_PER_MONTH - usedThisMonth),
  };
}
