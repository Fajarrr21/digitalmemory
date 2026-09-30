"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { PaperCard } from "@/components/ui/paper-card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";
import { SOURCE_CHOICES, type SourceChoice } from "../watch-config";
import { checkWatchSource, createWatchRoom, type CheckedSource } from "../actions";

/**
 * "What do you want to watch?" — YouTube is only one of the doors.
 *
 * Anything that isn't YouTube gets *checked* before it can enter the room: the
 * server asks the site whether it allows being shown inside another page, and
 * if the answer is no, that's the end of it. We never strip a site's
 * protection — we just say so, kindly, and offer to try something else.
 */
export function CreateWatch() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [choice, setChoice] = useState<SourceChoice | null>(null);
  const [url, setUrl] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [checked, setChecked] = useState<CheckedSource | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  function check() {
    startBusy(async () => {
      setProblem(null);
      setChecked(null);
      const res = await checkWatchSource(url);
      if (!res.ok || !res.source) {
        setProblem(res.error ?? "Videonya nggak bisa diputar di sini.");
        return;
      }
      setChecked(res.source);
    });
  }

  function open() {
    if (!checked) return;
    startBusy(async () => {
      setProblem(null);
      const res = await createWatchRoom({
        kind: checked.kind,
        url: checked.url,
        videoId: checked.videoId,
        title: checked.title,
        subtitle,
        posterUrl: checked.posterUrl,
      });
      if (!res.ok || !res.id) {
        setProblem(res.error ?? "Gagal membuka room.");
        return;
      }
      router.push(`/watch/room/${res.id}`);
    });
  }

  function reset() {
    setChecked(null);
    setProblem(null);
    setUrl("");
  }

  // ---- step 1: which door? -------------------------------------------------
  if (!choice) {
    return (
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <Eyebrow>🍿 watch together</Eyebrow>
          <h1 className="mt-3 font-display text-2xl font-medium text-ink text-balance">
            What do you want to watch?
          </h1>
          <p className="mt-2 font-hand text-xl text-accent-ink">
            you bring the video, kita yang bikin jadi momen ♡
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {SOURCE_CHOICES.map((c, i) => (
            <motion.button
              key={c.id}
              type="button"
              onClick={() => setChoice(c)}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : i * 0.06 }}
              className="group rounded-2xl border border-rule bg-paper p-5 text-left transition hover:-translate-y-0.5 hover:border-accent-ink/40"
            >
              <p className="font-display text-lg font-medium text-ink">
                <span className="mr-2">{c.emoji}</span>
                {c.label}
              </p>
              <p className="mt-1 text-sm text-ink-soft">{c.hint}</p>
            </motion.button>
          ))}
        </div>

        <p className="text-center text-xs text-ink-faint">
          YouTube bukan satu-satunya pilihan — selama situsnya mengizinkan, dia bisa ikut masuk
          room.
        </p>
      </div>
    );
  }

  // ---- step 2: paste it, check it ------------------------------------------
  return (
    <div className="flex flex-col gap-6">
      <div>
        <button
          type="button"
          onClick={() => {
            setChoice(null);
            reset();
          }}
          className="text-sm text-ink-faint transition hover:text-ink-soft"
        >
          ← Pilih sumber lain
        </button>
      </div>

      <div className="text-center">
        <Eyebrow>
          {choice.emoji} {choice.label}
        </Eyebrow>
        <h1 className="mt-3 font-display text-2xl font-medium text-ink text-balance">
          {choice.id === "youtube" ? "Tempel link YouTube-nya" : "Paste the video page"}
        </h1>
      </div>

      <PaperCard className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase">
            link
          </span>
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setChecked(null);
              setProblem(null);
            }}
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder={choice.placeholder}
            className="w-full rounded-xl border border-rule bg-ground px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-accent-ink/50"
          />
        </label>

        {!checked ? (
          <Button type="button" onClick={check} disabled={busy || url.trim().length < 4}>
            {busy ? "Memeriksa…" : "Check video →"}
          </Button>
        ) : null}

        {problem ? (
          <div className="rounded-xl border border-rule bg-paper-2 p-4 text-center">
            <p className="text-2xl">⚠️</p>
            <p className="mt-2 font-display text-lg font-medium text-ink">
              Can&apos;t play this video here
            </p>
            <p className="mt-1 text-sm text-ink-soft">{problem}</p>
            <button
              type="button"
              onClick={reset}
              className="mt-3 text-sm text-accent-ink hover:underline"
            >
              Try another video
            </button>
          </div>
        ) : null}

        {checked ? (
          <div className="flex flex-col gap-4 rounded-xl border border-rule bg-paper-2 p-4">
            <div className="flex items-start gap-3">
              {checked.posterUrl ? (
                // The source's own thumbnail; decorative next to the title.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={checked.posterUrl}
                  alt=""
                  className="h-16 w-28 flex-none rounded-lg object-cover"
                />
              ) : (
                <span className="grid h-16 w-28 flex-none place-items-center rounded-lg bg-ground text-2xl">
                  🎬
                </span>
              )}
              <div className="min-w-0">
                <p className="font-mono text-[11px] tracking-[0.18em] text-accent-ink uppercase">
                  ✓ ready for watch together
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-ink">{checked.title}</p>
              </div>
            </div>

            <p className="text-xs text-ink-soft">{checked.note}</p>
            {checked.warning ? (
              <p className="text-xs text-ink-soft">⚠️ {checked.warning}</p>
            ) : null}

            <label className="flex flex-col gap-2">
              <span className="font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase">
                catatan kecil (opsional)
              </span>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                maxLength={200}
                placeholder="Episode 12"
                className="w-full rounded-xl border border-rule bg-ground px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-accent-ink/50"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={reset}
                className="text-sm text-ink-faint hover:text-ink-soft"
              >
                Ganti video
              </button>
              <Button type="button" onClick={open} disabled={busy}>
                {busy ? "Menyiapkan…" : "Add to room →"}
              </Button>
            </div>
          </div>
        ) : null}
      </PaperCard>

      <p className={cn("text-center text-xs text-ink-faint")}>
        Kalau sebuah situs melarang videonya dibuka di dalam aplikasi lain, kita hormati — nggak ada
        yang dipaksa atau diakali di sini. ♡
      </p>

      <div className="text-center">
        <Link href="/watch" className="text-sm text-ink-faint hover:text-ink-soft">
          ← Kembali
        </Link>
      </div>
    </div>
  );
}
