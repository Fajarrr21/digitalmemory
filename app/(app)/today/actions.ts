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
  // Voice note (optional) — uploaded client-side, path passed through here.
  voice_path: z.string().max(400).optional(),
  voice_mime: z.string().max(120).optional(),
  voice_duration: z.coerce.number().nonnegative().optional(),
  voice_size: z.coerce.number().int().nonnegative().optional(),
  voice_clear: z.string().optional(), // "1" = remove existing voice note
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
    voice_path: (formData.get("voice_path") as string) || undefined,
    voice_mime: (formData.get("voice_mime") as string) || undefined,
    voice_duration: (formData.get("voice_duration") as string) || undefined,
    voice_size: (formData.get("voice_size") as string) || undefined,
    voice_clear: (formData.get("voice_clear") as string) || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Coba cek lagi ya." };
  }

  const supabase = await createClient();
  const ratingDate = localDateISO(ctx.profile.timezone);

  // We notify the partner on save (first entry + later updates), but cap it at
  // MAX_NOTIFY per person per day so edits can't spam. notify_count tracks how
  // many messages actually went out today.
  const MAX_NOTIFY = 2;
  const { data: prior } = await supabase
    .from("daily_ratings")
    .select("notify_count")
    .eq("user_id", ctx.userId)
    .eq("rating_date", ratingDate)
    .maybeSingle();
  const priorCount = prior?.notify_count ?? 0;

  const { data: ratingRow, error } = await supabase
    .from("daily_ratings")
    .upsert(
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
    )
    .select("id")
    .single();

  if (error || !ratingRow) return { error: "Gagal menyimpan. Coba lagi sebentar ya. ♡" };

  // Voice note: replace on new upload or on explicit clear.
  const newVoice = parsed.data.voice_path;
  const clearVoice = parsed.data.voice_clear === "1";
  if (newVoice || clearVoice) {
    const { data: old } = await supabase
      .from("media")
      .select("storage_path")
      .eq("rating_id", ratingRow.id)
      .eq("type", "audio");
    if (old && old.length > 0) {
      await supabase.storage.from("media").remove(old.map((o) => o.storage_path));
      await supabase.from("media").delete().eq("rating_id", ratingRow.id).eq("type", "audio");
    }
  }
  if (newVoice && newVoice.startsWith(`${ctx.spaceId}/${ctx.userId}/`)) {
    await supabase.from("media").insert({
      space_id: ctx.spaceId,
      owner_id: ctx.userId,
      rating_id: ratingRow.id,
      type: "audio",
      storage_path: newVoice,
      mime: parsed.data.voice_mime || "audio/webm",
      size_bytes: parsed.data.voice_size ?? 0,
      duration: parsed.data.voice_duration ?? null,
    });
  }

  if (priorCount < MAX_NOTIFY) {
    const sent = await notifyPartnerOfRating({
      spaceId: ctx.spaceId,
      senderId: ctx.userId,
      rating: {
        score: parsed.data.score,
        mood: parsed.data.mood || null,
        reason: parsed.data.reason || null,
        note: parsed.data.note || null,
      },
    });
    // Only burn a slot when a message actually went out.
    if (sent) {
      await supabase
        .from("daily_ratings")
        .update({ notify_count: priorCount + 1 })
        .eq("user_id", ctx.userId)
        .eq("rating_date", ratingDate);
    }
  }

  revalidatePath("/today");
  revalidatePath("/");
  return { ok: true };
}
