"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createActivity } from "./activity-actions";
import {
  ACCEPT_ATTR,
  MAX_FILES_PER_ACTIVITY,
  extFromMime,
  validateFile,
  type MediaKind,
} from "@/lib/media-config";

type Picked = { id: string; file: File; kind: MediaKind; previewUrl: string };

const fieldClass =
  "w-full rounded-xl border border-rule bg-ground px-3.5 py-2.5 text-ink placeholder:text-ink-faint outline-none transition focus:border-accent-ink/50";

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

export function ActivityComposer({
  spaceId,
  ownerId,
  todayISO,
}: {
  spaceId: string;
  ownerId: string;
  todayISO: string;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(todayISO);
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
        setError(`Maksimal ${MAX_FILES_PER_ACTIVITY} media per momen ya.`);
        break;
      }
      const v = validateFile(file);
      if (!v.ok) {
        setError(v.error ?? "Ada berkas yang tidak didukung.");
        continue;
      }
      next.push({
        id: crypto.randomUUID(),
        file,
        kind: v.kind!,
        previewUrl: URL.createObjectURL(file),
      });
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

  function reset() {
    items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    setItems([]);
    setTitle("");
    setDescription("");
    setLocation("");
    setDate(todayISO);
    setProgress(null);
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Kasih judul dulu ya.");
      return;
    }
    setWorking(true);
    setError(null);
    setProgress({ done: 0, total: items.length });

    const supabase = createClient();
    const groupId = crypto.randomUUID();
    const metas = [];

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

        const path = `${spaceId}/${ownerId}/${groupId}/${crypto.randomUUID()}.${extFromMime(it.file.type)}`;
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

      const res = await createActivity({
        title: title.trim(),
        description: description.trim() || undefined,
        activity_date: date,
        location: location.trim() || undefined,
        media: metas,
      });

      if (res.error) {
        setError(res.error);
        setWorking(false);
        return;
      }
      reset();
      setWorking(false);
      router.refresh();
    } catch {
      setError("Ada media yang gagal diunggah. Coba lagi sebentar ya. ♡");
      setWorking(false);
    }
  }

  if (!open) {
    return (
      <Button variant="soft" onClick={() => setOpen(true)} className="w-full">
        + Simpan momen hari ini
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-rule bg-paper p-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="a-title" className="text-sm text-ink-soft">Judul</label>
        <input
          id="a-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={fieldClass}
          placeholder="Misal: kencan kopi kecil"
          maxLength={120}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="a-desc" className="text-sm text-ink-soft">Ceritanya</label>
        <textarea
          id="a-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={`${fieldClass} resize-y leading-relaxed`}
          placeholder="Apa yang terjadi hari ini?"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="a-date" className="text-sm text-ink-soft">Tanggal</label>
          <input id="a-date" type="date" value={date} max={todayISO} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="a-loc" className="text-sm text-ink-soft">Lokasi <span className="text-ink-faint">(opsional)</span></label>
          <input id="a-loc" value={location} onChange={(e) => setLocation(e.target.value)} className={fieldClass} placeholder="—" maxLength={160} />
        </div>
      </div>

      {/* media */}
      <div className="flex flex-col gap-2">
        <span className="text-sm text-ink-soft">Foto / video <span className="text-ink-faint">(maks {MAX_FILES_PER_ACTIVITY})</span></span>
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
                  aria-label="Hapus media"
                >
                  ✕
                </button>
                {it.kind === "video" ? (
                  <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">video</span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
        <Button type="button" variant="ghost" size="sm" onClick={() => fileInput.current?.click()} className="self-start">
          + Tambah foto / video
        </Button>
      </div>

      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      {working && progress ? (
        <p className="text-sm text-accent-ink">
          Menyimpan… {progress.total > 0 ? `mengunggah ${progress.done}/${progress.total}` : "sebentar"}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={working} className={cn(working && "opacity-70")}>
          {working ? "Menyimpan…" : "Simpan momen"}
        </Button>
        <button type="button" onClick={reset} disabled={working} className="text-sm text-ink-faint hover:text-ink-soft">
          Batal
        </button>
      </div>
    </form>
  );
}
