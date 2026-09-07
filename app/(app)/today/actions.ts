"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSpaceContext } from "@/lib/auth";
import { localDateISO } from "@/lib/date";
import { notifyPartnerOfRating } from "@/lib/notify/rating";
import { MOODS } from "./rating-config";

const RatingSchema = z.object({
  score: z.coerce.number().int().min(1, "Pilih dulu angka harimu.").max(10),
  mood: z.enum(MOODS).optional().or(z.literal("")),
  reason: z.string().trim().max(2000).optional(),
  note: z.string().trim().max(2000).optional(),
});

export type RatingState = { ok?: boolean; error?: string };

export async function saveRating(
  _prev: RatingState,
  formData: FormData,
): Promise<RatingState> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const parsed = RatingSchema.safeParse({
    score: formData.get("score"),
    mood: formData.get("mood") ?? "",
    reason: (formData.get("reason") as string) ?? "",
    note: (formData.get("note") as string) ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Coba cek lagi ya." };
  }

  const supabase = await createClient();
  const ratingDate = localDateISO(ctx.profile.timezone);

  // Is this the first rating of the day? If so we notify the partner once.
  // Edits later in the day don't re-send, keeping it to ~one message each.
  const { data: prior } = await supabase
    .from("daily_ratings")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("rating_date", ratingDate)
    .maybeSingle();
  const isFirstToday = !prior;

  const { error } = await supabase.from("daily_ratings").upsert(
    {
      space_id: ctx.spaceId,
      user_id: ctx.userId,
      rating_date: ratingDate,
      score: parsed.data.score,
      mood: parsed.data.mood ? parsed.data.mood : null,
      reason: parsed.data.reason || null,
      note: parsed.data.note || null,
    },
    { onConflict: "user_id,rating_date" },
  );

  if (error) return { error: "Gagal menyimpan. Coba lagi sebentar ya. ♡" };

  if (isFirstToday) {
    await notifyPartnerOfRating({
      spaceId: ctx.spaceId,
      senderId: ctx.userId,
      senderName: ctx.profile.nickname || ctx.profile.display_name,
      rating: {
        score: parsed.data.score,
        mood: parsed.data.mood || null,
        reason: parsed.data.reason || null,
        note: parsed.data.note || null,
      },
    });
  }

  revalidatePath("/today");
  revalidatePath("/");
  return { ok: true };
}
