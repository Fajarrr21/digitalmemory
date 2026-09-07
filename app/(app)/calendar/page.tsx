import Link from "next/link";
import { getSpaceContext, getPartner } from "@/lib/auth";
import { getMonthMarks } from "@/lib/timeline";
import { localDateISO } from "@/lib/date";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PersonToggle } from "@/components/person-toggle";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function ymParam(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; who?: string }>;
}) {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const todayISO = localDateISO(ctx.profile.timezone);
  const { month: monthParam, who } = await searchParams;

  const partner = await getPartner(ctx.spaceId, ctx.userId);
  const viewingPartner = who === "partner" && !!partner;
  const targetId = viewingPartner ? partner!.id : ctx.userId;
  const whoQuery = viewingPartner ? "&who=partner" : "";
  const daySuffix = viewingPartner ? "?who=partner" : "";

  const match = /^(\d{4})-(\d{2})$/.exec(monthParam ?? "");
  const now = new Date(`${todayISO}T12:00:00`);
  const year = match ? Number(match[1]) : now.getFullYear();
  const month = match ? Number(match[2]) : now.getMonth() + 1; // 1-indexed

  const marks = await getMonthMarks(targetId, year, month);

  const daysInMonth = new Date(year, month, 0).getDate();
  // Monday-first offset for the 1st of the month.
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Eyebrow>a month at a glance</Eyebrow>
          <h1 className="mt-2 font-display text-3xl font-medium text-ink">
            {MONTHS[month - 1]} {year}
          </h1>
        </div>
        <div className="flex flex-none items-center gap-3">
          {partner ? (
            <PersonToggle
              selfHref={`/calendar?month=${ymParam(year, month)}`}
              partnerHref={`/calendar?month=${ymParam(year, month)}&who=partner`}
              partnerName="Dia"
              viewingPartner={viewingPartner}
            />
          ) : null}
          <div className="flex items-center gap-2">
            <Link
              href={`/calendar?month=${ymParam(prev.y, prev.m)}${whoQuery}`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-rule text-ink-soft hover:text-accent-ink hover:border-accent-ink/40"
              aria-label="Bulan sebelumnya"
            >
              ‹
            </Link>
            <Link
              href={`/calendar?month=${ymParam(next.y, next.m)}${whoQuery}`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-rule text-ink-soft hover:text-accent-ink hover:border-accent-ink/40"
              aria-label="Bulan berikutnya"
            >
              ›
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 font-mono text-[11px] uppercase tracking-wide text-ink-faint">
            {w}
          </div>
        ))}

        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} />;
          const dateISO = `${ymParam(year, month)}-${String(day).padStart(2, "0")}`;
          const mark = marks.get(dateISO);
          const isToday = dateISO === todayISO;
          const hasContent = !!mark && (mark.activityCount > 0 || mark.score !== null || mark.hasLetter);

          const inner = (
            <div
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border p-1 transition",
                isToday ? "border-accent-ink/50 bg-blush/30" : "border-rule-soft",
                hasContent ? "hover:border-accent-ink/40" : "opacity-70",
              )}
            >
              <span className={cn("text-sm", isToday ? "font-semibold text-accent-ink" : "text-ink-soft")}>
                {day}
              </span>
              <div className="flex h-3 items-center gap-1">
                {mark?.score != null ? (
                  <span
                    className="inline-block h-2 w-2 rounded-full bg-accent"
                    title={`rating ${mark.score}/10`}
                  />
                ) : null}
                {mark && mark.activityCount > 0 ? (
                  <span className="text-[9px] text-ink-faint" title={`${mark.activityCount} momen`}>
                    ●{mark.activityCount}
                  </span>
                ) : null}
                {mark?.hasLetter ? <span className="text-[9px]" title="ada surat">♡</span> : null}
              </div>
            </div>
          );

          return hasContent ? (
            <Link key={dateISO} href={`/diary/${dateISO}${daySuffix}`}>
              {inner}
            </Link>
          ) : (
            <div key={dateISO}>{inner}</div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-faint">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" /> rating
        </span>
        <span className="flex items-center gap-1.5">●n momen</span>
        <span className="flex items-center gap-1.5">♡ surat</span>
      </div>
    </div>
  );
}
