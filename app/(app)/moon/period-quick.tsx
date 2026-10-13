"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { endOngoing, savePeriod } from "./actions";

/** One-tap logging: "started today" / "ended today", or pick another day. */
export function PeriodQuick({ ongoing, today }: { ongoing: boolean; today: string }) {
  const router = useRouter();
  const [other, setOther] = useState(false);
  const [day, setDay] = useState(today);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>, done: string) =>
    start(async () => {
      setMsg(null);
      try {
        const r = await fn();
        if (r.ok) {
          setMsg({ ok: true, text: done });
          setOther(false);
          router.refresh();
        } else setMsg({ ok: false, text: r.error ?? "Gagal menyimpan." });
      } catch {
        setMsg({ ok: false, text: "Koneksinya terputus. Coba lagi ya." });
      }
    });

  const act = (d: string) =>
    ongoing
      ? run(() => endOngoing(d), "Ditandai selesai. ♡")
      : run(() => savePeriod({ start: d, end: null }), "Tercatat. Pelan-pelan hari ini, ya. ♡");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => act(today)} disabled={pending} aria-busy={pending}>
          {ongoing ? "Menstruasiku selesai hari ini" : "Menstruasiku mulai hari ini"}
        </Button>
        <button type="button" onClick={() => setOther((v) => !v)} className="px-2 text-sm text-ink-faint hover:text-ink-soft" aria-expanded={other}>
          tanggal lain…
        </button>
      </div>
      {other ? (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="period-day" className="text-sm text-ink-soft">
            {ongoing ? "Selesai pada" : "Mulai pada"}
          </label>
          <input
            id="period-day"
            type="date"
            value={day}
            max={today}
            onChange={(e) => setDay(e.target.value)}
            className="h-10 rounded-xl border border-rule bg-paper px-3 text-sm text-ink"
          />
          <Button variant="soft" size="sm" onClick={() => day && act(day)} disabled={pending || !day}>
            Simpan
          </Button>
        </div>
      ) : null}
      {msg ? (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-accent-ink" : "text-sm text-danger"}>
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
