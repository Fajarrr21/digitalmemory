"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPartner, getSpaceContext } from "@/lib/auth";
import type { Knowing, PresenceNote } from "@/lib/journey/queries";

// Sejauh Ini, Kita — the two things the journey keeps of its own: Presence Notes
// ("aku pernah berhenti di sini") and Things I Know About You. Neither ever
// notifies; the partner simply finds them when they walk past that stop.

const STOPS = ["beginning", "along", "little", "hard", "far", "learned", "now", "ahead"] as const;

const NoteSchema = z.object({
  stop: z.enum(STOPS),
  body: z.string().trim().min(1, "Tulis sesuatu dulu ya.").max(280, "Maksimal 280 huruf."),
});

const KnowingSchema = z.object({
  emoji: z.string().trim().min(1).max(16),
  label: z.string().trim().min(1).max(40),
  body: z.string().trim().min(1, "Tulis sesuatu dulu ya.").max(200, "Maksimal 200 huruf."),
});

type Result<T> = { ok: true; item: T } | { ok: false; error: string };

export async function leavePresenceNote(input: z.input<typeof NoteSchema>): Promise<Result<PresenceNote>> {
  const ctx = await getSpaceContext();
  if (!ctx) return { ok: false, error: "Sesi kamu habis. Masuk lagi ya." };
  const parsed = NoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Coba cek lagi." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journey_notes")
    .insert({
      space_id: ctx.spaceId,
      author_id: ctx.userId,
      stop: parsed.data.stop,
      body: parsed.data.body,
    })
    .select("id, stop, author_id, body, created_at")
    .single();
  if (error || !data) return { ok: false, error: "Jejaknya belum tersimpan. Coba lagi ya. ♡" };

  revalidatePath("/journey");
  return {
    ok: true,
    item: {
      id: data.id,
      stop: data.stop,
      authorId: data.author_id,
      body: data.body,
      createdAt: data.created_at,
    },
  };
}

export async function removePresenceNote(id: string): Promise<{ ok: boolean }> {
  const ctx = await getSpaceContext();
  if (!ctx || !z.uuid().safeParse(id).success) return { ok: false };
  const supabase = await createClient();
  // RLS only lets you delete your own; the author filter just says so out loud.
  const { error } = await supabase
    .from("journey_notes")
    .delete()
    .eq("id", id)
    .eq("author_id", ctx.userId);
  revalidatePath("/journey");
  return { ok: !error };
}

export async function addKnowing(input: z.input<typeof KnowingSchema>): Promise<Result<Knowing>> {
  const ctx = await getSpaceContext();
  if (!ctx) return { ok: false, error: "Sesi kamu habis. Masuk lagi ya." };
  const parsed = KnowingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Coba cek lagi." };
  const partner = await getPartner(ctx.spaceId, ctx.userId);
  if (!partner) return { ok: false, error: "Belum ada dia di space ini." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journey_knowings")
    .insert({
      space_id: ctx.spaceId,
      author_id: ctx.userId,
      about_id: partner.id,
      ...parsed.data,
    })
    .select("id, author_id, about_id, emoji, label, body")
    .single();
  if (error || !data) return { ok: false, error: "Belum tersimpan. Coba lagi ya. ♡" };

  revalidatePath("/journey");
  return {
    ok: true,
    item: {
      id: data.id,
      authorId: data.author_id,
      aboutId: data.about_id,
      emoji: data.emoji,
      label: data.label,
      body: data.body,
    },
  };
}

export async function removeKnowing(id: string): Promise<{ ok: boolean }> {
  const ctx = await getSpaceContext();
  if (!ctx || !z.uuid().safeParse(id).success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("journey_knowings")
    .delete()
    .eq("id", id)
    .eq("author_id", ctx.userId);
  revalidatePath("/journey");
  return { ok: !error };
}
