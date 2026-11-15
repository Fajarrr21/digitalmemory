"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/** Our Dice Memories belong to both of us — RLS (is_member) is the gate. */

const Uuid = z.string().uuid();

export async function updateMemory(
  id: string,
  patch: { note?: string | null; favorite?: boolean },
): Promise<{ ok?: boolean; error?: string }> {
  if (!Uuid.safeParse(id).success) return { error: "Kenangan ini tidak ditemukan." };
  const note = patch.note === undefined ? undefined : patch.note?.trim().slice(0, 1000) || null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dice_memories")
    .update({ ...(note !== undefined && { note }), ...(patch.favorite !== undefined && { favorite: patch.favorite }) })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { error: "Gagal menyimpan. Coba lagi ya." };
  revalidatePath("/dice/memories");
  return { ok: true };
}

export async function deleteMemory(id: string): Promise<{ ok?: boolean; error?: string }> {
  if (!Uuid.safeParse(id).success) return { error: "Kenangan ini tidak ditemukan." };
  const supabase = await createClient();
  const { error } = await supabase.from("dice_memories").delete().eq("id", id);
  if (error) return { error: "Gagal menghapus. Coba lagi ya." };
  revalidatePath("/dice/memories");
  return { ok: true };
}
