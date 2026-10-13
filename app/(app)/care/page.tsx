import type { Metadata } from "next";
import Link from "next/link";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { getCareOverview } from "@/lib/care/queries";
import { careWhatsAppEnabled, orbPhase } from "@/lib/care/logic";
import { formatInstant } from "@/lib/date";
import { CareOrb, CareRoom } from "@/components/care/care-room";
import { SafetyCard } from "@/components/care/safety-card";
import { PaperCard } from "@/components/ui/paper-card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { CARE_HEADLINE, CARE_INTRO, CARE_QUOTE, CARE_TAGLINE, NOT_MEDICAL } from "./care-config";
import { CareWhatsAppToggle } from "./whatsapp-toggle";

export const metadata: Metadata = { title: "Little Care" };

/**
 * Little Care Home — a warm little room, one way in ("Mulai Little Care"),
 * and quiet word of anything already open. What a session is *about* is
 * never shown on this page — not the symptoms, not the severity. Only that
 * it exists. Kept sessions are listed by date alone.
 */
export default async function CarePage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const [overview, partner] = await Promise.all([
    getCareOverview(ctx.spaceId, ctx.userId),
    getPartner(ctx.spaceId, ctx.userId),
  ]);
  const them = partner?.name ?? "Dia";
  const { mine, forMe, kept } = overview;
  const phase = mine ? orbPhase(mine.status, !!mine.last_care_at) : "idle";

  return (
    <div className="flex flex-col gap-6">
      <CareRoom dim={phase === "resting"}>
        <div className="flex flex-col items-center px-6 pt-8 pb-10 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#f6c98d]">
            little care · {CARE_TAGLINE.toLowerCase()}
          </p>
          <CareOrb
            phase={phase}
            label={
              mine
                ? phase === "resting"
                  ? "Bola cahaya yang sedang beristirahat"
                  : phase === "cared"
                    ? "Bola cahaya yang sedang ditemani"
                    : "Bola cahaya yang menunggu"
                : "Sebuah bola cahaya kecil berbentuk hati"
            }
            className="my-2 max-w-[13rem]"
          />
          <h1 className="font-display text-[1.75rem] leading-tight font-medium text-balance md:text-3xl">
            {CARE_HEADLINE}
          </h1>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-[#f2e2d6]/85 text-pretty">{CARE_INTRO}</p>

          {!overview.ready ? null : mine ? (
            <Link
              href={`/care/${mine.id}`}
              className="mt-7 inline-flex h-12 items-center rounded-full bg-[#f6c98d] px-7 font-medium text-[#3a261d] transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f6c98d]"
            >
              Ke Little Care-ku →
            </Link>
          ) : (
            <Link
              href="/care/new"
              className="mt-7 inline-flex h-12 items-center rounded-full bg-[#f6c98d] px-7 font-medium text-[#3a261d] transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f6c98d]"
            >
              Mulai Little Care
            </Link>
          )}
        </div>
      </CareRoom>

      {!overview.ready ? (
        <PaperCard className="border-dashed">
          <p className="font-display text-lg text-ink">Kamarnya sedang disiapkan.</p>
          <p className="mt-1 text-sm text-ink-soft">
            Jalankan{" "}
            <code className="rounded bg-paper-2 px-1 font-mono text-xs">supabase/migrations/0019_little_care.sql</code>{" "}
            di SQL editor Supabase, lalu buka lagi halaman ini. ♡
          </p>
        </PaperCard>
      ) : null}

      {/* Someone needs a little care — never says what, only that it's there. */}
      {forMe.map((s) => (
        <Link key={s.id} href={`/care/${s.id}`} className="group block">
          <PaperCard className="relative overflow-hidden bg-gradient-to-br from-[#f6c98d]/25 via-blush/35 to-paper transition group-hover:-translate-y-0.5">
            <Eyebrow>🤍 dari {them}</Eyebrow>
            <p className="mt-2 font-display text-lg font-medium text-ink">
              {s.status === "resting"
                ? `${them} sedang istirahat.`
                : s.last_care_at
                  ? s.after_choice === "longer"
                    ? `${them} ingin ditemani sedikit lebih lama.`
                    : `Kamu sedang menemani ${them}.`
                  : `${them} sedang nggak enak badan.`}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {s.status === "resting" ? "Tinggalkan satu pesan untuk dibaca nanti →" : "Lihat apa yang dia butuhkan →"}
            </p>
          </PaperCard>
        </Link>
      ))}

      {mine ? (
        <Link href={`/care/${mine.id}`} className="group block">
          <PaperCard className="transition group-hover:-translate-y-0.5">
            <Eyebrow>little care-mu</Eyebrow>
            <p className="mt-2 font-display text-lg font-medium text-ink">
              {mine.status === "resting"
                ? "Kamu sedang istirahat. Nggak ada yang perlu dibalas."
                : mine.last_care_at
                  ? `${them} sedang menemanimu. ♡`
                  : `Sudah terkirim. ${them} akan datang.`}
            </p>
            <p className="mt-1 text-sm text-ink-soft">Lihat →</p>
          </PaperCard>
        </Link>
      ) : null}

      <figure className="px-2 text-center">
        <blockquote className="font-hand text-2xl leading-snug text-accent-ink text-balance">“{CARE_QUOTE}”</blockquote>
      </figure>

      {overview.ready && !mine && forMe.length === 0 ? (
        <PaperCard>
          <Eyebrow>bagaimana kamar ini bekerja</Eyebrow>
          <ol className="mt-3 flex flex-col gap-2.5 text-[15px] text-ink-soft">
            <li>
              <span className="font-display text-ink">1.</span> Ceritakan apa yang kamu rasakan — kamu
              yang memilih apa saja yang boleh {them} lihat.
            </li>
            <li>
              <span className="font-display text-ink">2.</span> Pilih bentuk perhatian yang kamu mau:
              ditemani, minum, waktu tenang, atau kejutan kecil.
            </li>
            <li>
              <span className="font-display text-ink">3.</span> {them} datang dengan perhatian kecil. Kamu
              nggak perlu membalas, dan nggak harus &ldquo;sudah sembuh&rdquo;.
            </li>
          </ol>
          <p className="mt-4 text-sm text-ink-faint">Dua arah: {them} juga bisa membukanya saat sedang nggak enak badan.</p>
        </PaperCard>
      ) : null}

      {kept.length > 0 ? (
        <section aria-label="Little Care yang disimpan" className="flex flex-col gap-2">
          <Eyebrow>yang kalian simpan</Eyebrow>
          <ul className="flex flex-col divide-y divide-rule-soft rounded-2xl border border-rule bg-paper">
            {kept.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/care/${s.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-paper-2"
                >
                  <span className="min-w-0">
                    <span className="block text-[15px] text-ink">
                      {s.sender_id === ctx.userId ? "Saat kamu dirawat" : `Saat kamu merawat ${them}`}
                    </span>
                    <span className="block font-mono text-[11px] text-ink-faint">
                      {formatInstant(s.created_at, ctx.profile.timezone)}
                      {s.careCount ? ` · ${s.careCount} perhatian kecil` : ""}
                    </span>
                  </span>
                  <span aria-hidden className="text-ink-faint">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <SafetyCard level="gentle" />
      <p className="text-center text-xs leading-relaxed text-ink-faint">{NOT_MEDICAL}</p>

      {overview.ready ? <CareWhatsAppToggle initial={careWhatsAppEnabled(ctx.profile.notif_prefs)} /> : null}
    </div>
  );
}
