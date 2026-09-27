"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSpaceContext } from "@/lib/auth";
import { signPaths } from "@/lib/media";
import type { BoothStatus } from "@/lib/supabase/database.types";
import { frameById } from "./photobooth-config";

/**
 * Both of Us photobooth — session lifecycle. Every action re-checks the space
 * context; RLS is the real gate underneath. Just Me mode never calls these
 * (it's fully client-side until the strip is saved to an album).
 */

export type BoothResult = { ok?: boolean; error?: string; id?: string };

export type BoothPhoto = {
  userId: string;
  shotIndex: number;
  path: string;
  url: string | null;
};

export type BoothSnapshot = {
  id: string;
  status: BoothStatus;
  frameId: string;
  shotCount: number;
  creatorId: string;
  participantId: string | null;
  creatorName: string;
  participantName: string | null;
  expired: boolean;
  photos: BoothPhoto[];
};

const ShotCountSchema = z.union([z.literal(1), z.literal(4)]);
const ShotIndexSchema = z.number().int().min(0).max(3);

export async function createBoothSession(
  shotCount: number,
  frameId?: string,
): Promise<BoothResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const shots = ShotCountSchema.safeParse(shotCount);
  if (!shots.success) return { error: "Jumlah foto tidak valid." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("photobooth_sessions")
    .insert({
      space_id: ctx.spaceId,
      creator_id: ctx.userId,
      shot_count: shots.data,
      frame_id: frameById(frameId ?? null).id,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "Gagal menyiapkan photobooth. Coba lagi ya. ♡" };
  return { ok: true, id: data.id };
}

/** The poll target — everything the duo client needs to render its phase. */
export async function getBoothState(sessionId: string): Promise<{
  ok?: boolean;
  error?: string;
  session?: BoothSnapshot;
}> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const supabase = await createClient();
  const { data: s } = await supabase
    .from("photobooth_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("space_id", ctx.spaceId)
    .maybeSingle();
  if (!s) return { error: "Photobooth ini tidak ditemukan." };

  const [{ data: photos }, { data: profiles }] = await Promise.all([
    supabase
      .from("photobooth_photos")
      .select("user_id, shot_index, storage_path")
      .eq("session_id", sessionId),
    supabase
      .from("profiles")
      .select("id, nickname, display_name")
      .in("id", [s.creator_id, s.participant_id].filter((v): v is string => !!v)),
  ]);

  const nameOf = (id: string | null) => {
    if (!id) return null;
    const p = (profiles ?? []).find((x) => x.id === id);
    return p ? p.nickname || p.display_name : "…";
  };

  const urls = await signPaths((photos ?? []).map((p) => p.storage_path));

  return {
    ok: true,
    session: {
      id: s.id,
      status: s.status,
      frameId: s.frame_id,
      shotCount: s.shot_count,
      creatorId: s.creator_id,
      participantId: s.participant_id,
      creatorName: nameOf(s.creator_id) ?? "…",
      participantName: nameOf(s.participant_id),
      expired: s.status === "waiting" && new Date(s.expires_at).getTime() < Date.now(),
      photos: (photos ?? []).map((p) => ({
        userId: p.user_id,
        shotIndex: p.shot_index,
        path: p.storage_path,
        url: urls[p.storage_path] ?? null,
      })),
    },
  };
}

export async function joinBoothSession(sessionId: string): Promise<BoothResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const supabase = await createClient();
  const { data: s } = await supabase
    .from("photobooth_sessions")
    .select("id, creator_id, participant_id, status, expires_at")
    .eq("id", sessionId)
    .eq("space_id", ctx.spaceId)
    .maybeSingle();
  if (!s) return { error: "Photobooth ini tidak ditemukan." };
  if (s.creator_id === ctx.userId) return { ok: true }; // creator "joining" own booth
  if (s.participant_id && s.participant_id !== ctx.userId)
    return { error: "Photobooth ini sudah penuh." };
  if (s.status === "waiting" && new Date(s.expires_at).getTime() < Date.now())
    return { error: "Undangan ini sudah kedaluwarsa. Minta link baru ya. ♡" };

  const { error } = await supabase
    .from("photobooth_sessions")
    .update({
      participant_id: ctx.userId,
      status: s.status === "waiting" ? "joined" : s.status,
    })
    .eq("id", sessionId);
  if (error) return { error: "Gagal bergabung. Coba lagi ya." };
  return { ok: true };
}

/** Either member may re-pick the frame until the strip is revealed. */
export async function setBoothFrame(sessionId: string, frameId: string): Promise<BoothResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("photobooth_sessions")
    .update({ frame_id: frameById(frameId).id })
    .eq("id", sessionId)
    .eq("space_id", ctx.spaceId)
    .neq("status", "completed");
  if (error) return { error: "Gagal memilih frame." };
  return { ok: true };
}

export async function setBoothShots(sessionId: string, shotCount: number): Promise<BoothResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const shots = ShotCountSchema.safeParse(shotCount);
  if (!shots.success) return { error: "Jumlah foto tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("photobooth_sessions")
    .update({ shot_count: shots.data })
    .eq("id", sessionId)
    .eq("space_id", ctx.spaceId)
    .in("status", ["waiting", "joined"]);
  if (error) return { error: "Gagal mengatur mode." };
  return { ok: true };
}

/** "Now let's make a memory." — moves the lobby into the shooting phase. */
export async function startBoothShooting(sessionId: string): Promise<BoothResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("photobooth_sessions")
    .update({ status: "shooting" })
    .eq("id", sessionId)
    .eq("space_id", ctx.spaceId)
    .eq("status", "joined");
  if (error) return { error: "Gagal memulai sesi foto." };
  return { ok: true };
}

/** Record my photo for one shot (the file is already in Storage). */
export async function saveBoothPhoto(
  sessionId: string,
  shotIndex: number,
  storagePath: string,
): Promise<BoothResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const idx = ShotIndexSchema.safeParse(shotIndex);
  if (!idx.success) return { error: "Nomor foto tidak valid." };

  // Defence-in-depth: the object must live under this user's session folder.
  const prefix = `${ctx.spaceId}/${ctx.userId}/photobooth/${sessionId}/`;
  if (!storagePath.startsWith(prefix)) return { error: "Berkas tidak sah." };

  const supabase = await createClient();
  const { error } = await supabase.from("photobooth_photos").upsert(
    {
      session_id: sessionId,
      user_id: ctx.userId,
      shot_index: idx.data,
      storage_path: storagePath,
    },
    { onConflict: "session_id,user_id,shot_index" },
  );
  if (error) return { error: "Gagal menyimpan foto. Coba lagi ya." };
  return { ok: true };
}

/** Retake: drop my photo for one shot (only while still shooting). */
export async function clearBoothPhoto(sessionId: string, shotIndex: number): Promise<BoothResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("photobooth_photos")
    .delete()
    .eq("session_id", sessionId)
    .eq("user_id", ctx.userId)
    .eq("shot_index", shotIndex);
  if (error) return { error: "Gagal menghapus foto." };
  return { ok: true };
}

/** "Show me" — only flips to completed once every slot is filled. */
export async function completeBooth(sessionId: string): Promise<BoothResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const supabase = await createClient();
  const { data: s } = await supabase
    .from("photobooth_sessions")
    .select("id, shot_count, participant_id, status")
    .eq("id", sessionId)
    .eq("space_id", ctx.spaceId)
    .maybeSingle();
  if (!s) return { error: "Photobooth ini tidak ditemukan." };
  if (s.status === "completed") return { ok: true };
  if (!s.participant_id) return { error: "Pasanganmu belum bergabung." };

  const { count } = await supabase
    .from("photobooth_photos")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId);
  if ((count ?? 0) < s.shot_count * 2) return { error: "Fotonya belum lengkap." };

  const { error } = await supabase
    .from("photobooth_sessions")
    .update({ status: "completed" })
    .eq("id", sessionId);
  if (error) return { error: "Gagal menyelesaikan sesi." };
  return { ok: true };
}

/** Find-or-create the album a finished strip is kept in. */
export async function ensureBoothAlbum(title: string): Promise<BoothResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const clean = z.string().trim().min(1).max(80).safeParse(title);
  if (!clean.success) return { error: "Nama album tidak valid." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("albums")
    .select("id")
    .eq("space_id", ctx.spaceId)
    .eq("title", clean.data)
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: true, id: existing.id };

  const { data, error } = await supabase
    .from("albums")
    .insert({ space_id: ctx.spaceId, title: clean.data, created_by: ctx.userId })
    .select("id")
    .single();
  if (error || !data) return { error: "Gagal menyiapkan album." };
  return { ok: true, id: data.id };
}
