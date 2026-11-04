"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict, format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { Chips, Field } from "@/components/words/chips";
import { WorkText } from "@/components/words/work-text";
import { ExplainPanel } from "@/components/words/explain-panel";
import { DiffView } from "@/components/words/diff-view";
import { BackLink } from "@/components/words/back-link";
import { SendDialog } from "@/components/words/send-dialog";
import { SelectionRefiner, useTextareaSelection } from "@/components/words/selection-refiner";
import { useSelectionIn } from "@/components/words/use-selection";
import { DEPTHS, GENRES, LANGUAGES, MOODS, WORDS_LIMITS, WORK_TYPES, openWhenLabel, workTypeOf } from "@/lib/words/options";
import { fallbackTitle } from "@/lib/words/logic";
import type { WorkDetail } from "@/lib/words/queries";
import type { WordsLanguage, WorkType } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { deleteLine, deleteWork, restoreRevision, saveLine, saveVersion, setWorkFavorite, updateWork } from "../../actions";

type SaveState = "saved" | "dirty" | "saving" | "error";

const REV_LABEL: Record<string, string> = {
  created: "Dibuat",
  manual: "Disimpan sebagai versi",
  rewrite: "The Rewrite",
  refine: "Satu bagian diperhalus",
  restore: "Dipulihkan",
};

export function WorkEditor({
  detail,
  aiReady,
  partnerName,
  partnerBirthday,
  today,
  authorName,
  replyTo,
}: {
  replyTo: { id: string; title: string } | null;
  detail: WorkDetail;
  aiReady: boolean;
  partnerName: string | null;
  partnerBirthday: string | null;
  today: string;
  authorName: string;
}) {
  const router = useRouter();
  const { work } = detail;
  const backupKey = `words:work:${work.id}`;
  const [title, setTitle] = useState(work.title);
  const [content, setContent] = useState(work.content);
  const [meta, setMeta] = useState({
    work_type: work.work_type,
    style: work.style,
    genre: work.genre,
    mood: work.mood,
    language: work.language,
    literary_depth: work.literary_depth,
    status: work.status,
  });
  const [favorite, setFavorite] = useState(work.is_favorite);
  const [mode, setMode] = useState<"write" | "read">(work.content.trim() ? "read" : "write");
  const [save, setSave] = useState<SaveState>("saved");
  const [recovered, setRecovered] = useState<{ title: string; content: string } | null>(null);
  const [panel, setPanel] = useState<"none" | "send" | "meta" | "history" | "delete">("none");
  const [replied, setReplied] = useState(false);
  const [viewRev, setViewRev] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const lastSaved = useRef({ title: work.title, content: work.content });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { ref: taRef, sel, onSelect } = useTextareaSelection();
  const readRef = useRef<HTMLDivElement | null>(null);
  const [picked, clearPicked] = useSelectionIn(readRef);

  // Unsaved words from a previous visit (network dropped, tab closed)?
  useEffect(() => {
    try {
      const raw = localStorage.getItem(backupKey);
      if (!raw) return;
      const b = JSON.parse(raw) as { title: string; content: string; at: number };
      if ((b.content !== work.content || b.title !== work.title) && b.at > new Date(work.updated_at).getTime()) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time recovery check after mount
        setRecovered({ title: b.title, content: b.content });
      } else localStorage.removeItem(backupKey);
    } catch {}
  }, [backupKey, work.content, work.title, work.updated_at]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const next = { title, content };
    if (next.title === lastSaved.current.title && next.content === lastSaved.current.content) {
      setSave("saved");
      return true;
    }
    setSave("saving");
    const res = await updateWork({ id: work.id, title: next.title, content: next.content });
    if (res.error) {
      setSave("error");
      return false;
    }
    lastSaved.current = next;
    setSave("saved");
    try {
      localStorage.removeItem(backupKey);
    } catch {}
    return true;
  }, [title, content, work.id, backupKey]);

  // Autosave: a quiet second after typing stops. A local copy is kept until
  // the server has it, so a dropped connection never loses a line.
  useEffect(() => {
    if (title === lastSaved.current.title && content === lastSaved.current.content) return;
    setSave("dirty");
    try {
      localStorage.setItem(backupKey, JSON.stringify({ title, content, at: Date.now() }));
    } catch {}
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 1200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [title, content, backupKey, flush]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (save === "dirty" || save === "saving" || save === "error") e.preventDefault();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [flush, save]);

  function updateMeta<K extends keyof typeof meta>(k: K, v: (typeof meta)[K]) {
    setMeta((m) => ({ ...m, [k]: v }));
    start(async () => {
      const res = await updateWork({ id: work.id, [k]: v } as Parameters<typeof updateWork>[0]);
      if (res.error) setNote(res.error);
    });
  }

  async function go(href: string) {
    const ok = await flush();
    if (ok) router.push(href);
    else setNote("Belum tersimpan — periksa koneksi lalu coba lagi.");
  }

  const type = meta.work_type as WorkType;
  const sentLabel = detail.sent.length
    ? `Dikirim ${detail.sent.length}× · terakhir ${formatDistanceToNowStrict(new Date(detail.sent[0].created_at), { locale: localeId })} lalu`
    : "Privat — hanya kamu yang bisa membaca";
  const rev = viewRev ? detail.revisions.find((r) => r.id === viewRev) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <BackLink href="/words/library" label="The Library" />
        <SaveBadge state={save} onRetry={() => void flush()} />
      </div>

      {recovered ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-accent/50 bg-blush/30 p-4 text-sm">
          <p className="flex-1 text-ink">Ada tulisan yang belum sempat tersimpan dari kunjungan sebelumnya.</p>
          <Button
            size="sm"
            onClick={() => {
              setTitle(recovered.title);
              setContent(recovered.content);
              setRecovered(null);
              setMode("write");
            }}
          >
            Pulihkan
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setRecovered(null);
              try {
                localStorage.removeItem(backupKey);
              } catch {}
            }}
          >
            Abaikan
          </Button>
        </div>
      ) : null}

      {replyTo && !replied ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-rule bg-paper-2/50 p-4 text-sm">
          <p className="flex-1 text-ink-soft">
            ✍️ Membalas <span className="font-display italic text-ink">“{replyTo.title}”</span> dari {partnerName ?? "pasanganmu"}. Tulis, lalu kirim
            sebagai balasan.
          </p>
          {partnerName && content.trim() ? (
            <Button size="sm" onClick={() => setPanel("send")}>
              💌 Kirim balasan
            </Button>
          ) : null}
        </div>
      ) : null}

      <div>
        <div className="flex items-center gap-2">
          <Eyebrow>
            {workTypeOf(type).emoji} {workTypeOf(type).label}
            {meta.status === "draft" ? " · draft" : ""}
          </Eyebrow>
          <button
            type="button"
            aria-pressed={favorite}
            aria-label={favorite ? "Hapus dari favorit" : "Tandai favorit"}
            onClick={() => {
              setFavorite(!favorite);
              void setWorkFavorite(work.id, !favorite);
            }}
            className={cn("ml-auto text-xl transition", favorite ? "text-accent-ink" : "text-ink-faint hover:text-accent-ink")}
          >
            {favorite ? "♥" : "♡"}
          </button>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, WORDS_LIMITS.title))}
          placeholder={content.trim() ? fallbackTitle(content) : "Judul…"}
          aria-label="Judul"
          className="mt-2 w-full bg-transparent font-display text-3xl font-medium text-ink placeholder:text-ink-faint/70 focus:outline-none"
        />
        <p className="mt-1 text-xs text-ink-faint">
          {authorName} · {format(new Date(work.created_at), "d MMM yyyy", { locale: localeId })} · {sentLabel}
        </p>
      </div>

      <div className="flex gap-1 self-start rounded-full border border-rule bg-paper p-1" role="tablist">
        {(["read", "write"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn("rounded-full px-4 py-1.5 text-sm transition", mode === m ? "bg-blush/70 text-ink" : "text-ink-soft")}
          >
            {m === "read" ? "📖 Baca" : "✏️ Tulis"}
          </button>
        ))}
      </div>

      {mode === "write" ? (
        <div className="flex flex-col gap-3">
          <textarea
            ref={taRef}
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, WORDS_LIMITS.content))}
            onSelect={onSelect}
            placeholder="Mulai dari satu kalimat yang jujur…"
            rows={14}
            className="min-h-[50vh] w-full resize-y rounded-2xl border border-rule bg-paper px-5 py-5 font-display text-[18px] leading-[1.85] text-ink placeholder:text-ink-faint focus:border-accent-ink/40 focus:outline-none md:px-8 md:py-7"
            autoFocus={!work.content.trim()}
          />
          <p className="text-right font-mono text-[11px] text-ink-faint">
            {content.trim() ? content.trim().split(/\s+/).length : 0} kata
          </p>
          {aiReady && content.trim() ? (
            <SelectionRefiner
              text={content}
              sel={sel}
              language={meta.language as WordsLanguage}
              onApply={(next, info) => {
                setContent(next);
                start(async () => {
                  const res = await saveVersion({ id: work.id, title, content: next, kind: "refine", transformation: `“${info.before.slice(0, 60)}”` });
                  if (res.error) setNote(res.error);
                  else lastSaved.current = { title, content: next };
                  router.refresh();
                });
              }}
            />
          ) : null}
        </div>
      ) : (
        <PaperCard lift className="relative px-6 py-8 md:px-12 md:py-12">
          <div ref={readRef}>
            {content.trim() ? (
              <WorkText text={content} type={type} size="lg" />
            ) : (
              <p className="text-ink-faint">Halaman ini masih kosong.</p>
            )}
          </div>
          {picked ? (
            <div className="sticky bottom-36 mt-6 flex flex-wrap items-center gap-2 rounded-full border border-rule bg-paper/95 p-1.5 pl-4 shadow-[var(--shadow-soft)] backdrop-blur md:bottom-20">
              <span className="min-w-0 flex-1 truncate font-display text-sm italic text-ink-soft">“{picked}”</span>
              <Button
                size="sm"
                onClick={() =>
                  start(async () => {
                    const res = await saveLine({ text: picked, workId: work.id, sourceTitle: title || fallbackTitle(content) });
                    setNote(res.error ?? "Disimpan ke Lines I Love ♡");
                    clearPicked();
                    router.refresh();
                  })
                }
                disabled={pending}
              >
                ♡ Simpan baris
              </Button>
              <Link
                href={`/words/canvas?work=${work.id}&text=${encodeURIComponent(picked.slice(0, 600))}`}
                className="inline-flex h-9 items-center rounded-full px-3 text-sm text-ink-soft hover:text-accent-ink"
              >
                🎨 Kartu
              </Link>
            </div>
          ) : content.trim() ? (
            <p className="mt-6 text-xs text-ink-faint">Blok satu kalimat untuk menyimpannya ke Lines I Love.</p>
          ) : null}
        </PaperCard>
      )}

      {note ? (
        <p className="text-sm text-ink-soft" role="status">
          {note}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {partnerName ? (
          <Button size="sm" onClick={() => setPanel(panel === "send" ? "none" : "send")} disabled={!content.trim()}>
            💌 Kirim ke {partnerName}
          </Button>
        ) : null}
        {aiReady ? (
          <Button size="sm" variant="soft" onClick={() => go(`/words/rewrite?work=${work.id}`)} disabled={!content.trim()}>
            🪶 The Rewrite
          </Button>
        ) : null}
        <Button size="sm" variant="soft" onClick={() => go(`/words/canvas?work=${work.id}`)} disabled={!content.trim()}>
          🎨 The Canvas
        </Button>
        <Button
          size="sm"
          variant="soft"
          disabled={pending || !content.trim()}
          onClick={() =>
            start(async () => {
              const res = await saveVersion({ id: work.id, title, content, kind: "manual" });
              if (!res.error) lastSaved.current = { title, content };
              setNote(res.error ?? "Versi ini disimpan ✓");
              router.refresh();
            })
          }
        >
          💾 Simpan versi
        </Button>
        <Button size="sm" variant="ghost" onClick={() => updateMeta("status", meta.status === "draft" ? "finished" : "draft")}>
          {meta.status === "draft" ? "✓ Tandai selesai" : "↺ Jadikan draft"}
        </Button>
      </div>

      {panel === "send" && partnerName ? (
        <SendDialog
          workId={work.id}
          partnerName={partnerName}
          partnerBirthday={partnerBirthday}
          today={today}
          replyTo={replied ? null : (replyTo?.id ?? null)}
          onClose={() => setPanel("none")}
          onSent={() => {
            if (replyTo) setReplied(true);
            lastSaved.current = { title, content };
            router.refresh();
          }}
        />
      ) : null}

      {content.trim() && aiReady ? <ExplainPanel text={content} language={meta.language as WordsLanguage} /> : null}

      <div className="flex flex-col divide-y divide-rule-soft rounded-2xl border border-rule bg-paper">
        <Disclosure label="Detail karya" open={panel === "meta"} onToggle={() => setPanel(panel === "meta" ? "none" : "meta")}>
          <div className="flex flex-col gap-5">
            <Field label="Bentuk">
              <Chips
                size="sm"
                options={WORK_TYPES.map((w) => ({ key: w.key, label: `${w.emoji} ${w.label}` }))}
                value={meta.work_type}
                onChange={(v) => updateMeta("work_type", v as WorkType)}
              />
              <Chips
                size="sm"
                allowNone
                options={workTypeOf(type).styles}
                value={meta.style}
                onChange={(v) => updateMeta("style", (v as string) ?? null)}
              />
            </Field>
            <Field label="Genre">
              <Chips size="sm" allowNone options={GENRES} value={meta.genre} onChange={(v) => updateMeta("genre", (v as string) ?? null)} />
            </Field>
            <Field label="Suasana">
              <Chips size="sm" allowNone options={MOODS} value={meta.mood} onChange={(v) => updateMeta("mood", (v as string) ?? null)} />
            </Field>
            <Field label="Kedalaman bahasa">
              <Chips
                size="sm"
                allowNone
                options={DEPTHS.map((d) => ({ key: String(d.level), label: `${d.level} · ${d.label}` }))}
                value={meta.literary_depth ? String(meta.literary_depth) : null}
                onChange={(v) => updateMeta("literary_depth", v ? Number(v) : null)}
              />
            </Field>
            <Field label="Bahasa">
              <Chips size="sm" options={LANGUAGES} value={meta.language} onChange={(v) => updateMeta("language", v as WordsLanguage)} />
            </Field>
            {work.theme ? <p className="text-sm text-ink-soft">Tema: {work.theme}</p> : null}
            <p className="text-xs text-ink-faint">
              {work.origin === "muse" ? "Lahir dari The Muse" : work.origin === "rewrite" ? "Lahir dari The Rewrite" : "Ditulis dengan tangan"} ·
              diperbarui {formatDistanceToNowStrict(new Date(work.updated_at), { locale: localeId })} lalu
            </p>
          </div>
        </Disclosure>

        <Disclosure
          label={`Riwayat revisi (${detail.revisions.length})`}
          open={panel === "history"}
          onToggle={() => setPanel(panel === "history" ? "none" : "history")}
        >
          {detail.revisions.length ? (
            <div className="flex flex-col gap-4">
              <ul className="flex flex-col gap-1">
                {detail.revisions.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setViewRev(viewRev === r.id ? null : r.id)}
                      className={cn(
                        "flex w-full items-baseline gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
                        viewRev === r.id ? "bg-blush/40" : "hover:bg-paper-2/60",
                      )}
                    >
                      <span className="text-ink">{REV_LABEL[r.kind] ?? r.kind}</span>
                      {r.transformation ? <span className="min-w-0 flex-1 truncate text-ink-faint">{r.transformation}</span> : <span className="flex-1" />}
                      <span className="flex-none font-mono text-[11px] text-ink-faint">
                        {format(new Date(r.created_at), "d MMM · HH:mm", { locale: localeId })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {rev ? (
                <div className="flex flex-col gap-3">
                  <DiffView original={rev.content} revised={content} leftLabel="Versi itu" rightLabel="Sekarang" />
                  {rev.content !== content ? (
                    <div>
                      <Button
                        size="sm"
                        variant="soft"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const res = await restoreRevision(work.id, rev.id);
                            if (res.error) setNote(res.error);
                            else {
                              setTitle(rev.title);
                              setContent(rev.content);
                              lastSaved.current = { title: rev.title, content: rev.content };
                              setViewRev(null);
                              setNote("Versi itu dipulihkan ✓");
                              router.refresh();
                            }
                          })
                        }
                      >
                        ↺ Pulihkan versi ini
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-ink-faint">Sama dengan yang sekarang.</p>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-ink-faint">Belum ada versi. Tekan “Simpan versi” untuk menyimpan titik ini.</p>
          )}
        </Disclosure>

        {detail.lines.length ? (
          <div className="px-5 py-4">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">Lines I Love dari karya ini</p>
            <ul className="flex flex-col gap-2">
              {detail.lines.map((l) => (
                <li key={l.id} className="flex items-start gap-3">
                  <p className="flex-1 font-display italic text-ink">“{l.text}”</p>
                  <button
                    type="button"
                    onClick={() =>
                      start(async () => {
                        await deleteLine(l.id);
                        router.refresh();
                      })
                    }
                    className="text-xs text-ink-faint hover:text-danger"
                    aria-label="Hapus baris"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {detail.sent.length ? (
          <div className="px-5 py-4">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">Pernah dikirim</p>
            <ul className="flex flex-col gap-1 text-sm">
              {detail.sent.map((s) => (
                <li key={s.id}>
                  <Link href={`/words/to-you/${s.id}`} className="flex justify-between gap-3 text-ink-soft hover:text-accent-ink">
                    <span>
                      {format(new Date(s.created_at), "d MMM yyyy", { locale: localeId })}
                      {s.open_when ? ` · ${openWhenLabel(s.open_when, s.open_when_label)}` : ""}
                    </span>
                    <span className="text-ink-faint">{s.opened_at ? "dibuka ♡" : "belum dibuka"}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-faint">Yang dikirim adalah salinan saat itu — mengubah karya ini tidak mengubah yang sudah diberikan.</p>
          </div>
        ) : null}

        <Disclosure label="Hapus karya" open={panel === "delete"} onToggle={() => setPanel(panel === "delete" ? "none" : "delete")} danger>
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-ink-soft">
              Karya dan seluruh riwayat revisinya akan hilang.
              {detail.sent.length ? ` Yang sudah dikirim ke ${partnerName ?? "pasanganmu"} tetap tersimpan di sana.` : ""}
              {detail.lines.length ? " Baris yang kamu simpan tetap ada di Lines I Love." : ""}
            </p>
            <div>
              <Button
                size="sm"
                variant="soft"
                className="border-danger/40 text-danger"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await deleteWork(work.id);
                    if (res.error) setNote(res.error);
                    else {
                      try {
                        localStorage.removeItem(backupKey);
                      } catch {}
                      router.push("/words/library");
                    }
                  })
                }
              >
                Ya, hapus selamanya
              </Button>
            </div>
          </div>
        </Disclosure>
      </div>
    </div>
  );
}

function SaveBadge({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "error") {
    return (
      <button type="button" onClick={onRetry} className="font-mono text-[11px] text-danger underline">
        belum tersimpan · coba lagi
      </button>
    );
  }
  return (
    <span className="font-mono text-[11px] text-ink-faint" role="status" aria-live="polite">
      {state === "saved" ? "tersimpan ✓" : state === "saving" ? "menyimpan…" : "…"}
    </span>
  );
}

function Disclosure({
  label,
  open,
  onToggle,
  danger,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn("flex w-full items-center justify-between px-5 py-4 text-left text-sm", danger ? "text-ink-faint hover:text-danger" : "text-ink-soft")}
      >
        {label}
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      {open ? <div className="px-5 pb-5">{children}</div> : null}
    </div>
  );
}
