"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MemoryMedia } from "@/components/memory/memory-card";
import { deleteMemory } from "./memory-actions";

export function MemoryNode({
  id,
  title,
  description,
  dateLabel,
  media,
  canDelete,
}: {
  id: string;
  title: string;
  description: string | null;
  dateLabel: string | null;
  media: MemoryMedia[];
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      await deleteMemory(id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          {dateLabel ? (
            <p className="font-mono text-[11px] uppercase tracking-wide text-accent-ink">{dateLabel}</p>
          ) : null}
          <h3 className="font-display text-xl font-medium text-ink text-balance">{title}</h3>
        </div>
        {canDelete ? (
          confirming ? (
            <span className="flex flex-none items-center gap-2 text-xs">
              <button onClick={handleDelete} disabled={pending} className="rounded-full bg-note-bg px-2.5 py-1 text-note-ink">
                {pending ? "menghapus…" : "hapus"}
              </button>
              <button onClick={() => setConfirming(false)} className="text-ink-faint">batal</button>
            </span>
          ) : (
            <button onClick={() => setConfirming(true)} className="flex-none text-xs text-ink-faint hover:text-danger" aria-label="Hapus kenangan">⋯</button>
          )
        ) : null}
      </div>

      {description ? (
        <p className="whitespace-pre-line leading-relaxed text-ink-soft">{description}</p>
      ) : null}

      {media.length > 0 ? (
        <div className={media.length === 1 ? "mt-1" : "mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3"}>
          {media.map((m) =>
            m.url ? (
              m.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={m.id}
                  src={m.url}
                  alt={m.alt ?? ""}
                  loading="lazy"
                  className="w-full rounded-lg border border-rule object-cover"
                  style={{ aspectRatio: media.length === 1 ? "auto" : "1 / 1" }}
                />
              ) : (
                <video key={m.id} src={m.url} controls muted playsInline preload="metadata" className="w-full rounded-lg border border-rule" style={{ aspectRatio: media.length === 1 ? "auto" : "1 / 1" }} />
              )
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  );
}
