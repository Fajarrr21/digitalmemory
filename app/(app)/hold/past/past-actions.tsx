"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteHold, setHoldKept } from "../actions";

/** Retention controls for one kept session — sender only, always confirmed. */
export function PastActions({ id, partnerName }: { id: string; partnerName: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<null | "release" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function go() {
    if (!confirm) return;
    const which = confirm;
    start(async () => {
      setError(null);
      try {
        const res =
          which === "release" ? await setHoldKept({ id, keep: false }) : await deleteHold(id);
        if (res.ok) {
          setConfirm(null);
          router.refresh();
        } else setError(res.error ?? null);
      } catch {
        setError("Koneksinya terputus. Coba lagi ya.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-rule-soft pt-3">
      {confirm ? (
        <div role="group" aria-label="Konfirmasi">
          <p className="text-sm text-ink">
            {confirm === "release"
              ? `Lepaskan? Kata-katanya dihapus sekarang (juga dari tampilan ${partnerName}), dan sisa ruangnya hilang dalam 7 hari.`
              : `Hapus selamanya? Hilang untuk kamu dan ${partnerName}, termasuk gestur dan pesannya. Tidak bisa dikembalikan.`}
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirm(null)} disabled={pending}>
              Batal
            </Button>
            <Button variant="soft" size="sm" onClick={go} disabled={pending} aria-busy={pending}>
              {pending ? "Sebentar…" : confirm === "release" ? "Ya, lepaskan" : "Ya, hapus"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setConfirm("release")}>
            Lepaskan
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirm("delete")}>
            Hapus
          </Button>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
