import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSpaceContext } from "@/lib/auth";
import { getMoonData } from "@/lib/moon/queries";
import { dayKind } from "@/lib/moon/cycle";
import { MoonCalendar, type CalDay } from "./moon-calendar";
import { PeriodList } from "./period-list";
import { NOT_MEDICAL } from "../moon-config";

export const metadata: Metadata = { title: "Her Cycle" };

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export default async function MoonCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  if (ctx.role !== "keeper") redirect("/moon");

  const data = await getMoonData(ctx.userId, ctx.profile.timezone);
  if (!data.ready) redirect("/moon");
  const { today, summary } = data;

  const { month: param } = await searchParams;
  const m = /^(\d{4})-(\d{2})$/.exec(param ?? "");
  const year = m ? Number(m[1]) : Number(today.slice(0, 4));
  const month = m ? Math.min(12, Math.max(1, Number(m[2]))) : Number(today.slice(5, 7));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const ym = (y: number, mo: number) => `${y}-${String(mo).padStart(2, "0")}`;
  const prev = month === 1 ? ym(year - 1, 12) : ym(year, month - 1);
  const next = month === 12 ? ym(year + 1, 1) : ym(year, month + 1);
  const checked = new Set(data.checkins.map((c) => c.day));

  const days: CalDay[] = Array.from({ length: daysInMonth }, (_, i) => {
    const iso = `${ym(year, month)}-${String(i + 1).padStart(2, "0")}`;
    return { iso, n: i + 1, kind: dayKind(iso, summary, today), checkin: checked.has(iso), future: iso > today };
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <Link href={`/moon/calendar?month=${prev}`} className="rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-blush/30" aria-label="Bulan sebelumnya">
          ←
        </Link>
        <h2 className="font-display text-xl text-ink">
          {MONTHS[month - 1]} {year}
        </h2>
        <Link href={`/moon/calendar?month=${next}`} className="rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-blush/30" aria-label="Bulan berikutnya">
          →
        </Link>
      </div>

      <MoonCalendar
        days={days}
        offset={firstWeekday}
        today={today}
        ongoing={summary.current && !summary.current.end ? summary.current : null}
        checkins={data.checkins}
      />

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft" aria-label="Keterangan">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-3 rounded-full bg-[#e7a9b4]" /> tercatat
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-3 rounded-full border-2 border-dashed border-[#c97f8e]" /> perkiraan
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-3 rounded-full bg-blush/40" /> rentang perkiraan
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent-ink" /> ada check-in
        </li>
      </ul>
      {summary.prediction ? (
        <p className="text-xs text-ink-faint">Tanggal perkiraan bisa bergeser. {NOT_MEDICAL}</p>
      ) : (
        <p className="text-xs text-ink-faint">Belum ada perkiraan — butuh setidaknya dua kali mencatat mulai menstruasi.</p>
      )}

      <PeriodList periods={[...summary.periods].reverse()} today={today} />
    </div>
  );
}
