import type { Metadata } from "next";
import Link from "next/link";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { getHoldOverview } from "@/lib/hold/queries";
import { holdWhatsAppEnabled, objectFor } from "@/lib/hold/logic";
import { FeelingObject, HoldSky } from "@/components/hold/feeling-object";
import { PaperCard } from "@/components/ui/paper-card";
import { Eyebrow } from "@/components/ui/eyebrow";
import {
  AFTER_FOR_PARTNER,
  HOLD_INTRO,
  HOLD_PHILOSOPHY,
  HOLD_TAGLINE,
  HOLD_TITLE,
  OBJECT_COPY,
} from "./hold-config";
import { WhatsAppToggle } from "./whatsapp-toggle";

export const metadata: Metadata = { title: "Hold" };

/**
 * If I Could Hold Your Feelings — the landing. One small light, one way in
 * ("Aku butuh ditemani"), and quiet word of anything already waiting. What
 * a waiting session is *about* is never shown here — only that it exists.
 */
export default async function HoldPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const [overview, partner] = await Promise.all([
    getHoldOverview(ctx.spaceId, ctx.userId),
    getPartner(ctx.spaceId, ctx.userId),
  ]);
  const them = partner?.name ?? "Dia";
  const { mine, forMe, recentlyEnded } = overview;
  const firstTime = overview.ready && !mine && forMe.length === 0 && recentlyEnded.length === 0 && overview.keptCount === 0;

  return (
    <div className="flex flex-col gap-6">
      <HoldSky>
        <div className="flex flex-col items-center px-6 pt-8 pb-9 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#f4c7cf]">
            hold · {HOLD_TAGLINE.toLowerCase()}
          </p>
          <FeelingObject
            object={mine ? objectFor(mine.feeling) : "orb"}
            state={mine ? (mine.status === "responded" ? "held" : "waiting") : "initial"}
            label={mine ? "Ruangmu yang sedang terbuka" : "Sebuah bola cahaya kecil"}
            className="my-2 max-w-[16rem]"
          />
          <h1 className="font-display text-[1.75rem] leading-tight font-medium text-balance md:text-3xl">
            {HOLD_TITLE}
          </h1>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-[#f2e2d6]/85 text-pretty">
            {HOLD_INTRO}
          </p>

          {!overview.ready ? null : mine ? (
            <Link
              href={`/hold/${mine.id}`}
              className="mt-7 inline-flex h-12 items-center rounded-full bg-[#f4c7cf] px-7 font-medium text-[#3a2436] transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4c7cf]"
            >
              Ke ruangku yang terbuka →
            </Link>
          ) : (
            <Link
              href="/hold/new"
              className="mt-7 inline-flex h-12 items-center rounded-full bg-[#f4c7cf] px-7 font-medium text-[#3a2436] transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4c7cf]"
            >
              Aku butuh ditemani
            </Link>
          )}
        </div>
      </HoldSky>

      {!overview.ready ? (
        <PaperCard className="border-dashed">
          <p className="font-display text-lg text-ink">Ruang ini sedang disiapkan.</p>
          <p className="mt-1 text-sm text-ink-soft">
            Jalankan <code className="rounded bg-paper-2 px-1 font-mono text-xs">supabase/migrations/0018_hold.sql</code>{" "}
            di SQL editor Supabase, lalu buka lagi halaman ini. ♡
          </p>
        </PaperCard>
      ) : null}

      {/* Waiting for me — never says what it's about, only that it's there. */}
      {forMe.map((s) => (
        <Link key={s.id} href={`/hold/${s.id}`} className="group block">
          <PaperCard className="relative overflow-hidden bg-gradient-to-br from-blush/50 to-paper transition group-hover:-translate-y-0.5">
            <Eyebrow>dari {them}</Eyebrow>
            <p className="mt-2 font-display text-lg font-medium text-ink">
              {s.status === "continued"
                ? `${them} ingin ditemani sedikit lebih lama.`
                : "Ada ruang kecil yang menunggumu."}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {s.status === "pending" ? "Belum dibuka · " : ""}Datang kalau kamu sempat. ♡
            </p>
          </PaperCard>
        </Link>
      ))}

      {/* My own open session. */}
      {mine ? (
        <Link href={`/hold/${mine.id}`} className="group block">
          <PaperCard className="transition group-hover:-translate-y-0.5">
            <Eyebrow>ruangmu</Eyebrow>
            <p className="mt-2 font-display text-lg font-medium text-ink">
              {mine.status === "pending" && "Ruangmu sudah terkirim. Pelan-pelan, ya."}
              {mine.status === "opened" && `${them} sudah membuka ruangmu.`}
              {mine.status === "responded" && `${them} sudah hadir di sini. ♡`}
              {mine.status === "continued" && `Kamu minta ditemani lebih lama.`}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {OBJECT_COPY[objectFor(mine.feeling)].name} · lihat →
            </p>
          </PaperCard>
        </Link>
      ) : null}

      {/* A closing word, for a few days. */}
      {recentlyEnded
        .filter((s) => s.recipient_id === ctx.userId && s.after_choice)
        .map((s) => (
          <PaperCard key={s.id} className="border-dashed">
            <Eyebrow>kabar dari ruang {them}</Eyebrow>
            <p className="mt-2 text-ink">{AFTER_FOR_PARTNER[s.after_choice!]}</p>
          </PaperCard>
        ))}

      {firstTime ? (
        <PaperCard>
          <Eyebrow>bagaimana ruang ini bekerja</Eyebrow>
          <ol className="mt-3 flex flex-col gap-2.5 text-[15px] text-ink-soft">
            <li>
              <span className="font-display text-ink">1.</span> Pilih apa yang sedang kamu bawa,
              dan bantuan seperti apa yang kamu butuhkan.
            </li>
            <li>
              <span className="font-display text-ink">2.</span> {them} datang dengan satu gestur
              kecil — menemani, menghangatkan, mendengarkan, atau memberi ruang.
            </li>
            <li>
              <span className="font-display text-ink">3.</span> Kamu yang menentukan setelahnya.
              Nggak ada skor, nggak ada yang harus &ldquo;sembuh&rdquo;.
            </li>
          </ol>
          <p className="mt-4 text-sm text-ink-faint">
            Ruang ini dua arah: {them} juga bisa membukanya untukmu.
          </p>
        </PaperCard>
      ) : null}

      <p className="text-center font-hand text-2xl text-accent-ink text-balance">{HOLD_PHILOSOPHY}</p>

      {overview.ready ? (
        <div className="flex flex-col gap-3">
          <Link href="/hold/past" className="group block">
            <PaperCard className="flex items-center justify-between gap-3 py-4 transition group-hover:-translate-y-0.5">
              <div>
                <Eyebrow>past holds</Eyebrow>
                <p className="mt-1 text-sm text-ink-soft">
                  {overview.keptCount > 0
                    ? `${overview.keptCount} ruang yang kalian pilih untuk disimpan.`
                    : "Hanya yang kamu pilih untuk disimpan yang tinggal di sini."}
                </p>
              </div>
              <span aria-hidden className="text-ink-faint transition group-hover:text-accent-ink">→</span>
            </PaperCard>
          </Link>
          <WhatsAppToggle initial={holdWhatsAppEnabled(ctx.profile.notif_prefs)} />
        </div>
      ) : null}
    </div>
  );
}
