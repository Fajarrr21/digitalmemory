import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSpaceContext } from "@/lib/auth";
import { getMoonData } from "@/lib/moon/queries";
import { formatShortDate } from "@/lib/date";
import { MIN_CHECKINS, cycleChanges, duringVsOther, moodCounts, symptomFrequency, type Checkin } from "@/lib/moon/insights";
import { Eyebrow } from "@/components/ui/eyebrow";
import { CONFIDENCE_TEXT, NOT_MEDICAL, SYMPTOM_LABEL, moodLabel } from "../moon-config";

export const metadata: Metadata = { title: "My Cycle Insights" };

/**
 * My Cycle Insights — only what can honestly be computed from what she
 * logged. Every block has a threshold; below it, an empty state explains
 * what a few more entries would unlock. No invented numbers, no diagnosis.
 */
export default async function MoonInsightsPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  if (ctx.role !== "keeper") redirect("/moon");
  const data = await getMoonData(ctx.userId, ctx.profile.timezone);
  if (!data.ready) redirect("/moon");
  const s = data.summary;
  const checkins = data.checkins as Checkin[];

  const freq = symptomFrequency(checkins);
  const moods = moodCounts(checkins);
  const changes = cycleChanges(checkins, s.periods);
  const during = duringVsOther(checkins, s.periods, data.today);
  const cyclesForBars = s.cycles.slice(-8);
  const maxCycle = Math.max(1, ...cyclesForBars.map((c) => c.length));

  return (
    <div className="flex flex-col gap-5">
      <section className="grid grid-cols-2 gap-3">
        <Stat label="rata-rata siklus" value={s.avgCycle ? `${s.avgCycle} hari` : "—"} hint={s.usedCycles.length ? `dari ${s.usedCycles.length} siklus` : "butuh 2 catatan mulai"} />
        <Stat label="rata-rata menstruasi" value={s.avgPeriod ? `${s.avgPeriod} hari` : "—"} hint={s.periodLengths.length ? `dari ${s.periodLengths.length} catatan` : "tandai hari selesainya"} />
        <Stat
          label="perkiraan berikutnya"
          value={s.prediction ? `${formatShortDate(s.prediction.windowFrom)} – ${formatShortDate(s.prediction.windowTo)}` : "—"}
          hint={s.prediction ? CONFIDENCE_TEXT[s.prediction.confidence] : "belum cukup data"}
          wide
        />
      </section>

      <section className="rounded-2xl border border-rule bg-paper px-5 py-5">
        <Eyebrow>panjang siklus</Eyebrow>
        {cyclesForBars.length ? (
          <>
            <ul className="mt-3 flex flex-col gap-2">
              {cyclesForBars.map((c) => (
                <li key={c.from} className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-3 text-sm">
                  <span className="font-mono text-[11px] text-ink-faint">{formatShortDate(c.from)}</span>
                  <span className="h-2.5 rounded-full bg-paper-2" title={`${c.length} hari`}>
                    <span
                      className={c.counted ? "block h-full rounded-full bg-accent-ink/70" : "block h-full rounded-full bg-ink-faint/40"}
                      style={{ width: `${(c.length / maxCycle) * 100}%` }}
                    />
                  </span>
                  <span className="text-right text-ink">{c.length} hr</span>
                </li>
              ))}
            </ul>
            {s.range ? (
              <p className="mt-3 text-sm text-ink-soft">
                Siklus terakhirmu berkisar {s.range.min}–{s.range.max} hari.
                {s.varied ? " Variasinya cukup lebar — itu bukan sesuatu yang salah, hanya membuat perkiraan lebih longgar." : ""}
              </p>
            ) : null}
            {cyclesForBars.some((c) => !c.counted) ? (
              <p className="mt-1 text-xs text-ink-faint">Batang abu-abu = jarak yang tidak biasa (mungkin ada catatan yang terlewat), tidak dihitung dalam rata-rata.</p>
            ) : null}
          </>
        ) : (
          <Empty text="Setelah kamu mencatat mulai menstruasi dua kali, panjang siklusmu akan muncul di sini." />
        )}
      </section>

      <section className="rounded-2xl border border-rule bg-paper px-5 py-5">
        <Eyebrow>lama menstruasi</Eyebrow>
        {s.periodLengths.length ? (
          <p className="mt-3 text-[15px] leading-relaxed text-ink">
            {s.periodLengths
              .slice(-8)
              .map((p) => `${p.days} hr`)
              .join(" · ")}
          </p>
        ) : (
          <Empty text="Tandai juga hari selesainya, supaya lama menstruasimu bisa dihitung." />
        )}
      </section>

      <section className="rounded-2xl border border-rule bg-paper px-5 py-5">
        <Eyebrow>yang sering kamu catat</Eyebrow>
        {checkins.length >= MIN_CHECKINS && freq.length ? (
          <>
            <ul className="mt-3 flex flex-col gap-2">
              {freq.map((f) => (
                <li key={f.symptom} className="grid grid-cols-[8.5rem_1fr_4.5rem] items-center gap-3 text-sm">
                  <span className="text-ink">{SYMPTOM_LABEL[f.symptom].label}</span>
                  <span className="h-2.5 rounded-full bg-paper-2" title={`${f.count} dari ${checkins.length} hari`}>
                    <span className="block h-full rounded-full bg-accent-ink/70" style={{ width: `${f.share * 100}%` }} />
                  </span>
                  <span className="text-right text-ink-soft">
                    {f.count}/{checkins.length} hr
                  </span>
                </li>
              ))}
            </ul>
            {moods.length ? (
              <p className="mt-3 text-sm text-ink-soft">
                Suasana hati yang paling sering: {moods.slice(0, 3).map((m) => `${moodLabel(m.mood)?.label ?? m.mood} (${m.count})`).join(", ")}.
              </p>
            ) : null}
          </>
        ) : (
          <Empty text={`Pola gejala muncul setelah sekitar ${MIN_CHECKINS} check-in. Kamu sudah punya ${checkins.length}.`} />
        )}
      </section>

      {during ? (
        <section className="rounded-2xl border border-rule bg-paper px-5 py-5">
          <Eyebrow>saat menstruasi vs hari lain</Eyebrow>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm text-ink">
            {during.map((d) => (
              <li key={d.symptom}>
                {SYMPTOM_LABEL[d.symptom].label}: {Math.round(d.during * 100)}% hari menstruasi · {Math.round(d.other * 100)}% hari lain
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-faint">Ini hanya menunjukkan kapan sesuatu muncul, bukan penyebabnya.</p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-rule bg-paper px-5 py-5">
        <Eyebrow>siklus ini vs sebelumnya</Eyebrow>
        {changes && changes.length ? (
          <ul className="mt-3 flex flex-col gap-1.5 text-sm text-ink">
            {changes.map((c) => (
              <li key={c.symptom}>
                {SYMPTOM_LABEL[c.symptom].label}: {c.previous} hari → {c.current} hari
              </li>
            ))}
          </ul>
        ) : (
          <Empty text="Perbandingan muncul kalau siklus ini dan sebelumnya masing-masing punya beberapa check-in." />
        )}
      </section>

      <p className="text-xs leading-relaxed text-ink-faint">
        Dihitung dari {s.dataPoints} catatan menstruasi dan {checkins.length} check-in. Makin rutin mencatat, makin berguna gambarannya. {NOT_MEDICAL}{" "}
        <Link href="/moon/checkin" className="text-accent-ink underline underline-offset-2">
          check-in sekarang
        </Link>
      </p>
    </div>
  );
}

function Stat({ label, value, hint, wide }: { label: string; value: string; hint: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 rounded-2xl border border-rule bg-paper px-4 py-4" : "rounded-2xl border border-rule bg-paper px-4 py-4"}>
      <p className="font-mono text-[10px] tracking-[0.16em] text-ink-faint uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="mt-3 text-sm text-ink-soft">{text}</p>;
}
