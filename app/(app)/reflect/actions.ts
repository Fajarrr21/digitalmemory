"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSpaceContext } from "@/lib/auth";
import { localDateISO } from "@/lib/date";

const ReflectionSchema = z.object({
  q_today: z.string().trim().max(2000).optional(),
  q_smile: z.string().trim().max(2000).optional(),
  q_hard: z.string().trim().max(2000).optional(),
  q_release: z.string().trim().max(2000).optional(),
  q_grateful: z.string().trim().max(2000).optional(),
});

export type ReflectionState = { ok?: boolean; error?: string };

export async function saveReflection(
  _prev: ReflectionState,
  formData: FormData,
): Promise<ReflectionState> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const parsed = ReflectionSchema.safeParse({
    q_today: (formData.get("q_today") as string) ?? "",
    q_smile: (formData.get("q_smile") as string) ?? "",
    q_hard: (formData.get("q_hard") as string) ?? "",
    q_release: (formData.get("q_release") as string) ?? "",
    q_grateful: (formData.get("q_grateful") as string) ?? "",
  });
  if (!parsed.success) return { error: "Coba cek lagi ya." };

  const clean = (v?: string) => (v && v.length > 0 ? v : null);
  const supabase = await createClient();
  const { error } = await supabase.from("night_reflections").upsert(
    {
      space_id: ctx.spaceId,
      user_id: ctx.userId,
      reflection_date: localDateISO(ctx.profile.timezone),
      q_today: clean(parsed.data.q_today),
      q_smile: clean(parsed.data.q_smile),
      q_hard: clean(parsed.data.q_hard),
      q_release: clean(parsed.data.q_release),
      q_grateful: clean(parsed.data.q_grateful),
    },
    { onConflict: "user_id,reflection_date" },
  );

  if (error) return { error: "Gagal menyimpan. Coba lagi ya. ♡" };
  revalidatePath("/reflect");
  return { ok: true };
}
