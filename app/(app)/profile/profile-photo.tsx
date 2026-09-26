"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { IMAGE_MIME, MAX_IMAGE_BYTES } from "@/lib/media-config";
import { cn } from "@/lib/utils";
import { saveAvatar, removeAvatar } from "./actions";

/**
 * Profile photo with an IG-style adjuster: pick a photo, then pan (drag) and
 * zoom (slider) inside a circular viewport until it sits right, save → the
 * visible square is exported from a canvas, uploaded to Storage
 * ({space}/{user}/avatar/…) and set as the avatar. Used on the Profile, the
 * Flame page, and the milestone share card.
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
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(file: File | null) {
    if (!file) return;
    if (!IMAGE_MIME.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
      setError("Fotonya belum kebaca — coba format lain ya.");
      return;
    }
    setError(null);
    setCropSrc((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
    if (input.current) input.current.value = "";
  }

  async function upload(blob: Blob) {
    setWorking(true);
    setError(null);
    try {
      const path = `${spaceId}/${userId}/avatar/${crypto.randomUUID()}.jpg`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("media")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw new Error(upErr.message);

      const res = await saveAvatar(path);
      if (res.error) throw new Error(res.error);
      setCropSrc(null);
      router.refresh();
    } catch {
      setError("Fotonya gagal disimpan. Coba lagi sebentar ya. ♡");
    } finally {
      setWorking(false);
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
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={working}
        aria-label={avatarUrl ? "Ganti foto profil" : "Tambah foto profil"}
        className={cn(
          "group relative h-28 w-28 overflow-hidden rounded-full border-2 border-accent/50 bg-blush/30 transition",
          working ? "opacity-60" : "hover:border-accent-ink/60",
        )}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-display text-4xl text-accent-ink">
            {(name.trim()[0] ?? "♡").toUpperCase()}
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-black/45 py-1 text-center text-[10px] text-white opacity-0 transition group-hover:opacity-100">
          {avatarUrl ? "ganti" : "tambah"}
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
          {working ? "menyimpan…" : avatarUrl ? "ganti foto" : "tambah foto"}
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

      {cropSrc ? (
        <CropModal
          src={cropSrc}
          saving={working}
          onCancel={() => {
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
          }}
          onSave={upload}
        />
      ) : null}
    </div>
  );
}

// ---- IG-style circular crop --------------------------------------------------

const VIEW = 280; // px, square viewport (the circle inscribes it)
const OUT = 640; // exported size
const MAX_ZOOM = 3;

function CropModal({
  src,
  saving,
  onCancel,
  onSave,
}: {
  src: string;
  saving: boolean;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 }); // image top-left rel. viewport
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const baseScale = nat ? Math.max(VIEW / nat.w, VIEW / nat.h) : 1;
  const scale = baseScale * zoom;

  const clamp = (o: { x: number; y: number }, s: number) => {
    if (!nat) return o;
    return {
      x: Math.min(0, Math.max(VIEW - nat.w * s, o.x)),
      y: Math.min(0, Math.max(VIEW - nat.h * s, o.y)),
    };
  };

  // Centre the image once its natural size is known.
  useEffect(() => {
    if (!nat) return;
    const s = Math.max(VIEW / nat.w, VIEW / nat.h);
    setOff({ x: (VIEW - nat.w * s) / 2, y: (VIEW - nat.h * s) / 2 });
    setZoom(1);
  }, [nat]);

  function onZoom(nextZoom: number) {
    if (!nat) return;
    const oldScale = baseScale * zoom;
    const newScale = baseScale * nextZoom;
    // Keep the viewport centre fixed while zooming.
    const cx = VIEW / 2;
    const next = {
      x: cx - ((cx - off.x) / oldScale) * newScale,
      y: cx - ((cx - off.y) / oldScale) * newScale,
    };
    setZoom(nextZoom);
    setOff(clamp(next, newScale));
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: off.x, oy: off.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const d = drag.current;
    setOff(clamp({ x: d.ox + (e.clientX - d.px), y: d.oy + (e.clientY - d.py) }, scale));
  }
  function onPointerUp() {
    drag.current = null;
  }

  async function save() {
    const img = imgRef.current;
    if (!img || !nat) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Source rect = the viewport square mapped back into image pixels.
    const sx = -off.x / scale;
    const sy = -off.y / scale;
    const sw = VIEW / scale;
    ctx.drawImage(img, sx, sy, sw, sw, 0, 0, OUT, OUT);
    canvas.toBlob(
      (b) => {
        if (b) onSave(b);
      },
      "image/jpeg",
      0.88,
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Atur foto profil"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border border-rule bg-paper p-6">
        <p className="font-display text-lg font-medium text-ink">Atur fotomu</p>
        <p className="-mt-2 text-xs text-ink-faint">geser buat mindahin · slider buat zoom</p>

        <div
          className="relative touch-none overflow-hidden rounded-full border-2 border-accent/50 select-none"
          style={{ width: VIEW, height: VIEW, cursor: drag.current ? "grabbing" : "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => {
              const el = e.currentTarget;
              setNat({ w: el.naturalWidth, h: el.naturalHeight });
            }}
            className="pointer-events-none absolute max-w-none"
            style={
              nat
                ? {
                    width: nat.w * scale,
                    height: nat.h * scale,
                    left: off.x,
                    top: off.y,
                  }
                : { opacity: 0 }
            }
          />
        </div>

        <label className="flex w-full items-center gap-3 text-sm text-ink-soft">
          <span aria-hidden>－</span>
          <input
            type="range"
            min={100}
            max={MAX_ZOOM * 100}
            value={zoom * 100}
            onChange={(e) => onZoom(Number(e.target.value) / 100)}
            className="w-full accent-[var(--accent)]"
            aria-label="Zoom"
          />
          <span aria-hidden>＋</span>
        </label>

        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Batal
          </Button>
          <Button type="button" size="md" onClick={save} disabled={saving || !nat}>
            {saving ? "Menyimpan…" : "Pakai foto ini ♡"}
          </Button>
        </div>
      </div>
    </div>
  );
}
