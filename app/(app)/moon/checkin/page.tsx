import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSpaceContext } from "@/lib/auth";
import { getMoonData } from "@/lib/moon/queries";
import { formatShortDate } from "@/lib/date";
import { has, SYMPTOMS } from "@/lib/moon/insights";
import { CheckinForm } from "../checkin-form";
import { SYMPTOM_LABEL, flowLabel, moodLabel } from "../moon-config";

export const metadata: Metadata = { title: "How Is Your Body Today?" };

export default async function MoonCheckinPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  if (ctx.role !== "keeper") redirect("/moon");
  const data = await getMoonData(ctx.userId, ctx.profile.timezone);
  if (!data.ready) redirect("/moon");

  const { day: param } = await searchParams;
  const day = param && /^\d{4}-\d{2}-\d{2}$/.test(param) && param <= data.today ? param : data.today;
  const existing = data.checkins.find((c) => c.day === day) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-rule bg-paper px-5 py-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl text-ink">{day === data.today ? "Hari ini" : formatShortDate(day)}</h2>
          <form className="flex items-center gap-2" action="/moon/checkin">
            <label htmlFor="pick-day" className="sr-only">
              Pilih hari
            </label>
            <input id="pick-day" name="day" type="date" defaultValue={day} max={data.today} className="h-9 rounded-xl border border-rule bg-ground px-2 text-sm text-ink" />
            <button type="submit" className="h-9 rounded-full border border-rule px-3 text-sm text-ink-soft hover:border-accent-ink/40">
              buka
            </button>
          </form>
        </div>
        <CheckinForm key={day + (existing?.updated_at ?? "")} day={day} existing={existing} dayLabel={day === data.today ? "hari ini" : formatShortDate(day)} />
      </section>

      <section aria-label="Riwayat check-in" className="flex flex-col gap-2">
        <p className="font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase">riwayat</p>
        {data.checkins.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-rule px-5 py-4 text-sm text-ink-soft">
            Belum ada check-in. Satu pilihan kecil hari ini sudah jadi awal yang baik.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.checkins.slice(0, 60).map((c) => {
              const bits = [
                ...SYMPTOMS.filter((s) => has(c, s)).map((s) => SYMPTOM_LABEL[s].label.toLowerCase()),
                moodLabel(c.mood)?.label,
                c.flow ? `perdarahan ${flowLabel(c.flow)}` : null,
              ].filter(Boolean);
              return (
                <li key={c.id}>
                  <Link href={`/moon/checkin?day=${c.day}`} className="flex items-start justify-between gap-3 rounded-2xl border border-rule bg-paper px-4 py-3 transition hover:border-accent-ink/40">
                    <span className="min-w-0">
                      <span className="block text-[15px] text-ink">{bits.length ? bits.join(" · ") : "catatan"}</span>
                      {c.note ? <span className="block truncate text-sm text-ink-soft">{c.note}</span> : null}
                    </span>
                    <span className="flex-none font-mono text-[11px] text-ink-faint">{formatShortDate(c.day)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
