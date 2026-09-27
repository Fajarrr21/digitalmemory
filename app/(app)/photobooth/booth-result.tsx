"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { addAlbumMedia } from "../album/actions";
import { ensureBoothAlbum } from "./actions";
import { downloadBlob, shareBoothImage } from "./compose-strip";

/**
 * What happens to a finished strip: ↓ Download · ♡ Save (into the default
 * photobooth album, via the existing media path) · ↗ Share (story-sized PNG to
 * the OS share sheet — IG Story / WA Status on a phone; download elsewhere).
 */
export function BoothResultActions({
  blob,
  filename,
  albumTitle,
  spaceId,
  userId,
}: {
  blob: Blob;
  filename: string;
  albumTitle: string;
  spaceId: string;
  userId: string;
}) {
  const [saving, setSaving] = useState(false);
  const [savedAlbumId, setSavedAlbumId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setNote(null);
    try {
      const album = await ensureBoothAlbum(albumTitle);
      if (!album.ok || !album.id) throw new Error(album.error);

      const path = `${spaceId}/${userId}/photobooth/strips/${crypto.randomUUID()}.png`;
      const { error } = await createClient()
        .storage.from("media")
        .upload(path, blob, { contentType: "image/png", upsert: false });
      if (error) throw new Error(error.message);

      const res = await addAlbumMedia(album.id, [
        {
          storage_path: path,
          type: "image",
          mime: "image/png",
          size_bytes: blob.size,
          width: 1080,
          height: 1920,
          duration: null,
        },
      ]);
      if (res.error) throw new Error(res.error);

      setSavedAlbumId(album.id);
      setNote(`Tersimpan di “${albumTitle}” ♡`);
    } catch {
      setNote("Gagal menyimpan ke album. Coba lagi ya.");
    } finally {
      setSaving(false);
    }
  }

  async function share() {
    setSharing(true);
    setNote(null);
    try {
      const outcome = await shareBoothImage(blob, filename);
      if (outcome === "downloaded") setNote("Tersimpan ✓ tinggal upload ♡");
    } catch {
      setNote("Gagal menyiapkan gambarnya.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" variant="soft" onClick={() => downloadBlob(blob, filename)}>
          ↓ Download
        </Button>
        {savedAlbumId ? (
          <Link
            href={`/album/${savedAlbumId}`}
            className="inline-flex h-11 items-center rounded-full border border-accent-ink/40 bg-blush/30 px-6 text-[15px] font-medium text-accent-ink"
          >
            Lihat album →
          </Link>
        ) : (
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Menyimpan…" : "♡ Save"}
          </Button>
        )}
        <Button type="button" variant="soft" onClick={share} disabled={sharing}>
          {sharing ? "…" : "↗ Share"}
        </Button>
      </div>
      {note ? <p className="text-sm text-ink-faint">{note}</p> : null}
    </div>
  );
}
