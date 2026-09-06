"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSpaceContext } from "@/lib/auth";
import { getKeeperId } from "@/lib/for-you";

const MessageSchema = z.object({
  title: z.string().trim().min(1, "Kasih judul dulu ya.").max(160),
  body: z.string().trim().min(1, "Isinya masih kosong.").max(4000),
});

export type ForYouState = { ok?: boolean; error?: string };

export async function createMessage(_prev: ForYouState, formData: FormData): Promise<ForYouState> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };
  if (ctx.role !== "author") return { error: "Cuma kamu yang bisa menitipkan pesan." };

  const parsed = MessageSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Coba cek lagi ya." };

  const recipientId = await getKeeperId(ctx.spaceId);
  if (!recipientId) return { error: "Belum ada penerima di space ini." };

  const supabase = await createClient();
  const { error } = await supabase.from("special_messages").insert({
    space_id: ctx.spaceId,
    recipient_id: recipientId,
    author_id: ctx.userId,
    title: parsed.data.title,
    body: parsed.data.body,
    unlock_type: "always",
  });
  if (error) return { error: "Gagal menyimpan pesan. Coba lagi ya. ♡" };

  revalidatePath("/for-you");
  return { ok: true };
}

export async function openMessage(messageId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("special_messages")
    .update({ opened_at: new Date().toISOString() })
    .eq("id", messageId)
    .is("opened_at", null);
  if (error) return { ok: false };
  revalidatePath("/for-you");
  return { ok: true };
}

export async function deleteMessage(messageId: string): Promise<{ ok: boolean }> {
  const ctx = await getSpaceContext();
  if (!ctx || ctx.role !== "author") return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("special_messages").delete().eq("id", messageId);
  if (error) return { ok: false };
  revalidatePath("/for-you");
  return { ok: true };
}
