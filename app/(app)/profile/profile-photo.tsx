"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IMAGE_MIME, MAX_IMAGE_BYTES } from "@/lib/media-config";
import { cn } from "@/lib/utils";
import { saveAvatar, removeAvatar } from "./actions";

/**
 * Profile photo: pick → simple centre-square crop + resize on a canvas →
 * upload to Storage ({space}/{user}/avatar/…) → save the path. The photo is
 * used on the Profile, the Flame page, and the milestone share card.
 */
export function ProfilePhoto({
  spaceId,
  userId,
  avatarUrl,
  name,
}: {
  spaceId: string;
  userId: string;
  avatarUrl: string | null;
  name: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = preview ?? avatarUrl;

  async function pick(file: File | null) {
    if (!file) return;
    if (!IMAGE_MIME.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
      setError("Fotonya belum kebaca — coba format lain ya.");
      return;
    }
    setError(null);
    setWorking(true);
    try {
      const blob = await cropSquare(file, 640);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });

      const path = `${spaceId}/${userId}/avatar/${crypto.randomUUID()}.jpg`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("media")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw new Error(upErr.message);

      const res = await saveAvatar(path);
      if (res.error) throw new Error(res.error);
      router.refresh();
    } catch {
      setError("Fotonya gagal disimpan. Coba lagi sebentar ya. ♡");
      setPreview(null);
    } finally {
      setWorking(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setWorking(true);
    setError(null);
    const res = await removeAvatar();
    setWorking(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setPreview(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={working}
        aria-label={shown ? "Ganti foto profil" : "Tambah foto profil"}
        className={cn(
          "group relative h-28 w-28 overflow-hidden rounded-full border-2 border-accent/50 bg-blush/30 transition",
          working ? "opacity-60" : "hover:border-accent-ink/60",
        )}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-display text-4xl text-accent-ink">
            {(name.trim()[0] ?? "♡").toUpperCase()}
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-black/45 py-1 text-center text-[10px] text-white opacity-0 transition group-hover:opacity-100">
          {shown ? "ganti" : "tambah"}
        </span>
      </button>

      <input
        ref={input}
        type="file"
        accept={IMAGE_MIME.join(",")}
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />

      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={working}
          className="text-accent-ink hover:underline disabled:opacity-50"
        >
          {working ? "menyimpan…" : shown ? "ganti foto" : "tambah foto"}
        </button>
        {avatarUrl ? (
          <button
            type="button"
            onClick={remove}
            disabled={working}
            className="text-ink-faint hover:text-danger disabled:opacity-50"
          >
            hapus
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Centre-crop to a square and resize — the "simple crop". */
async function cropSquare(file: File, size: number): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height);
  const sx = (bmp.width - s) / 2;
  const sy = (bmp.height - s) / 2;
  const out = Math.min(size, s);

  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bmp, sx, sy, s, s, 0, 0, out, out);
  bmp.close();

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("crop failed"))),
      "image/jpeg",
      0.88,
    );
  });
}
