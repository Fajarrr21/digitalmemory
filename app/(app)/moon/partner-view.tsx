"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PartnerMoon } from "@/lib/moon/queries";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { formatShortDate } from "@/lib/date";
import { ackCare } from "./actions";
import { SYMPTOM_LABEL, needInfo } from "./moon-config";
import type { Symptom } from "@/lib/moon/insights";

/**
 * His side. Shows ONLY what she sent (care requests) or allowed (via
 * moon_partner_view). With nothing shared there is nothing here to read —
 * no status, no hint, no empty cycle widgets. Responses go through the
 * features that already exist: a letter (with a song), or a little note left
 * in her room.
 */
export function PartnerView({ partnerName, view, activeIds }: { partnerName: string; view: PartnerMoon; activeIds: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const active = view.care.filter((c) => activeIds.includes(c.id));
  const symptoms = view.symptomsToday
    ? (Object.entries(view.symptomsToday) as [Symptom, unknown][]).filter(([k, v]) => (k === "cramps" ? v !== null : v === true)).map(([k]) => k)
    : [];
  const anything = active.length > 0 || view.onPeriod !== null || view.expectedAround || view.headsUpNow || symptoms.length > 0;

  if (!anything) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="font-hand text-2xl text-accent-ink">nothing here right now.</p>
        <p className="max-w-sm text-sm text-ink-soft">
          Kalau {partnerName} ingin kamu tahu sesuatu, atau butuh perhatianmu, akan muncul di sini. Itu sepenuhnya pilihannya. ♡
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {active.map((c) => (
        <section key={c.id} className="rounded-2xl border border-accent/40 bg-blush/35 px-5 py-5">
          <Eyebrow>dari {partnerName}</Eyebrow>
          <p className="mt-2 font-display text-xl text-ink">
            {needInfo(c.need).emoji} {needInfo(c.need).label}
          </p>
          <p className="text-sm text-ink-soft">{needInfo(c.need).line}</p>
          {c.message ? <p className="mt-3 font-hand text-2xl leading-snug text-accent-ink">“{c.message}”</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {!c.acked_at ? (
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    try {
                      const r = await ackCare(c.id);
                      if (r.ok) router.refresh();
                      else setError(r.error ?? null);
                    } catch {
                      setError("Koneksinya terputus. Coba lagi ya.");
                    }
                  })
                }
              >
                I&apos;m on it ♡
              </Button>
            ) : (
              <span className="self-center font-mono text-[11px] text-ink-faint">dia tahu kamu sudah melihatnya ♡</span>
            )}
            {c.need !== "space" ? (
              <>
                <Link href="/letter" className="inline-flex h-9 items-center rounded-full border border-rule bg-paper px-4 text-sm text-ink hover:border-accent-ink/40">
                  ✉️ Tulis surat (bisa pakai lagu)
                </Link>
                <Link href="/stay/leave?kind=note" className="inline-flex h-9 items-center rounded-full border border-rule bg-paper px-4 text-sm text-ink hover:border-accent-ink/40">
                  ♡ Tinggalkan note di kamarnya
                </Link>
                <Link href="/stay/leave?kind=comfort" className="inline-flex h-9 items-center rounded-full border border-rule bg-paper px-4 text-sm text-ink hover:border-accent-ink/40">
                  🌙 Pesan untuk dia baca kapan saja
                </Link>
              </>
            ) : (
              <p className="w-full text-sm text-ink-soft">Dia minta ruang. Cukup biarkan dia tahu kamu ada — tanpa banyak pertanyaan.</p>
            )}
          </div>
        </section>
      ))}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {view.headsUpNow ? (
        <p className="rounded-2xl border border-dashed border-rule px-5 py-4 text-ink">
          Mungkin beberapa hari ini {partnerName} butuh sedikit perhatian lebih. <span className="text-ink-faint">(Dia yang mengizinkan pengingat ini.)</span>
        </p>
      ) : null}

      {view.onPeriod !== null || view.expectedAround || symptoms.length ? (
        <section className="rounded-2xl border border-rule bg-paper px-5 py-4">
          <Eyebrow>yang {partnerName} bagikan</Eyebrow>
          {view.onPeriod ? <p className="mt-2 text-ink">Dia sedang menstruasi.</p> : null}
          {!view.onPeriod && view.expectedAround ? (
            <p className="mt-2 text-ink">
              Perkiraan berikutnya sekitar {formatShortDate(view.expectedAround.from)} – {formatShortDate(view.expectedAround.to)}{" "}
              <span className="text-ink-faint">(perkiraan, bukan kepastian)</span>.
            </p>
          ) : null}
          {symptoms.length ? (
            <p className="mt-2 text-ink">Hari ini: {symptoms.map((s) => SYMPTOM_LABEL[s].label.toLowerCase()).join(", ")}.</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
