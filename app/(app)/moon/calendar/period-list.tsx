"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { diffDays, type Period } from "@/lib/moon/cycle";
import { formatShortDate } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { deletePeriod, savePeriod } from "../actions";

/** Every logged period — editable dates, deletable with a confirm. Newest first. */
export function PeriodList({ periods, today }: { periods: Period[]; today: string }) {
  if (!periods.length) {
    return (
      <p className="rounded-2xl border border-dashed border-rule px-5 py-4 text-sm text-ink-soft">
        Belum ada riwayat. Catatan pertamamu akan muncul di sini.
      </p>
    );
  }
  return (
    <section aria-label="Riwayat menstruasi" className="flex flex-col gap-2">
      <Eyebrow>riwayat</Eyebrow>
      <ul className="flex flex-col gap-2">
        {periods.map((p) => (
          <PeriodRow key={p.id} p={p} today={today} />
        ))}
      </ul>
    </section>
  );
}

function PeriodRow({ p, today }: { p: Period; today: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [start, setStart] = useState(p.start);
  const [end, setEnd] = useState(p.end ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, go] = useTransition();
  const days = p.end ? diffDays(p.start, p.end) + 1 : null;

  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>) =>
    go(async () => {
      setError(null);
      try {
        const r = await fn();
        if (r.ok) {
          setEditing(false);
          setConfirm(false);
          router.refresh();
        } else setError(r.error ?? "Gagal.");
      } catch {
        setError("Koneksinya terputus. Coba lagi ya.");
      }
    });

  return (
    <li className="rounded-2xl border border-rule bg-paper px-4 py-3">
      {editing ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-ink-soft">
              Mulai
              <input type="date" value={start} max={today} onChange={(e) => setStart(e.target.value)} className="h-10 rounded-xl border border-rule bg-ground px-3 text-sm text-ink" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-soft">
              Selesai <span className="text-ink-faint">(kosongkan kalau masih berlangsung)</span>
              <input type="date" value={end} min={start} max={today} onChange={(e) => setEnd(e.target.value)} className="h-10 rounded-xl border border-rule bg-ground px-3 text-sm text-ink" />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={pending}>
              Batal
            </Button>
            <Button size="sm" disabled={pending || !start} onClick={() => run(() => savePeriod({ id: p.id, start, end: end || null }))}>
              Simpan
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[15px] text-ink">
              {formatShortDate(p.start)} – {p.end ? formatShortDate(p.end) : "masih berlangsung"}
            </p>
            <p className="font-mono text-[11px] text-ink-faint">{days ? `${days} hari` : `${diffDays(p.start, today) + 1} hari sejauh ini`}</p>
          </div>
          {!confirm ? (
            <div className="flex gap-1">
              <button type="button" onClick={() => setEditing(true)} className="rounded-full px-3 py-1 text-sm text-ink-faint hover:text-accent-ink">
                ubah
              </button>
              <button type="button" onClick={() => setConfirm(true)} className="rounded-full px-3 py-1 text-sm text-ink-faint hover:text-danger">
                hapus
              </button>
            </div>
          ) : null}
        </div>
      )}
      {confirm ? (
        <div role="group" aria-label="Konfirmasi hapus" className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper-2 px-3 py-2">
          <p className="text-sm text-ink">Hapus catatan ini? Perkiraanmu akan dihitung ulang.</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirm(false)} disabled={pending}>
              Batal
            </Button>
            <Button variant="soft" size="sm" className="text-danger" disabled={pending} onClick={() => run(() => deletePeriod(p.id))}>
              Ya, hapus
            </Button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </li>
  );
}
