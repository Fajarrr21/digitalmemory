import Link from "next/link";
import { getSpaceContext } from "@/lib/auth";
import { isAvailable } from "@/lib/adore/logic";
import { getAdore, getAdoreSealed } from "@/lib/adore/queries";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { ComingSoon } from "@/components/ui/coming-soon";
import { formatInstant } from "@/lib/date";
import type { AdoreContent } from "@/lib/adore/queries";
import { KINDS, KIND_ORDER, MORE_KINDS, itemHref } from "./adore-config";

export default async function AdoreHome() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const rows = await getAdore(ctx.spaceId);
  if (rows === null)
    return <ComingSoon eyebrow="the way i adore you. ♡" title="the way i adore you." note="Belum siap — jalankan migration 0023–0026 dulu." />;

  const isAuthor = ctx.role === "author";
  const live = rows.filter((r) => isAvailable(r));
  const sealedCount = isAuthor ? 0 : (await getAdoreSealed(ctx.spaceId)).length;
  const latestReason = live.filter((r) => r.content_type === "reason").at(-1);
  const countLine = (kind: (typeof KIND_ORDER)[number]) => {
    const mine = live.filter((r) => r.content_type === kind);
    const unopened = mine.filter((r) => !r.opened_at).length;
    if (kind === "reason") return `${mine.length} alasan${unopened && !isAuthor ? ` · ${unopened} baru` : ""}`;
    if (kind === "open_when") return `${mine.length} surat${unopened ? ` · ${unopened} ${isAuthor ? "belum dibuka" : "menunggu"}` : ""}`;
    if (kind === "thousand") return `${mine.length} / 1000 alasan`;
    if (kind === "surprise") return unopened && !isAuthor ? "Ada sesuatu yang menunggumu." : `${mine.length} kejutan kecil`;
    return `${mine.length} bab`;
  };
  const favoriteCount = live.filter((r) => r.favorite).length;
  const tz = ctx.profile.timezone;
  // Baru dibaca: what she opened lately (for him: what she opened of his).
  const recentlyRead = live
    .filter((r) => r.opened_at)
    .sort((a, b) => b.opened_at!.localeCompare(a.opened_at!))
    .slice(0, 3);
  // Baru ditambahkan: the newest that became readable.
  const recentlyAdded = [...live].sort((a, b) => b.publish_at.localeCompare(a.publish_at)).slice(0, 3);
  const row = (r: AdoreContent, when: string) => (
    <Link
      key={r.id}
      href={itemHref(r.content_type, r.id)}
      className="flex items-baseline justify-between gap-3 rounded-xl px-1 py-1.5 transition hover:bg-blush/20"
    >
      <span className="min-w-0">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent-ink">{KINDS[r.content_type].label}</span>
        <span className="block truncate text-sm text-ink">{r.title}</span>
      </span>
      <span className="flex-none font-mono text-[11px] text-ink-faint">{formatInstant(when, tz)}</span>
    </Link>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>the way i adore you. ♡</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink text-balance">
          {isAuthor ? "the way i adore you." : "Halo, sayang."}
        </h1>
        <p className="mt-1 text-ink-soft">
          {isAuthor ? "Semua yang kamu tulis tentang dia — dari pengamatanmu sendiri." : "Selalu ada sesuatu yang ingin kamu tahu dariku."}
        </p>
      </div>

      {live.some((r) => r.content_type === "name_page") ? (
        <Link href={`/adore/${KINDS.name_page.slug}`} className="self-start font-hand text-xl text-accent-ink hover:underline">
          namamu, kata favoritku →
        </Link>
      ) : null}

      {latestReason ? (
        <Link href={`/adore/${KINDS.reason.slug}`} className="group block">
          <PaperCard lift className="bg-gradient-to-br from-blush/40 to-paper transition group-hover:-translate-y-0.5">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-ink">alasan kecil, belakangan ini</p>
            <p className="mt-2 font-display text-xl font-medium text-ink text-balance">{latestReason.title}</p>
            <p className="mt-2 line-clamp-3 font-display leading-relaxed text-ink-soft">{latestReason.body}</p>
          </PaperCard>
        </Link>
      ) : null}

      <div className="flex flex-col gap-3">
        {KIND_ORDER.map((kind) => (
          <Link key={kind} href={`/adore/${KINDS[kind].slug}`} className="group block">
            <PaperCard className="relative overflow-hidden transition group-hover:-translate-y-0.5">
              <p className="font-display text-lg font-medium text-ink">{KINDS[kind].label}</p>
              <p className="mt-0.5 text-sm text-ink-soft">{KINDS[kind].tagline}</p>
              <p className="mt-2 font-mono text-xs text-accent-ink">{countLine(kind)}</p>
              <span aria-hidden className="pointer-events-none absolute -right-1 -bottom-3 text-6xl opacity-10">
                {KINDS[kind].emoji}
              </span>
            </PaperCard>
          </Link>
        ))}
      </div>

      {recentlyRead.length || recentlyAdded.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {recentlyAdded.length ? (
            <PaperCard className="p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">baru ditambahkan</p>
              <div className="mt-1 flex flex-col">{recentlyAdded.map((r) => row(r, r.publish_at))}</div>
            </PaperCard>
          ) : null}
          {recentlyRead.length ? (
            <PaperCard className="p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                {isAuthor ? "baru dia baca" : "baru kamu baca"}
              </p>
              <div className="mt-1 flex flex-col">{recentlyRead.map((r) => row(r, r.opened_at!))}</div>
            </PaperCard>
          ) : null}
        </div>
      ) : null}

      <section className="flex flex-col gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">hal kecil lainnya</p>
        <div className="grid grid-cols-2 gap-2">
          {MORE_KINDS.map((kind) => {
            const n = live.filter((r) => r.content_type === kind).length;
            return (
              <Link
                key={kind}
                href={`/adore/${KINDS[kind].slug}`}
                className="rounded-xl border border-rule-soft px-3 py-2.5 text-sm text-ink transition hover:border-accent-ink/30"
              >
                <span aria-hidden>{KINDS[kind].emoji}</span> {KINDS[kind].label}
                {n && kind !== "name_page" ? <span className="ml-1 font-mono text-[11px] text-ink-faint">{n}</span> : null}
              </Link>
            );
          })}
        </div>
      </section>

      {favoriteCount > 0 ? (
        <Link href="/adore/favorites" className="self-center text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline">
          ★ Yang ingin kubaca lagi ({favoriteCount}) →
        </Link>
      ) : null}

      {sealedCount > 0 ? (
        <p className="text-center font-hand text-xl text-accent-ink">dan {sealedCount} lagi, masih tersegel. ♡</p>
      ) : null}

      {isAuthor ? (
        <Link href="/adore/studio" className="self-center text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline">
          ✏️ Studio penulis →
        </Link>
      ) : null}
    </div>
  );
}
