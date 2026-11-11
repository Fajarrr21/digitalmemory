import { notFound } from "next/navigation";
import { getSpaceContext } from "@/lib/auth";
import { formatInstant } from "@/lib/date";
import { adoreWhatsAppPerDay, effectiveStatus, isAvailable, milestoneProgress, readerOrder } from "@/lib/adore/logic";
import { getAdore, getAdoreSealed } from "@/lib/adore/queries";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ComingSoon } from "@/components/ui/coming-soon";
import { KINDS, STATUS_LABEL, kindFromSlug } from "../adore-config";
import { signPaths } from "@/lib/media";
import { AdoreReader, type ReaderItem } from "../adore-reader";
import { SurpriseBox } from "../surprise-box";
import { NamePage } from "../name-page";
import { NotifSetting } from "../notif-setting";

export default async function AdoreKindPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const kind = kindFromSlug((await params).kind);
  if (!kind) notFound();
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const rows = await getAdore(ctx.spaceId, kind);
  if (rows === null)
    return <ComingSoon eyebrow="the way i adore you. ♡" title={KINDS[kind].label} note="Belum siap — jalankan migration 0023–0026 dulu." />;

  const isKeeper = ctx.role === "keeper";
  const tz = ctx.profile.timezone;
  const now = new Date();

  // Your Name, My Favorite Word: one page, the newest she can see (author: newest non-archived).
  if (kind === "name_page") {
    const page = [...rows].reverse().find((r) => (isKeeper ? isAvailable(r, now) : r.status !== "archived"));
    return <NamePage page={page ?? null} isAuthor={!isKeeper} />;
  }
  // Author previews everything except archived; the keeper only ever receives available rows (RLS).
  // Media is signed only for rows this viewer can already read (RLS), so sealed notes never leak a file.
  const visible = rows.filter((r) => r.status !== "archived");
  const signed = await signPaths(visible.flatMap((r) => [r.photo_path ?? "", r.audio_path ?? ""]));
  const items: ReaderItem[] = readerOrder(rows.filter((r) => r.status !== "archived")).map((r) => {
    const s = effectiveStatus(r, now);
    return {
      id: r.id,
      title: r.title,
      subtitle: r.subtitle,
      body: r.body,
      category: r.category,
      dateLabel: formatInstant(r.publish_at, tz),
      opened: r.opened_at !== null,
      favorite: r.favorite,
      reaction: r.reaction,
      badge: s === "published" ? null : s === "scheduled" ? `terjadwal ${formatInstant(r.publish_at, tz)}` : STATUS_LABEL[s],
      number: r.number,
      songId: r.song_track_id,
      wishState: r.wish_state,
      wishNote: r.wish_note,
      targetLabel: r.target_date ? `target ${r.target_date}` : null,
      photoUrl: r.photo_path ? (signed[r.photo_path] ?? null) : null,
      audioUrl: r.audio_path ? (signed[r.audio_path] ?? null) : null,
      audioSeconds: r.audio_seconds,
      reply: r.reply_text,
    };
  });
  // Thousand: count only what she can actually read; numbers are the stored ones.
  if (kind === "thousand") items.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  const liveCount = items.filter((i) => !i.badge).length;
  const progress = milestoneProgress(liveCount);
  // Tonight, I Choose You: the newest surprise she hasn't opened becomes the envelope.
  const fresh = isKeeper ? items.filter((i) => !i.opened).at(-1) : undefined;
  const waiting = fresh
    ? { id: fresh.id, kind, title: fresh.title, subtitle: fresh.subtitle, body: fresh.body, song_track_id: fresh.songId, photoUrl: fresh.photoUrl, audioUrl: fresh.audioUrl, audioSeconds: fresh.audioSeconds }
    : null;
  const sealed = isKeeper
    ? (await getAdoreSealed(ctx.spaceId))
        .filter((s) => s.content_type === kind)
        .map((s) => ({ id: s.id, category: s.category, when: formatInstant(s.publish_at, tz) }))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>the way i adore you. ♡</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink text-balance">{KINDS[kind].label}</h1>
        <p className="mt-1 text-ink-soft">{KINDS[kind].tagline}</p>
      </div>
      {kind === "thousand" ? (
        <div>
          <p className="font-mono text-sm text-ink">
            <span className="font-display text-3xl">{liveCount}</span> / 1000 alasan
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-rule-soft" role="progressbar" aria-valuenow={liveCount} aria-valuemax={1000}>
            <div className="h-full rounded-full bg-accent-ink/60" style={{ width: `${Math.min(100, liveCount / 10)}%` }} />
          </div>
          <p className="mt-2 font-hand text-xl text-accent-ink">Dan alasanku belum habis juga.</p>
          {progress.reached.length ? (
            <p className="mt-1 font-mono text-[11px] text-ink-faint">
              {progress.reached.map((m) => `♡ ${m}`).join("  ·  ")}
            </p>
          ) : null}
        </div>
      ) : null}
      {kind === "surprise" ? (
        <>
          <SurpriseBox waiting={waiting} isKeeper={isKeeper} />
          {items.length ? <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">baca lagi</p> : null}
        </>
      ) : null}
      {kind === "notification" && isKeeper ? (
        <NotifSetting perDay={adoreWhatsAppPerDay(ctx.profile.notif_prefs)} hasNumber={!!ctx.profile.whatsapp?.trim()} />
      ) : null}
      <AdoreReader kind={kind} items={items} sealed={sealed} isKeeper={isKeeper} initialId={(await searchParams).id} />
    </div>
  );
}
