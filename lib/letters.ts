import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDateISO, localHour } from "@/lib/date";
import { daypart } from "@/lib/greeting";
import type { Database } from "@/lib/supabase/database.types";

type DailyLetter = Database["public"]["Tables"]["daily_letters"]["Row"];
type PoolLetter = Database["public"]["Tables"]["letter_pool"]["Row"];

export type KeeperInfo = { id: string; name: string; timezone: string };
export type ResolvedLetter = {
  letter: DailyLetter;
  keeper: KeeperInfo;
  isRecipient: boolean;
};

const DEFAULT_BODY =
  "Aku belum sempat menulis surat baru untuk hari ini — tapi aku tetap memikirkanmu. Anggap saja ini pelukan kecil sampai suratku yang berikutnya datang. ♡";

async function getKeeper(
  admin: ReturnType<typeof createAdminClient>,
  spaceId: string,
): Promise<KeeperInfo | null> {
  const { data: member } = await admin
    .from("space_members")
    .select("user_id")
    .eq("space_id", spaceId)
    .eq("role", "keeper")
    .maybeSingle();
  if (!member) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("id, display_name, nickname, timezone")
    .eq("id", member.user_id)
    .single();
  if (!profile) return null;

  return {
    id: profile.id,
    name: profile.nickname ?? profile.display_name,
    timezone: profile.timezone,
  };
}

/** Choose a letter from the pool: prefer an unused one matching the time of
 *  day, then any unused, then (if the pool is exhausted) the least-recently
 *  reused one. Returns null only if the pool is completely empty. */
async function pickFromPool(
  admin: ReturnType<typeof createAdminClient>,
  spaceId: string,
  part: ReturnType<typeof daypart>,
): Promise<PoolLetter | null> {
  const preferred =
    part === "morning" ? "good_morning" : part === "night" ? "good_night" : null;

  if (preferred) {
    const { data } = await admin
      .from("letter_pool")
      .select("*")
      .eq("space_id", spaceId)
      .is("used_on", null)
      .eq("category", preferred)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  const { data: unused } = await admin
    .from("letter_pool")
    .select("*")
    .eq("space_id", spaceId)
    .is("used_on", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (unused) return unused;

  const { data: reuse } = await admin
    .from("letter_pool")
    .select("*")
    .eq("space_id", spaceId)
    .order("used_on", { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();
  return reuse ?? null;
}

/**
 * Get-or-create today's letter for the space's keeper. Idempotent and
 * race-safe: the DB unique constraint (recipient_id, letter_date) guarantees
 * exactly one; a losing concurrent insert catches the 23505 and re-reads.
 * The letter text is snapshotted so later pool edits never rewrite history.
 */
export async function resolveDailyLetter(
  spaceId: string,
  viewerId: string,
): Promise<ResolvedLetter | null> {
  const admin = createAdminClient();
  const keeper = await getKeeper(admin, spaceId);
  if (!keeper) return null;

  const today = localDateISO(keeper.timezone);
  const isRecipient = viewerId === keeper.id;

  const { data: existing } = await admin
    .from("daily_letters")
    .select("*")
    .eq("recipient_id", keeper.id)
    .eq("letter_date", today)
    .maybeSingle();
  if (existing) return { letter: existing, keeper, isRecipient };

  const pick = await pickFromPool(admin, spaceId, daypart(localHour(keeper.timezone)));

  const { data: inserted, error } = await admin
    .from("daily_letters")
    .insert({
      space_id: spaceId,
      recipient_id: keeper.id,
      letter_date: today,
      pool_id: pick?.id ?? null,
      category: pick?.category ?? "random_love",
      title: pick?.title ?? null,
      body: pick?.body ?? DEFAULT_BODY,
    })
    .select()
    .single();

  if (error) {
    // 23505 = unique violation → a concurrent request won; use its letter.
    if (error.code === "23505") {
      const { data: raced } = await admin
        .from("daily_letters")
        .select("*")
        .eq("recipient_id", keeper.id)
        .eq("letter_date", today)
        .single();
      return raced ? { letter: raced, keeper, isRecipient } : null;
    }
    throw error;
  }

  if (pick?.id) {
    await admin.from("letter_pool").update({ used_on: today }).eq("id", pick.id);
  }

  return { letter: inserted, keeper, isRecipient };
}
