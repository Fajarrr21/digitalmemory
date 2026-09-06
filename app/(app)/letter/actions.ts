"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSpaceContext } from "@/lib/auth";
import { LETTER_CATEGORIES } from "./categories";

/** Mark today's letter as opened. RLS ensures only the recipient can. */
export async function openLetter(letterId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("daily_letters")
    .update({ status: "opened", opened_at: new Date().toISOString() })
    .eq("id", letterId)
    .eq("status", "sealed");

  if (error) return { ok: false };
  revalidatePath("/letter");
  revalidatePath("/");
  return { ok: true };
}

const PoolLetterSchema = z.object({
  category: z.enum(LETTER_CATEGORIES),
  title: z.string().trim().max(120).optional(),
  body: z
    .string()
    .trim()
    .min(20, "Suratnya kependekan — tulis sedikit lebih panjang ya.")
    .max(2000, "Wah, kepanjangan. Persingkat sedikit ya."),
});

export type AddLetterState = { ok?: boolean; error?: string };

/** Author-only: add a letter to the pool. RLS enforces the author role too. */
export async function addPoolLetter(
  _prev: AddLetterState,
  formData: FormData,
): Promise<AddLetterState> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Coba masuk lagi ya." };
  if (ctx.role !== "author") return { error: "Cuma penulis surat yang bisa nambah." };

  const parsed = PoolLetterSchema.safeParse({
    category: formData.get("category"),
    title: (formData.get("title") as string) || undefined,
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Coba cek lagi isinya." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("letter_pool").insert({
    space_id: ctx.spaceId,
    author_id: ctx.userId,
    category: parsed.data.category,
    title: parsed.data.title ?? null,
    body: parsed.data.body,
  });

  if (error) return { error: "Suratnya nyangkut di jalan. Coba lagi sebentar ya. ♡" };
  revalidatePath("/letter");
  return { ok: true };
}
