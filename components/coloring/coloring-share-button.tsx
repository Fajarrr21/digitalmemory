"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { formatDateLabel } from "@/lib/date";
import type { ColoringTemplate } from "@/app/(app)/today/coloring-config";
import type { Fills } from "./coloring-svg";
import { shareColoringCard } from "./share-card";

/**
 * "Bagikan ke story" — exports the memory card as a story-sized image and
 * opens the OS share sheet (IG Story / WA Status on a phone); downloads the
 * image on devices without file sharing.
 */
export function ColoringShareButton({
  template,
  fills,
  score,
  dateISO,
  variant = "soft",
  size = "md",
}: {
  template: ColoringTemplate;
  fills: Fills;
  score: number;
  dateISO: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function handleShare() {
    setBusy(true);
    setNote(null);
    setError(false);
    try {
      const outcome = await shareColoringCard({
        template,
        fills,
        score,
        dateISO,
        dateLabel: formatDateLabel(dateISO),
      });
      if (outcome === "downloaded") {
        setNote("Gambar tersimpan ✓ tinggal upload ke story-mu ♡");
      }
    } catch {
      setError(true);
      setNote("Gagal menyiapkan gambarnya. Coba lagi ya.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button type="button" variant={variant} size={size} onClick={handleShare} disabled={busy}>
        {busy ? "Menyiapkan…" : "📤 Bagikan ke story"}
      </Button>
      {note ? (
        <p
          role={error ? "alert" : "status"}
          className={error ? "text-sm text-danger" : "text-sm text-ink-soft"}
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}
