import type { Metadata } from "next";
import Link from "next/link";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { getMoonData, getPartnerMoon, isCareActive } from "@/lib/moon/queries";
import { looksForgotten } from "@/lib/moon/cycle";
import { repeatedVomiting } from "@/lib/moon/insights";
import { formatShortDate } from "@/lib/date";
import { MoonGlyph } from "@/components/moon/moon-glyph";
import { PaperCard } from "@/components/ui/paper-card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { CheckinForm } from "./checkin-form";
import { PeriodQuick } from "./period-quick";
import { CarePanel } from "./care-panel";
import { PartnerView } from "./partner-view";
import { CARE_NOTE_TEXT, CONFIDENCE_TEXT, NOT_MEDICAL } from "./moon-config";

export const metadata: Metadata = { title: "her little moon." };

function NotReady() {
  return (
    <PaperCard className="border-dashed">
      <p className="font-display text-lg text-ink">Ruang ini sedang disiapkan.</p>
      <p className="mt-1 text-sm text-ink-soft">
        Jalankan <code className="rounded bg-paper-2 px-1 font-mono text-xs">supabase/migrations/0021_her_little_moon.sql</code> di SQL
        editor Supabase, lalu buka lagi halaman ini. ♡
      </p>
    </PaperCard>
  );
}

export default async function MoonPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  const partner = await getPartner(ctx.spaceId, ctx.userId);
  const partnerName = partner?.name ?? "Dia";

  // His side: only what she sent or allowed.
  if (ctx.role !== "keeper") {
    const { ready, view } = await getPartnerMoon(ctx.spaceId, ctx.userId);
    if (!ready) return <NotReady />;
    return <PartnerView partnerName={partnerName} view={view} activeIds={view.care.filter((c) => isCareActive(c)).map((c) => c.id)} />;
  }

  const data = await getMoonData(ctx.userId, ctx.profile.timezone);
  if (!data.ready) return <NotReady />;
  const { summary: s, today } = data;
  const pr = s.prediction;
  const fraction = s.cycleDay && s.avgCycle ? s.cycleDay / s.avgCycle : null;
  const activeCare = data.care.filter((c) => isCareActive(c));
  const pastCare = data.care.filter((c) => !isCareActive(c));

  return (
    <div className="flex flex-col gap-5">
      <PaperCard className="flex flex-col items-center gap-3 bg-gradient-to-b from-blush/30 to-paper py-7 text-center">
        <div className="h-28 w-28">
          <MoonGlyph fraction={fraction} glow={s.onPeriod} />
        </div>
        {s.dataPoints === 0 ? (
          <>
            <p className="font-display text-xl text-ink">Belum ada catatan siklus.</p>
            <p className="max-w-sm text-sm text-ink-soft">
              Mulai dari menandai hari pertama menstruasimu. Setelah dua kali mencatat, aku bisa mulai memperkirakan yang berikutnya —
              makin rutin, makin masuk akal perkiraannya.
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-2xl text-ink">
              {s.onPeriod ? `Menstruasi hari ke-${s.cycleDay}` : s.cycleDay ? `Hari ke-${s.cycleDay} siklusmu` : "Sudah lama sejak catatan terakhir"}
            </p>
            {pr && !s.onPeriod ? (
              pr.daysLate > 0 ? (
                <p className="max-w-sm text-sm text-ink-soft">
                  Sudah {pr.daysLate} hari lewat dari perkiraan ({formatShortDate(pr.start)}). Siklus bisa bergeser karena banyak hal — catat saja
                  kalau sudah mulai.
                </p>
              ) : (
                <p className="max-w-sm text-sm text-ink-soft">
                  Perkiraan berikutnya sekitar <b className="font-medium text-ink">{formatShortDate(pr.windowFrom)} – {formatShortDate(pr.windowTo)}</b>.
                  <br />
                  <span className="text-ink-faint">{CONFIDENCE_TEXT[pr.confidence]}</span>
                </p>
              )
            ) : !pr ? (
              <p className="max-w-sm text-sm text-ink-faint">Perkiraan muncul setelah kamu mencatat setidaknya dua kali mulai menstruasi.</p>
            ) : null}
          </>
        )}
        <div className="mt-2">
          <PeriodQuick ongoing={!!s.current && !s.current.end} today={today} />
        </div>
        {looksForgotten(s, today) ? (
          <p className="text-sm text-ink-soft">
            Menstruasi ini tercatat sudah lebih dari 10 hari — mungkin lupa menandai selesai?{" "}
            <Link href="/moon/calendar" className="text-accent-ink underline underline-offset-2">
              ubah di kalender
            </Link>
          </p>
        ) : null}
      </PaperCard>

      <section className="rounded-2xl border border-rule bg-paper px-5 py-5">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <div>
            <Eyebrow>how is your body today?</Eyebrow>
            <p className="mt-1 text-sm text-ink-soft">Semua opsional. Satu pilihan saja juga cukup.</p>
          </div>
          <Link href={`/moon/checkin?day=${today}`} className="text-sm text-accent-ink hover:underline">
            lengkap →
          </Link>
        </div>
        <CheckinForm key={data.todayCheckin?.updated_at ?? "new"} day={today} existing={data.todayCheckin} dayLabel="hari ini" compact />
      </section>

      {repeatedVomiting(data.checkins) ? (
        <p role="note" className="rounded-2xl border border-danger/40 bg-danger/10 px-5 py-4 text-sm leading-relaxed text-ink">
          Kamu mencatat muntah beberapa hari terakhir. {CARE_NOTE_TEXT}
        </p>
      ) : null}

      {partner ? <CarePanel partnerName={partnerName} active={activeCare} past={pastCare} /> : null}

      <p className="text-center text-xs leading-relaxed text-ink-faint">{NOT_MEDICAL}</p>
    </div>
  );
}
