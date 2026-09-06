"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PaperCard } from "@/components/ui/paper-card";
import { deleteActivity } from "@/app/(app)/today/activity-actions";

export type MemoryMedia = {
  id: string;
  type: "image" | "video";
  url: string | null;
  alt: string | null;
};

export type MemoryCardProps = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  dateLabel?: string;
  media: MemoryMedia[];
  canDelete?: boolean;
};

export function MemoryCard(props: MemoryCardProps) {
  const { id, title, description, location, dateLabel, media, canDelete } = props;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      await deleteActivity(id);
      router.refresh();
    });
  }

  return (
    <PaperCard className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-medium text-ink text-balance">{title}</h3>
          {(location || dateLabel) && (
            <p className="mt-0.5 font-mono text-xs text-ink-faint">
              {[dateLabel, location].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        {canDelete ? (
          confirming ? (
            <span className="flex flex-none items-center gap-2 text-xs">
              <button onClick={handleDelete} disabled={pending} className="rounded-full bg-note-bg px-2.5 py-1 text-note-ink hover:brightness-95">
                {pending ? "menghapus…" : "hapus momen"}
              </button>
              <button onClick={() => setConfirming(false)} className="text-ink-faint hover:text-ink-soft">
                batal
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-rule text-ink-faint transition hover:border-danger/40 hover:text-danger"
              aria-label="Hapus momen"
              title="Hapus momen"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6" />
              </svg>
            </button>
          )
        ) : null}
      </div>

      {description ? (
        <p className="whitespace-pre-line leading-relaxed text-ink-soft">{description}</p>
      ) : null}

      {media.length > 0 ? (
        <div className={media.length === 1 ? "" : "grid grid-cols-2 gap-2 sm:grid-cols-3"}>
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
                <video
                  key={m.id}
                  src={m.url}
                  controls
                  muted
                  playsInline
                  preload="metadata"
                  className="w-full rounded-lg border border-rule"
                  style={{ aspectRatio: media.length === 1 ? "auto" : "1 / 1" }}
                />
              )
            ) : null,
          )}
        </div>
      ) : null}
    </PaperCard>
  );
}
