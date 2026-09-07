"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AlbumItem } from "@/lib/albums";
import { deleteAlbumMedia } from "./actions";

export function AlbumGallery({ items }: { items: AlbumItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const current = open != null ? items[open] : null;

  function close() {
    setOpen(null);
    setConfirming(false);
  }
  function go(delta: number) {
    setConfirming(false);
    setOpen((i) => {
      if (i == null) return i;
      const n = i + delta;
      return n >= 0 && n < items.length ? n : i;
    });
  }

  useEffect(() => {
    if (open == null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items.length]);

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteAlbumMedia(id);
      if (res.ok) {
        setConfirming(false);
        setOpen(null);
        router.refresh();
      }
    });
  }

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-rule py-10 text-center text-sm text-ink-faint">
        Album ini masih kosong. Unggah foto atau video pertama kalian. ♡
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
        {items.map((m, i) =>
          m.url ? (
            <button
              key={m.id}
              type="button"
              onClick={() => setOpen(i)}
              className="group relative aspect-square overflow-hidden rounded-lg border border-rule bg-paper-2"
            >
              {m.type === "video" ? (
                <>
                  <video src={m.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white">▶</span>
                  </span>
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:brightness-105" />
              )}
            </button>
          ) : null,
        )}
      </div>

      {current?.url ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={close}
        >
          <div className="flex items-center justify-between p-3 text-white/90">
            <span className="font-mono text-xs">{open! + 1} / {items.length}</span>
            <div className="flex items-center gap-2">
              {confirming ? (
                <span className="flex items-center gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => remove(current.id)}
                    disabled={pending}
                    className="rounded-full bg-danger px-3 py-1.5 text-white hover:brightness-95"
                  >
                    {pending ? "menghapus…" : "hapus beneran"}
                  </button>
                  <button onClick={() => setConfirming(false)} className="rounded-full bg-white/15 px-3 py-1.5">
                    batal
                  </button>
                </span>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirming(true);
                  }}
                  className="rounded-full bg-white/15 px-3 py-1.5 text-xs hover:bg-white/25"
                >
                  Hapus
                </button>
              )}
              <button onClick={close} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg hover:bg-white/25" aria-label="Tutup">
                ✕
              </button>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center px-2 pb-4" onClick={(e) => e.stopPropagation()}>
            {open! > 0 ? (
              <button onClick={() => go(-1)} className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white/15 text-white text-xl hover:bg-white/25" aria-label="Sebelumnya">
                ‹
              </button>
            ) : (
              <span className="h-11 w-11 flex-none" />
            )}

            <div className="mx-2 flex max-h-full max-w-3xl flex-1 items-center justify-center">
              {current.type === "video" ? (
                <video src={current.url} controls autoPlay playsInline className="max-h-[80vh] max-w-full rounded-lg" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.url} alt="" className="max-h-[80vh] max-w-full rounded-lg object-contain" />
              )}
            </div>

            {open! < items.length - 1 ? (
              <button onClick={() => go(1)} className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white/15 text-white text-xl hover:bg-white/25" aria-label="Berikutnya">
                ›
              </button>
            ) : (
              <span className="h-11 w-11 flex-none" />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
