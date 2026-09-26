"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSpaceContext, getPartner } from "@/lib/auth";
import { getFlameData, MAX_RECOVERIES_PER_MONTH } from "@/lib/flame";

export type RestoreState = { ok?: boolean; error?: string };

/**
 * Restore Flame — patch yesterday's missed day so the streak continues.
 * Deliberately a *decision*, never automatic. Limits: the gap must be exactly
 * one day (yesterday), and at most 5 recoveries per calendar month. Either
 * member may do it. The unique (space_id, day) constraint stops double-patching.
 */
export async function restoreFlame(): Promise<RestoreState> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const partner = await getPartner(ctx.spaceId, ctx.userId);
  const data = await getFlameData(
    ctx.spaceId,
    ctx.userId,
    partner?.id ?? null,
    ctx.profile.timezone,
  );

  const restorable = data.state.restorable;
  if (!restorable) return { error: "Nggak ada api yang perlu dinyalakan lagi. ♡" };
  if (data.recoveriesLeft <= 0) {
    return { error: `Kesempatan bulan ini sudah habis (${MAX_RECOVERIES_PER_MONTH}/bulan). Api baru selalu bisa dinyalakan. ♡` };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("flame_recoveries").insert({
    space_id: ctx.spaceId,
    day: restorable.gapDay,
    restored_by: ctx.userId,
  });
  // A unique violation just means the partner beat us to it — that's a win.
  if (error && !error.message.toLowerCase().includes("duplicate")) {
    return { error: "Gagal menyalakan lagi. Coba sebentar lagi ya." };
  }

  revalidatePath("/flame");
  revalidatePath("/profile");
  return { ok: true };
}
