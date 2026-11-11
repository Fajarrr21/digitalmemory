"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PaperCard } from "@/components/ui/paper-card";
import type { AdoreReaction, AdoreType, WishState } from "@/lib/supabase/database.types";
import { noteNumber, randomOther, thousandNumber } from "@/lib/adore/logic";
import { spotifyEmbedUrl } from "@/lib/spotify";
import { CATEGORIES, REACTIONS, WISH_STATES, categoryLabel } from "./adore-config";
import { markAdore } from "./actions";
import { WishControls } from "./wish-controls";
import { ReplyBox } from "./reply-box";
import { VoicePlayer } from "@/components/stay/voice-player";

export type ReaderItem = {
  id: string;
  title: string;
  subtitle: string | null;
  body: string;
  category: string | null;
  dateLabel: string;
  opened: boolean;
  favorite: boolean;
  reaction: AdoreReaction | null;
  /** Author-only badge: draft / scheduled / archived. null = live for her. */
  badge: string | null;
  /** A Thousand Times, You: the stored number (001…). */
  number: number | null;
  songId: string | null;
  wishState: WishState | null;
  wishNote: string | null;
  /** "target: Mar 2027" for a future wish. */
  targetLabel: string | null;
  photoUrl: string | null;
  audioUrl: string | null;
  audioSeconds: number | null;
  reply: string | null;
};

const KIND_FALLBACK: Partial<Record<AdoreType, string>> = {
  notification: "notifikasi kecil",
  remembered: "aku ingat",
  another_universe: "semesta lain",
  reasons_i_stay: "alasan aku bertahan",
  future_wish: "sebuah harapan",
  surprise: "kejutan kecil",
};

const isWish = (kind: AdoreType) => kind === "future_wish" || kind === "another_universe";
const wishLabel = (s: WishState | null) => WISH_STATES.find((w) => w.key === (s ?? "someday"))?.label ?? "";

const numbered = (kind: AdoreType) => kind === "reason" || kind === "thousand";

export function AdoreReader({
  kind,
  items,
  sealed,
  isKeeper,
  initialId,
}: {
  kind: AdoreType;
  items: ReaderItem[];
  sealed: { id: string; category: string | null; when: string }[];
  isKeeper: boolean;
  /** Deep link (?id=) — open straight onto this note. */
  initialId?: string;
}) {
  const reduce = useReducedMotion();
  const [list, setList] = useState(items);
  const [index, setIndex] = useState<number | null>(() => {
    const i = items.findIndex((x) => x.id === initialId);
    return i >= 0 ? i : null;
  });
  // Arriving via a deep link counts as opening it.
  useEffect(() => {
    const it = items.find((x) => x.id === initialId);
    if (isKeeper && it && !it.opened) void markAdore(it.id);
  }, [initialId, isKeeper, items]);
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("");
  const label = (it: ReaderItem, i: number) =>
    kind === "thousand" ? thousandNumber(it.number ?? i + 1) : noteNumber(i);

  function patch(i: number, change: Partial<ReaderItem>) {
    setList((l) => l.map((it, j) => (j === i ? { ...it, ...change } : it)));
  }

  function open(i: number) {
    setIndex(i);
    const it = list[i];
    if (isKeeper && !it.opened) {
      patch(i, { opened: true });
      startTransition(() => void markAdore(it.id));
    }
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  function toggleFavorite(i: number) {
    const favorite = !list[i].favorite;
    patch(i, { favorite });
    startTransition(() => void markAdore(list[i].id, { favorite }));
  }

  function react(i: number, key: AdoreReaction) {
    const reaction = list[i].reaction === key ? null : key;
    patch(i, { reaction });
    startTransition(
      () => void markAdore(list[i].id, { reaction: reaction ?? "" }),
    );
  }

  if (index !== null && list[index]) {
    const it = list[index];
    const heading = numbered(kind)
      ? label(it, index)
      : (categoryLabel(kind, it.category) ??
        (kind === "open_when" ? "sepucuk surat" : (KIND_FALLBACK[kind] ?? "satu bab")));
    return (
      <div className="flex flex-col gap-5">
        <button
          type="button"
          onClick={() => setIndex(null)}
          className="self-start text-sm text-ink-soft hover:text-ink"
        >
          ← semua
        </button>
        <AnimatePresence mode="wait">
          <motion.div
            key={it.id}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.45 }}
          >
            <PaperCard lift className="px-6 py-8 sm:px-10">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-ink">
                {heading}
                {numbered(kind) && it.category
                  ? ` · ${categoryLabel(kind, it.category)}`
                  : ""}
                {it.badge ? ` · ${it.badge}` : ""}
              </p>
              <h2 className="mt-3 font-display text-2xl font-medium text-ink text-balance">
                {it.title}
              </h2>
              {it.subtitle ? (
                <p className="mt-1 font-hand text-xl text-accent-ink">
                  {it.subtitle}
                </p>
              ) : null}
              {it.body ? (
                <p className="mt-5 whitespace-pre-line font-display text-[1.1rem] leading-[1.85] text-ink">
                  {it.body}
                </p>
              ) : null}
              {it.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                <img src={it.photoUrl} alt="" className="mt-5 w-full rounded-2xl object-cover" loading="lazy" />
              ) : null}
              {it.audioUrl ? <VoicePlayer src={it.audioUrl} knownSeconds={it.audioSeconds} className="mt-5" /> : null}
              {it.songId ? (
                <iframe
                  title="Spotify"
                  src={spotifyEmbedUrl(it.songId)}
                  className="mt-5 h-20 w-full rounded-xl"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                />
              ) : null}
              {kind === "remembered" ? (
                <p className="mt-5 font-hand text-xl text-accent-ink">Aku mengingat ini untukmu.</p>
              ) : null}
              {it.wishNote ? (
                <p className="mt-5 whitespace-pre-line border-l-2 border-accent-ink/30 pl-3 text-ink-soft">{it.wishNote}</p>
              ) : null}
              <div className="mt-6 flex items-end justify-between gap-3">
                <p className="font-mono text-[11px] text-ink-faint">
                  {it.dateLabel}
                  {it.targetLabel ? ` · ${it.targetLabel}` : ""}
                </p>
                <p className="font-hand text-xl text-accent-ink">
                  — dari aku ♡
                </p>
              </div>
            </PaperCard>
          </motion.div>
        </AnimatePresence>

        {!it.badge && (isKeeper || it.reply) && kind !== "notification" ? (
          <ReplyBox
            key={`reply-${it.id}`}
            id={it.id}
            reply={it.reply}
            canWrite={isKeeper}
            onSaved={(reply) => patch(index, { reply })}
          />
        ) : null}

        {isWish(kind) && !it.badge ? (
          <WishControls
            key={it.id}
            id={it.id}
            kind={kind}
            state={it.wishState}
            note={it.wishNote}
            onChange={(wishState, wishNote) => patch(index, { wishState, wishNote })}
          />
        ) : null}

        {isKeeper ? (
          <div className="flex flex-wrap items-center gap-2">
            {REACTIONS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => react(index, r.key)}
                aria-pressed={it.reaction === r.key}
                title={r.label}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  it.reaction === r.key
                    ? "border-accent-ink/50 bg-blush/50 text-ink"
                    : "border-rule text-ink-soft hover:border-accent-ink/30"
                }`}
              >
                {r.emoji}{" "}
                <span className="sr-only sm:not-sr-only">{r.label}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => toggleFavorite(index)}
              aria-pressed={it.favorite}
              className="ml-auto rounded-full border border-rule px-3 py-1.5 text-sm text-ink-soft hover:border-accent-ink/30"
            >
              {it.favorite ? "★ disimpan" : "☆ simpan"}
            </button>
          </div>
        ) : it.reaction || it.favorite ? (
          <p className="text-sm text-ink-soft">
            Reaksinya:{" "}
            {REACTIONS.find((r) => r.key === it.reaction)?.emoji ?? ""}{" "}
            {it.favorite ? "· ★ dia simpan" : ""}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2 text-sm">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => open(index - 1)}
            className="text-ink-soft hover:text-ink disabled:opacity-30"
          >
            ← sebelumnya
          </button>
          {numbered(kind) && list.length > 1 ? (
            <button
              type="button"
              onClick={() => open(randomOther(list.length, index))}
              className="font-hand text-lg text-accent-ink"
            >
              acak ♡
            </button>
          ) : null}
          <button
            type="button"
            disabled={index === list.length - 1}
            onClick={() => open(index + 1)}
            className="text-ink-soft hover:text-ink disabled:opacity-30"
          >
            berikutnya →
          </button>
        </div>
      </div>
    );
  }

  if (list.length === 0 && sealed.length === 0) {
    return (
      <PaperCard className="border-dashed text-center">
        <p className="font-hand text-xl text-accent-ink">belum ada apa-apa</p>
        <p className="mt-1 text-sm text-ink-soft">
          {isKeeper
            ? "Sebentar lagi ada sesuatu untukmu. ♡"
            : "Tulis yang pertama di Studio. ♡"}
        </p>
      </PaperCard>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {numbered(kind) ? (
        <>
          {kind === "thousand" ? (
            <div className="flex gap-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="cari… (atau nomor)"
                aria-label="Cari alasan"
                className="min-w-0 flex-1 rounded-xl border border-rule bg-ground px-3 py-2 text-sm text-ink outline-none focus:border-accent-ink/50"
              />
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                aria-label="Filter kategori"
                className="rounded-xl border border-rule bg-ground px-2 py-2 text-sm text-ink"
              >
                <option value="">semua</option>
                {CATEGORIES.thousand.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-xs text-ink-soft">
              {kind === "reason" ? `${list.length} alasan, dan masih terus bertambah.` : ""}
            </p>
            {list.length > 0 ? (
              <button
                type="button"
                onClick={() => open(Math.floor(Math.random() * list.length))}
                className="font-hand text-lg text-accent-ink"
              >
                baca acak ♡
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {list
              .map((it, i) => ({ it, i }))
              .filter(({ it, i }) => {
                if (cat && it.category !== cat) return false;
                const q = query.trim().toLowerCase();
                return (
                  !q ||
                  label(it, i).includes(q) ||
                  `${it.title} ${it.body}`.toLowerCase().includes(q)
                );
              })
              .map(({ it, i }) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => open(i)}
                  className="group text-left"
                >
                  <PaperCard className="h-full p-4 transition group-hover:-translate-y-0.5">
                    <p className="font-mono text-xs text-accent-ink">
                      {label(it, i)} {isKeeper && !it.opened ? "· baru" : ""}{" "}
                      {it.favorite ? "★" : ""}
                    </p>
                    <p className="mt-1 font-display text-base text-ink text-balance">
                      {it.title}
                    </p>
                    {it.badge ? (
                      <p className="mt-1 font-mono text-[10px] uppercase text-ink-faint">
                        {it.badge}
                      </p>
                    ) : null}
                  </PaperCard>
                </button>
              ))}
            {sealed.map((s) => (
              <PaperCard key={s.id} className="border-dashed p-4 opacity-70">
                <p className="font-mono text-xs text-ink-faint">🔒 tersegel</p>
                <p className="mt-1 font-hand text-lg text-ink-soft">
                  terbuka {s.when}
                </p>
              </PaperCard>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((it, i) => (
            <button
              key={it.id}
              type="button"
              onClick={() => open(i)}
              className="group w-full text-left"
            >
              <PaperCard
                lift
                className={`transition group-hover:-translate-y-0.5 ${
                  kind === "open_when" && !it.opened
                    ? "bg-gradient-to-br from-blush/50 to-paper"
                    : ""
                }`}
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-ink">
                  {kind === "through_my_eyes"
                    ? `bab ${noteNumber(i)}`
                    : (categoryLabel(kind, it.category) ?? (kind === "open_when" ? "buka saat…" : KIND_FALLBACK[kind] ?? ""))}
                  {isWish(kind) ? ` · ${wishLabel(it.wishState)}` : ""}
                  {it.badge ? ` · ${it.badge}` : ""} {it.favorite ? "★" : ""}
                </p>
                <p className="mt-2 font-display text-xl font-medium text-ink text-balance">
                  {it.title}
                </p>
                {it.subtitle ? (
                  <p className="mt-1 text-sm text-ink-soft">{it.subtitle}</p>
                ) : null}
                {isKeeper && !it.opened ? (
                  <p className="mt-1 font-hand text-lg text-accent-ink">
                    ketuk untuk membuka ♡
                  </p>
                ) : null}
              </PaperCard>
            </button>
          ))}
          {sealed.map((s) => (
            <PaperCard key={s.id} className="border-dashed opacity-70">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                🔒 {categoryLabel(kind, s.category) ?? "tersegel"}
              </p>
              <p className="mt-1 font-hand text-lg text-ink-soft">
                terbuka {s.when}
              </p>
            </PaperCard>
          ))}
        </div>
      )}
      <p className="text-center text-xs text-ink-faint">
        <Link href="/adore" className="hover:text-ink">
          ← the way i adore you
        </Link>
      </p>
    </div>
  );
}
