"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSpaceContext } from "@/lib/auth";

export type ProfileState = { ok?: boolean; error?: string };

const ProfileSchema = z.object({
  display_name: z.string().trim().min(1, "Nama nggak boleh kosong.").max(60),
  nickname: z.string().trim().max(40).optional(),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
});

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const parsed = ProfileSchema.safeParse({
    display_name: formData.get("display_name"),
    nickname: (formData.get("nickname") as string) ?? "",
    birthday: (formData.get("birthday") as string) ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Coba cek lagi ya." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.display_name,
      nickname: parsed.data.nickname || null,
      birthday: parsed.data.birthday || null,
    })
    .eq("id", ctx.userId);
  if (error) return { error: "Gagal menyimpan. Coba lagi sebentar ya." };

  revalidatePath("/profile");
  revalidatePath("/", "layout"); // greeting uses the nickname
  return { ok: true };
}

/**
 * Point the profile at a freshly uploaded avatar (client uploads to Storage
 * first, square-cropped + compressed). Removes the previous file, best-effort.
 */
export async function saveAvatar(path: string): Promise<ProfileState> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const prefix = `${ctx.spaceId}/${ctx.userId}/avatar/`;
  if (!path.startsWith(prefix)) return { error: "Fotonya gagal dibaca. Coba lagi ya." };

  const supabase = await createClient();
  const old = ctx.profile.avatar_path;
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", ctx.userId);
  if (error) return { error: "Gagal menyimpan foto. Coba lagi ya." };

  if (old && old !== path && old.startsWith(prefix)) {
    await supabase.storage.from("media").remove([old]);
  }

  revalidatePath("/profile");
  revalidatePath("/flame");
  return { ok: true };
}

export async function removeAvatar(): Promise<ProfileState> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const supabase = await createClient();
  const old = ctx.profile.avatar_path;
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: null })
    .eq("id", ctx.userId);
  if (error) return { error: "Gagal menghapus foto. Coba lagi ya." };

  if (old && old.startsWith(`${ctx.spaceId}/${ctx.userId}/`)) {
    await supabase.storage.from("media").remove([old]);
  }

  revalidatePath("/profile");
  revalidatePath("/flame");
  return { ok: true };
}
