"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DayKind, Period } from "@/lib/moon/cycle";
import type { MoonCheckin } from "@/lib/moon/queries";
import { formatShortDate } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { endOngoing, savePeriod } from "../actions";
import { CheckinForm } from "../checkin-form";

export type CalDay = { iso: string; n: number; kind: DayKind; checkin: boolean; future: boolean };

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const KIND_TEXT: Record<Exclude<DayKind, null>, string> = {
  period: "menstruasi tercatat",
  predicted: "perkiraan menstruasi",
  window: "dalam rentang perkiraan",
};

export function MoonCalendar({
  days,
  offset,
  today,
  ongoing,
  checkins,
}: {
  days: CalDay[];
  offset: number;
  today: string;
  ongoing: Period | null;
  checkins: MoonCheckin[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const day = days.find((d) => d.iso === picked) ?? null;

  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>, done: string) =>
    start(async () => {
      setMsg(null);
      try {
        const r = await fn();
        if (r.ok) {
          setMsg({ ok: true, text: done });
          router.refresh();
        } else setMsg({ ok: false, text: r.error ?? "Gagal menyimpan." });
      } catch {
        setMsg({ ok: false, text: "Koneksinya terputus. Coba lagi ya." });
      }
    });

  return (
    <div className="flex flex-col gap-4">
      <div role="grid" aria-label="Kalender siklus" className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} role="columnheader" className="pb-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            {w}
          </div>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <div key={`e${i}`} aria-hidden />
        ))}
        {days.map((d) => (
          <button
            key={d.iso}
            type="button"
            role="gridcell"
            aria-selected={picked === d.iso}
            aria-label={`${formatShortDate(d.iso)}${d.kind ? `, ${KIND_TEXT[d.kind]}` : ""}${d.checkin ? ", ada check-in" : ""}${d.iso === today ? ", hari ini" : ""}`}
            onClick={() => {
              setMsg(null);
              setPicked(picked === d.iso ? null : d.iso);
            }}
            className={cn(
              "relative flex aspect-square flex-col items-center justify-center rounded-full text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink",
              d.kind === "period" && "bg-[#e7a9b4] font-medium text-[#4a2b30]",
              d.kind === "predicted" && "border-2 border-dashed border-[#c97f8e] text-ink",
              d.kind === "window" && "bg-blush/40 text-ink",
              !d.kind && "text-ink-soft hover:bg-paper-2",
              d.future && !d.kind && "text-ink-faint",
              d.iso === today && "ring-2 ring-accent-ink ring-offset-2 ring-offset-ground",
              picked === d.iso && "outline-2 outline-offset-2 outline-ink",
            )}
          >
            {d.n}
            {d.checkin ? <span aria-hidden className="absolute bottom-1 h-1 w-1 rounded-full bg-accent-ink" /> : null}
          </button>
        ))}
      </div>

      {day ? (
        <section aria-label={`Hari ${formatShortDate(day.iso)}`} className="flex flex-col gap-4 rounded-2xl border border-rule bg-paper px-5 py-5">
          <div>
            <p className="font-display text-lg text-ink">{formatShortDate(day.iso)}</p>
            <p className="text-sm text-ink-soft">{day.kind ? KIND_TEXT[day.kind] : day.future ? "belum terjadi" : "tidak ada catatan menstruasi"}</p>
          </div>

          {!day.future ? (
            <div className="flex flex-wrap gap-2">
              {ongoing && day.iso >= ongoing.start ? (
                <Button size="sm" variant="soft" disabled={pending} onClick={() => run(() => endOngoing(day.iso), "Ditandai selesai. ♡")}>
                  Menstruasi selesai di hari ini
                </Button>
              ) : null}
              {day.kind !== "period" ? (
                <Button
                  size="sm"
                  variant="soft"
                  disabled={pending}
                  onClick={() => run(() => savePeriod({ start: day.iso, end: null }), "Tercatat sebagai hari pertama. ♡")}
                >
                  Menstruasi mulai di hari ini
                </Button>
              ) : null}
            </div>
          ) : null}
          {msg ? (
            <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-accent-ink" : "text-sm text-danger"}>
              {msg.text}
            </p>
          ) : null}

          {!day.future ? (
            <div className="border-t border-rule-soft pt-4">
              <p className="mb-3 text-sm font-medium text-ink">Check-in hari itu</p>
              <CheckinForm
                key={day.iso + (checkins.find((c) => c.day === day.iso)?.updated_at ?? "")}
                day={day.iso}
                existing={checkins.find((c) => c.day === day.iso) ?? null}
                dayLabel={formatShortDate(day.iso)}
              />
            </div>
          ) : null}
        </section>
      ) : (
        <p className="text-center text-sm text-ink-faint">Ketuk satu hari untuk mencatat atau melihatnya.</p>
      )}
    </div>
  );
}
