"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addAlbumMedia } from "./actions";
import {
  ACCEPT_ATTR,
  MAX_FILES_PER_ACTIVITY,
  extFromMime,
  validateFile,
  type MediaKind,
} from "@/lib/media-config";

type Picked = { id: string; file: File; kind: MediaKind; previewUrl: string };

async function readImageDims(file: Blob): Promise<{ width: number; height: number } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const dims = { width: bmp.width, height: bmp.height };
    bmp.close();
    return dims;
  } catch {
    return null;
  }
}

export function AlbumUploader({
  spaceId,
  ownerId,
  albumId,
}: {
  spaceId: string;
  ownerId: string;
  albumId: string;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Picked[]>([]);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const next: Picked[] = [];
    for (const file of Array.from(list)) {
      if (items.length + next.length >= MAX_FILES_PER_ACTIVITY) {
        setError(`Maksimal ${MAX_FILES_PER_ACTIVITY} media sekali unggah ya.`);
        break;
      }
      const v = validateFile(file);
      if (!v.ok) {
        setError(v.error ?? "Ada berkas yang tidak didukung.");
        continue;
      }
      next.push({ id: crypto.randomUUID(), file, kind: v.kind!, previewUrl: URL.createObjectURL(file) });
    }
    if (next.length) setItems((prev) => [...prev, ...next]);
    if (fileInput.current) fileInput.current.value = "";
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const found = prev.find((p) => p.id === id);
      if (found) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function upload() {
    if (items.length === 0) return;
    setWorking(true);
    setError(null);
    setProgress({ done: 0, total: items.length });

    const supabase = createClient();
    const groupId = crypto.randomUUID();
    const metas: {
      storage_path: string;
      type: "image" | "video";
      mime: string;
      size_bytes: number;
      width: number | null;
      height: number | null;
      duration: number | null;
    }[] = [];

    try {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        let toUpload: Blob = it.file;
        let width: number | null = null;
        let height: number | null = null;

        if (it.kind === "image") {
          toUpload = await imageCompression(it.file, {
            maxSizeMB: 1.5,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          });
          const dims = await readImageDims(toUpload);
          width = dims?.width ?? null;
          height = dims?.height ?? null;
        }

        const path = `${spaceId}/${ownerId}/album/${albumId}/${groupId}/${crypto.randomUUID()}.${extFromMime(it.file.type)}`;
        const { error: upErr } = await supabase.storage
          .from("media")
          .upload(path, toUpload, { contentType: it.file.type, upsert: false });
        if (upErr) throw new Error(upErr.message);

        metas.push({
          storage_path: path,
          type: it.kind,
          mime: it.file.type,
          size_bytes: toUpload.size,
          width,
          height,
          duration: null,
        });
        setProgress({ done: i + 1, total: items.length });
      }

      const res = await addAlbumMedia(albumId, metas);
      if (res.error) {
        setError(res.error);
        setWorking(false);
        return;
      }
      items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
      setItems([]);
      setProgress(null);
      setWorking(false);
      router.refresh();
    } catch {
      setError("Ada media yang gagal diunggah. Coba lagi sebentar ya. ♡");
      setWorking(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-rule bg-paper p-4">
      {items.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((it) => (
            <div key={it.id} className="group relative aspect-square overflow-hidden rounded-lg border border-rule bg-paper-2">
              {it.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <video src={it.previewUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
              )}
              <button
                type="button"
                onClick={() => removeItem(it.id)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full opacity-0 transition group-hover:opacity-100"
                style={{ background: "rgba(64,58,54,0.75)", color: "#fff" }}
                aria-label="Buang"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <input ref={fileInput} type="file" accept={ACCEPT_ATTR} multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />

      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      {working && progress ? (
        <p className="text-sm text-accent-ink">Mengunggah {progress.done}/{progress.total}…</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => fileInput.current?.click()} disabled={working}>
          + Pilih foto / video
        </Button>
        {items.length > 0 ? (
          <Button type="button" onClick={upload} disabled={working} className={cn(working && "opacity-70")}>
            {working ? "Mengunggah…" : `Unggah ${items.length} ke album`}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
