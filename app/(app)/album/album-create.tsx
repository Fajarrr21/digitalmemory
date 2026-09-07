"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createAlbum } from "./actions";

export function AlbumCreate() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) {
      setError("Kasih nama albumnya ya.");
      return;
    }
    setWorking(true);
    setError(null);
    const res = await createAlbum(title.trim());
    if (res.error || !res.id) {
      setError(res.error ?? "Gagal bikin album.");
      setWorking(false);
      return;
    }
    router.push(`/album/${res.id}`);
  }

  if (!open) {
    return (
      <Button variant="soft" onClick={() => setOpen(true)} className="w-full sm:w-auto">
        + Album baru
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-rule bg-paper p-4 sm:flex-row sm:items-center">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Nama album — misal: Liburan Bali"
        maxLength={80}
        className="w-full flex-1 rounded-xl border border-rule bg-ground px-3.5 py-2.5 text-ink placeholder:text-ink-faint outline-none transition focus:border-accent-ink/50"
      />
      <div className="flex items-center gap-2">
        <Button onClick={submit} disabled={working}>
          {working ? "Membuat…" : "Buat"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTitle("");
            setError(null);
          }}
          className="text-sm text-ink-faint hover:text-ink-soft"
        >
          Batal
        </button>
      </div>
      {error ? <p role="alert" className="text-sm text-danger sm:w-full">{error}</p> : null}
    </div>
  );
}
