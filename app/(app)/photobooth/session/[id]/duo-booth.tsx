"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { cn } from "@/lib/utils";
import { CameraCapture } from "../../camera";
import { FramePicker } from "../../frame-picker";
import { BoothResultActions } from "../../booth-result";
import { composeBoothStrip } from "../../compose-strip";
import {
  BOOTH_POLL_MS,
  DUO_ALBUM_TITLE,
  DUO_CLASSIC_PROMPT,
  DUO_SHOT_PROMPTS,
  frameById,
} from "../../photobooth-config";
import {
  clearBoothPhoto,
  completeBooth,
  getBoothState,
  joinBoothSession,
  saveBoothPhoto,
  setBoothFrame,
  setBoothShots,
  startBoothShooting,
  type BoothSnapshot,
} from "../../actions";

/**
 * ♡ Both of Us — a remote photobooth. Each person shoots on their own camera;
 * the session syncs by polling (no realtime infra needed for two people).
 * Partner photos stay hidden until the shared reveal, so the finished strip is
 * a little surprise for both.
 */
export function DuoBooth({
  initial,
  spaceId,
  selfId,
  dateISO,
  dateLabel,
  bestFlameDay,
}: {
  initial: BoothSnapshot;
  spaceId: string;
  selfId: string;
  dateISO: string;
  dateLabel: string;
  bestFlameDay: number;
}) {
  const reduce = useReducedMotion();
  const [snap, setSnap] = useState<BoothSnapshot>(initial);
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null);
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [strip, setStrip] = useState<{ blob: Blob; url: string } | null>(null);
  const composing = useRef(false);

  const isCreator = snap.creatorId === selfId;
  const myName = isCreator ? snap.creatorName : (snap.participantName ?? "You");
  const otherName = isCreator ? (snap.participantName ?? "Dia") : snap.creatorName;
  const mine = snap.photos.filter((p) => p.userId === selfId);
  const theirs = snap.photos.filter((p) => p.userId !== selfId);
  const allDone = mine.length >= snap.shotCount && theirs.length >= snap.shotCount;

  // ---- polling ---------------------------------------------------------------
  const refresh = useCallback(async () => {
    const res = await getBoothState(snap.id);
    if (res.ok && res.session) setSnap(res.session);
  }, [snap.id]);

  useEffect(() => {
    if (snap.status === "completed" && strip) return; // nothing left to sync
    const t = setInterval(() => void refresh(), BOOTH_POLL_MS);
    return () => clearInterval(t);
  }, [refresh, snap.status, strip]);

  // ---- compose on completion ---------------------------------------------------
  useEffect(() => {
    if (snap.status !== "completed" || strip || composing.current) return;
    const urls: string[][] = [];
    for (let i = 0; i < snap.shotCount; i++) {
      const row = [snap.creatorId, snap.participantId].map(
        (uid) => snap.photos.find((p) => p.userId === uid && p.shotIndex === i)?.url ?? null,
      );
      if (row.some((u) => !u)) return; // wait for the next poll to sign everything
      urls.push(row as string[]);
    }
    composing.current = true;
    void (async () => {
      try {
        const blob = await composeBoothStrip({
          frame: frameById(snap.frameId),
          shots: urls,
          names: [snap.creatorName, snap.participantName ?? "Dia"],
          dateLabel,
        });
        setStrip({ blob, url: URL.createObjectURL(blob) });
      } catch {
        setError("Gagal menyusun stripnya. Muat ulang halaman ini ya.");
      } finally {
        composing.current = false;
      }
    })();
  }, [snap, strip, dateLabel]);

  // ---- actions -------------------------------------------------------------------
  function run(fn: () => Promise<{ ok?: boolean; error?: string }>) {
    startBusy(async () => {
      setError(null);
      const res = await fn();
      if (res.error) setError(res.error);
      await refresh();
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Gagal menyalin — salin dari address bar ya.");
    }
  }

  async function keepPhoto(shotIndex: number, blob: Blob) {
    const path = `${spaceId}/${selfId}/photobooth/${snap.id}/shot-${shotIndex}-${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await createClient()
      .storage.from("media")
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (upErr) {
      setError("Gagal mengunggah fotonya. Coba lagi ya. ♡");
      return;
    }
    const res = await saveBoothPhoto(snap.id, shotIndex, path);
    if (res.error) {
      setError(res.error);
      return;
    }
    setRetakeIndex(null);
    await refresh();
  }

  // ---- phases ---------------------------------------------------------------------

  if (snap.expired) {
    return (
      <BoothShell>
        <p className="text-3xl">🌙</p>
        <p className="mt-3 font-display text-xl font-medium text-ink">
          This little booth has closed.
        </p>
        <p className="mt-1 text-sm text-ink-soft">Undangannya tidak sempat terpakai — tidak apa-apa.</p>
        <Link href="/photobooth" className="mt-4 inline-block text-sm text-accent-ink hover:underline">
          Buka photobooth baru →
        </Link>
      </BoothShell>
    );
  }

  if (snap.status === "waiting" && !isCreator) {
    return (
      <BoothShell>
        <p className="text-4xl">♡</p>
        <p className="mt-3 font-display text-2xl font-medium text-ink text-balance">
          {snap.creatorName} invited you to a photobooth.
        </p>
        <p className="mt-2 text-sm text-ink-soft">One little frame, the two of you.</p>
        {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-6">
          <Button type="button" onClick={() => run(() => joinBoothSession(snap.id))} disabled={busy}>
            {busy ? "Masuk…" : "Join"}
          </Button>
        </div>
      </BoothShell>
    );
  }

  if (snap.status === "waiting") {
    return (
      <BoothShell>
        <p className="text-4xl">📸</p>
        <p className="mt-3 font-display text-2xl font-medium text-ink">
          Your photobooth is ready
        </p>
        <p className="mt-2 flex items-center justify-center gap-1 text-sm text-ink-soft">
          Waiting for someone to join
          <WaitingDots />
        </p>
        {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-6 flex flex-col items-center gap-2">
          <Button type="button" onClick={copyLink}>
            {copied ? "Copied ♡" : "Copy Invite Link"}
          </Button>
          <p className="text-xs text-ink-faint">Share this link with your person. ♡</p>
        </div>
      </BoothShell>
    );
  }

  if (snap.status === "joined") {
    return (
      <div className="flex flex-col gap-6">
        <BoothShell>
          <p className="text-3xl">📸</p>
          <p className="mt-2 font-display text-2xl font-medium text-ink">
            You&apos;re both here ♡
          </p>
          <div className="mt-3 flex items-center justify-center gap-3 text-sm">
            <NameChip name={snap.creatorName} />
            <NameChip name={snap.participantName ?? "…"} />
          </div>
          <p className="mt-3 font-hand text-lg text-accent-ink">Now let&apos;s make a memory.</p>
        </BoothShell>

        <section className="flex flex-col gap-2">
          <Eyebrow>how many shots?</Eyebrow>
          <div className="grid grid-cols-2 gap-3">
            {([1, 4] as const).map((n) => (
              <button
                key={n}
                type="button"
                disabled={busy}
                onClick={() => {
                  setSnap((s) => ({ ...s, shotCount: n }));
                  run(() => setBoothShots(snap.id, n));
                }}
                aria-pressed={snap.shotCount === n}
                className={cn(
                  "rounded-2xl border p-4 text-center transition",
                  snap.shotCount === n
                    ? "border-accent-ink/60 bg-blush/30"
                    : "border-rule bg-paper hover:border-accent-ink/40",
                )}
              >
                <p className="font-display text-lg font-medium text-ink">
                  {n === 1 ? "Classic" : "4 Shot"}
                </p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {n === 1 ? "satu foto berdua" : "empat putaran, satu strip"}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <Eyebrow>choose a frame — it&apos;s shared</Eyebrow>
          <FramePicker
            value={snap.frameId}
            onChange={(id) => {
              setSnap((s) => ({ ...s, frameId: id }));
              run(() => setBoothFrame(snap.id, id));
            }}
            bestFlameDay={bestFlameDay}
          />
        </section>

        {error ? <p role="alert" className="text-center text-sm text-danger">{error}</p> : null}

        <div className="flex justify-center">
          <Button type="button" onClick={() => run(() => startBoothShooting(snap.id))} disabled={busy}>
            Continue →
          </Button>
        </div>
      </div>
    );
  }

  if (snap.status === "shooting") {
    const missing: number[] = [];
    for (let i = 0; i < snap.shotCount; i++) {
      if (!mine.some((p) => p.shotIndex === i)) missing.push(i);
    }
    const currentIndex = retakeIndex ?? missing[0];

    if (currentIndex !== undefined) {
      const prompt =
        snap.shotCount === 1 ? DUO_CLASSIC_PROMPT : DUO_SHOT_PROMPTS[currentIndex] ?? null;
      return (
        <div className="flex flex-col gap-5">
          <CameraCapture
            key={currentIndex}
            prompt={prompt}
            label={snap.shotCount > 1 ? `Shot ${currentIndex + 1} of ${snap.shotCount}` : null}
            onKeep={(blob) => keepPhoto(currentIndex, blob)}
          />
          {error ? <p role="alert" className="text-center text-sm text-danger">{error}</p> : null}
          <PartnerProgress name={otherName} done={theirs.length} total={snap.shotCount} />
        </div>
      );
    }

    // All of mine are in — review my shots, wait for the partner, reveal.
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <Eyebrow>your photos ✓</Eyebrow>
          <p className="mt-2 text-sm text-ink-soft">Punyamu sudah lengkap, {myName}.</p>
        </div>

        <div className="flex justify-center gap-3">
          {[...mine]
            .sort((a, b) => a.shotIndex - b.shotIndex)
            .map((p) => (
              <div key={p.shotIndex} className="flex flex-col items-center gap-1">
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt="" className="h-20 w-20 rounded-xl border border-rule object-cover" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-rule bg-paper-2">📷</div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setRetakeIndex(p.shotIndex);
                    run(() => clearBoothPhoto(snap.id, p.shotIndex));
                  }}
                  className="text-xs text-ink-faint hover:text-accent-ink"
                >
                  ↻ Retake
                </button>
              </div>
            ))}
        </div>

        {allDone ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <motion.p
              initial={reduce ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-3xl"
            >
              ✨
            </motion.p>
            <p className="font-display text-xl font-medium text-ink">Your photos are ready.</p>
            <Button type="button" onClick={() => run(() => completeBooth(snap.id))} disabled={busy}>
              Show me
            </Button>
          </div>
        ) : (
          <PartnerProgress name={otherName} done={theirs.length} total={snap.shotCount} waiting />
        )}

        {error ? <p role="alert" className="text-center text-sm text-danger">{error}</p> : null}
      </div>
    );
  }

  // ---- completed: the reveal --------------------------------------------------
  return (
    <div className="flex flex-col items-center gap-6">
      {strip ? (
        <>
          <motion.div
            initial={reduce ? false : { y: -90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 80, damping: 15 }}
            className="w-full max-w-xs"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={strip.url}
              alt="Hasil photobooth berdua"
              className="w-full rounded-2xl border border-rule shadow-[var(--shadow-soft)]"
            />
          </motion.div>

          <BoothResultActions
            blob={strip.blob}
            filename={`our-little-photobooth-${dateISO}.png`}
            albumTitle={DUO_ALBUM_TITLE}
            spaceId={spaceId}
            userId={selfId}
          />

          <Link href="/photobooth" className="text-sm text-ink-faint hover:underline">
            ← Photobooth
          </Link>
        </>
      ) : (
        <BoothShell>
          <p className="text-3xl">✨</p>
          <p className="mt-3 font-display text-xl font-medium text-ink">
            Menyusun strip kalian…
          </p>
          {error ? <p role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}
        </BoothShell>
      )}
    </div>
  );
}

// ---- little pieces ------------------------------------------------------------

function BoothShell({ children }: { children: React.ReactNode }) {
  return (
    <PaperCard lift className="bg-gradient-to-br from-blush/30 to-paper py-10 text-center">
      {children}
    </PaperCard>
  );
}

function NameChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-ink/40 bg-blush/30 px-3 py-1 text-accent-ink">
      {name} ✓
    </span>
  );
}

function WaitingDots() {
  return (
    <span aria-hidden className="inline-flex w-5">
      <motion.span
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      >
        …
      </motion.span>
    </span>
  );
}

function PartnerProgress({
  name,
  done,
  total,
  waiting = false,
}: {
  name: string;
  done: number;
  total: number;
  waiting?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <p className="text-sm text-ink-soft">
        {name} · {Math.min(done, total)}/{total} foto
        {waiting && done < total ? " — sabar sebentar ya ♡" : ""}
      </p>
      <div className="flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              i < done ? "bg-accent" : "border border-rule bg-paper",
            )}
          />
        ))}
      </div>
      <p className="text-xs text-ink-faint">Fotonya dia tetap rahasia sampai reveal. 🤫</p>
    </div>
  );
}
