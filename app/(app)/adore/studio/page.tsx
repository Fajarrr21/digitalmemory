import Link from "next/link";
import { redirect } from "next/navigation";
import { getSpaceContext } from "@/lib/auth";
import { formatInstant, localDateISO } from "@/lib/date";
import { effectiveStatus } from "@/lib/adore/logic";
import { getAdore } from "@/lib/adore/queries";
import type { AdoreType } from "@/lib/supabase/database.types";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { ComingSoon } from "@/components/ui/coming-soon";
import { KINDS, ALL_KINDS, REACTIONS, STATUS_LABEL, categoryLabel } from "../adore-config";
import { signPaths } from "@/lib/media";
import { DeleteAdore, StudioEditor, type EditorInitial } from "./studio-editor";

export default async function AdoreStudio({ searchParams }: { searchParams: Promise<{ edit?: string; new?: string }> }) {
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  if (ctx.role !== "author") redirect("/adore");

  const rows = await getAdore(ctx.spaceId);
  if (rows === null)
    return <ComingSoon eyebrow="studio penulis" title="the way i adore you." note="Belum siap — jalankan migration 0023–0026 dulu." />;

  const tz = ctx.profile.timezone;
  const now = new Date();
  const sp = await searchParams;
  const editing = sp.edit ? rows.find((r) => r.id === sp.edit) : undefined;
  const newKind = ALL_KINDS.includes(sp.new as AdoreType) ? (sp.new as AdoreType) : "reason";
  const hhmm = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

  const signed = editing ? await signPaths([editing.photo_path ?? "", editing.audio_path ?? ""]) : {};
  const initial: EditorInitial = editing
    ? {
        id: editing.id,
        content_type: editing.content_type,
        title: editing.title,
        subtitle: editing.subtitle ?? "",
        body: editing.body,
        category: editing.category ?? "",
        status: editing.status,
        publish_date: localDateISO(tz, new Date(editing.publish_at)),
        publish_time: hhmm(editing.publish_at),
        song: editing.song_track_id ? `https://open.spotify.com/track/${editing.song_track_id}` : "",
        in_pool: editing.in_pool,
        repeat_allowed: editing.repeat_allowed,
        number: editing.number,
        wish_state: editing.wish_state ?? "",
        target_date: editing.target_date ?? "",
        photoUrl: editing.photo_path ? (signed[editing.photo_path] ?? null) : null,
        audioUrl: editing.audio_path ? (signed[editing.audio_path] ?? null) : null,
      }
    : {
        content_type: newKind,
        title: "",
        subtitle: "",
        body: "",
        category: "",
        status: "draft",
        publish_date: "",
        publish_time: "",
        song: "",
        in_pool: newKind === "surprise",
        repeat_allowed: true,
        number: null,
        wish_state: "",
        target_date: "",
        photoUrl: null,
        audioUrl: null,
      };

  const statuses = rows.map((r) => effectiveStatus(r, now));
  const stat = (s: string) => statuses.filter((x) => x === s).length;
  const touched = rows
    .filter((r) => r.opened_at)
    .sort((a, b) => (b.replied_at ?? b.opened_at!).localeCompare(a.replied_at ?? a.opened_at!))
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>studio penulis</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink">the way i adore you.</h1>
        <p className="mt-1 text-ink-soft">Tulis dari pengamatanmu sendiri. Dia akan tahu bedanya. ♡</p>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {(["published", "scheduled", "draft", "archived"] as const).map((s) => (
          <PaperCard key={s} className="p-3">
            <p className="font-display text-2xl text-ink">{stat(s)}</p>
            <p className="font-mono text-[10px] uppercase text-ink-faint">{STATUS_LABEL[s]}</p>
          </PaperCard>
        ))}
      </div>

      {touched.length > 0 ? (
        <PaperCard>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-ink">yang baru dia buka</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {touched.map((r) => (
              <li key={r.id} className="flex flex-col gap-0.5">
                <div className="flex justify-between gap-3">
                  <span className="text-ink">
                    {r.title} {REACTIONS.find((x) => x.key === r.reaction)?.emoji ?? ""} {r.favorite ? "★" : ""}
                  </span>
                  <span className="flex-none font-mono text-xs text-ink-faint">{formatInstant(r.opened_at!, tz)}</span>
                </div>
                {r.reply_text ? <p className="font-hand text-lg leading-snug text-accent-ink">💬 “{r.reply_text}”</p> : null}
              </li>
            ))}
          </ul>
        </PaperCard>
      ) : null}

      <StudioEditor key={editing?.id ?? `new-${newKind}`} initial={initial} spaceId={ctx.spaceId} selfId={ctx.userId} />

      {ALL_KINDS.map((kind) => {
        const list = rows.filter((r) => r.content_type === kind);
        return (
          <section key={kind} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-lg font-medium text-ink">{KINDS[kind].label}</h2>
              <Link href={`/adore/${KINDS[kind].slug}`} className="text-xs text-ink-soft hover:text-ink">pratinjau →</Link>
            </div>
            {list.length === 0 ? <p className="text-sm text-ink-faint">Belum ada.</p> : null}
            {list.map((r) => {
              const s = effectiveStatus(r, now);
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-rule-soft px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">
                      {r.number ? `${String(r.number).padStart(3, "0")} — ` : ""}
                      {r.title}
                    </p>
                    <p className="font-mono text-[10px] uppercase text-ink-faint">
                      {STATUS_LABEL[s]}
                      {s === "scheduled" ? ` · ${formatInstant(r.publish_at, tz)}` : ""}
                      {categoryLabel(kind, r.category) ? ` · ${categoryLabel(kind, r.category)}` : ""}
                      {r.opened_at ? " · dibuka" : ""}
                      {r.in_pool ? " · ♡ kotak kejutan" : ""}
                      {r.photo_path ? " · 📷" : ""}
                      {r.audio_path ? " · 🎙️" : ""}
                      {r.reply_text ? " · 💬 dibalas" : ""}
                    </p>
                  </div>
                  <div className="flex flex-none items-center gap-3">
                    <Link href={`/adore/studio?edit=${r.id}`} className="text-xs text-ink-soft hover:text-ink">sunting</Link>
                    <DeleteAdore id={r.id} />
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
