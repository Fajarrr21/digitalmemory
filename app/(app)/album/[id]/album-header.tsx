"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renameAlbum, deleteAlbum } from "../actions";

export function AlbumHeader({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    const t = value.trim();
    if (!t || t === title) {
      setEditing(false);
      setValue(title);
      return;
    }
    startTransition(async () => {
      const res = await renameAlbum(id, t);
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteAlbum(id);
      if (res.ok) router.push("/album");
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setEditing(false);
              setValue(title);
            }
          }}
          onBlur={save}
          maxLength={80}
          className="flex-1 rounded-xl border border-rule bg-ground px-3.5 py-2 font-display text-2xl font-medium text-ink outline-none focus:border-accent-ink/50"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-left font-display text-3xl font-medium text-ink hover:text-accent-ink"
          title="Ganti nama album"
        >
          {title}
        </button>
      )}

      <div className="flex items-center gap-2 text-sm">
        {confirming ? (
          <>
            <button
              onClick={remove}
              disabled={pending}
              className="rounded-full bg-danger px-3 py-1.5 text-white hover:brightness-95"
            >
              {pending ? "menghapus…" : "hapus album + isinya"}
            </button>
            <button onClick={() => setConfirming(false)} className="text-ink-faint hover:text-ink-soft">
              batal
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="rounded-full border border-rule px-3 py-1.5 text-ink-faint transition hover:border-danger/40 hover:text-danger"
          >
            Hapus album
          </button>
        )}
      </div>
    </div>
  );
}
