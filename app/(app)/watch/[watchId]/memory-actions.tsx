"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteWatchMemory, updateWatchMemoryNote } from "../actions";

/**
 * The little line underneath a watch memory — either of you may write it, or
 * change it later. Deleting asks first: this is a kept thing, not a draft.
 */
export function MemoryActions({
  memoryId,
  initialNote,
}: {
  memoryId: string;
  initialNote: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(initialNote ?? "");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  function save() {
    startBusy(async () => {
      setError(null);
      const res = await updateWatchMemoryNote(memoryId, note);
      if (res.error) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    startBusy(async () => {
      setError(null);
      const res = await deleteWatchMemory(memoryId);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.push("/watch/history");
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-3">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Kita malah lebih banyak ketawa daripada nonton 😭"
          className="w-full resize-none rounded-xl border border-rule bg-ground px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-accent-ink/50"
        />
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setNote(initialNote ?? "");
              setEditing(false);
            }}
            className="text-sm text-ink-faint hover:text-ink-soft"
          >
            Batal
          </button>
          <Button type="button" size="sm" onClick={save} disabled={busy}>
            Simpan
          </Button>
        </div>
        {error ? <p className="text-sm text-ink-soft">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-sm text-accent-ink hover:underline"
      >
        {initialNote ? "Ubah catatan" : "+ Tambah catatan"}
      </button>
      {confirming ? (
        <span className="flex items-center gap-3 text-sm">
          <span className="text-ink-soft">Hapus momen ini?</span>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="text-ink-soft underline underline-offset-4 hover:text-ink"
          >
            Ya, hapus
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-ink-faint hover:text-ink-soft"
          >
            Batal
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-sm text-ink-faint hover:text-ink-soft"
        >
          Hapus
        </button>
      )}
      {error ? <p className="w-full text-center text-sm text-ink-soft">{error}</p> : null}
    </div>
  );
}
