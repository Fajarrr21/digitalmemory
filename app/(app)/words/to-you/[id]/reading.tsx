"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { TZDate } from "@date-fns/tz";
import { Button } from "@/components/ui/button";
import { PaperCard } from "@/components/ui/paper-card";
import { BackLink } from "@/components/words/back-link";
import { WorkText } from "@/components/words/work-text";
import { ExplainPanel } from "@/components/words/explain-panel";
import { useSelectionIn } from "@/components/words/use-selection";
import { deliveryState } from "@/lib/words/logic";
import { OPEN_WHEN, openWhenLabel, workTypeOf } from "@/lib/words/options";
import type { DeliveryDetail } from "@/lib/words/queries";
import { cn } from "@/lib/utils";
import { createWork, markDelivery, openDelivery, saveLine, withdrawDelivery } from "../../actions";

/**
 * The reading room. For the recipient an unopened gift first appears as an
 * envelope ("Open when you miss me") — they choose the moment; opening is a
 * deliberate tap. Then: generous typography, the intro in a hand, and
 * favourite / keep a line / make a card / reply / archive.
 */
export function Reading({
  detail,
  iAmRecipient,
  partnerName,
  selfName,
  aiReady,
  timezone,
}: {
  detail: DeliveryDetail;
  iAmRecipient: boolean;
  partnerName: string;
  selfName: string;
  aiReady: boolean;
  timezone: string;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const d = detail.delivery;
  const state = deliveryState(d);
  const [opened, setOpened] = useState(!iAmRecipient || state === "opened");
  const [favorite, setFavorite] = useState(d.recipient_favorite);
  const [archived, setArchived] = useState(d.recipient_archived);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const readRef = useRef<HTMLDivElement | null>(null);
  const [picked, clearPicked] = useSelectionIn(readRef);
  const from = iAmRecipient ? partnerName : selfName;
  const to = iAmRecipient ? selfName : partnerName;
  const ow = OPEN_WHEN.find((o) => o.key === d.open_when);
  const date = format(new TZDate(new Date(d.created_at).getTime(), timezone), "d MMMM yyyy", { locale: localeId });

  function open() {
    start(async () => {
      const res = await openDelivery(d.id);
      if (res.error) setNote(res.error);
      else {
        setOpened(true);
        router.refresh();
      }
    });
  }

  function reply(withMuse: boolean) {
    if (withMuse) {
      router.push(`/words/muse?reply=${d.id}`);
      return;
    }
    start(async () => {
      const res = await createWork({ content: "", work_type: d.work_type, language: d.language, origin: "manual" });
      if (res.error || !res.id) setNote(res.error ?? "Gagal membuat halaman.");
      else router.push(`/words/w/${res.id}?reply=${d.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/words/to-you" label="To You" />

      <AnimatePresence mode="wait">
        {!opened ? (
          <motion.div
            key="envelope"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.97, y: -10 }}
            transition={{ duration: 0.5 }}
          >
            <PaperCard lift className="relative flex flex-col items-center gap-4 overflow-hidden bg-gradient-to-b from-blush/40 to-paper px-6 py-16 text-center">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(160deg,transparent_49%,var(--rule)_50%,transparent_51%),linear-gradient(200deg,transparent_49%,var(--rule)_50%,transparent_51%)]"
              />
              <p className="relative text-5xl" aria-hidden>
                {ow?.emoji ?? "💌"}
              </p>
              <p className="relative font-display text-2xl italic text-ink text-balance">
                {openWhenLabel(d.open_when, d.open_when_label) ?? `Something ${partnerName} wrote for you.`}
              </p>
              <p className="relative text-sm text-ink-soft">
                dari {partnerName} · {date}
              </p>
              {d.open_when && d.open_when !== "birthday" ? (
                <p className="relative max-w-xs text-sm text-ink-faint">Tidak harus sekarang. Buka saat rasanya tepat — kamu yang tahu.</p>
              ) : null}
              <Button className="relative mt-2" onClick={open} disabled={pending}>
                {pending ? "Membuka…" : "Buka pelan-pelan ♡"}
              </Button>
              {note ? <p className="relative text-sm text-danger">{note}</p> : null}
            </PaperCard>
          </motion.div>
        ) : (
          <motion.div
            key="letter"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-6"
          >
            <PaperCard lift className="relative px-6 py-10 md:px-14 md:py-14">
              {d.intro ? <p className="mb-8 font-hand text-2xl leading-snug text-accent-ink">{d.intro}</p> : null}
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                {workTypeOf(d.work_type).emoji} {workTypeOf(d.work_type).label}
                {d.open_when ? ` · ${openWhenLabel(d.open_when, d.open_when_label)}` : ""}
              </p>
              <h1 className="mt-3 font-display text-3xl font-medium leading-tight text-ink text-balance md:text-4xl">{d.title}</h1>
              <div ref={readRef} className="mt-8">
                <WorkText text={d.content} type={d.work_type} size="lg" />
              </div>
              <p className="mt-10 text-right font-display italic text-ink-soft">
                — {from}, untuk {to}
                <br />
                <span className="font-mono text-[11px] not-italic text-ink-faint">{date}</span>
              </p>

              {picked ? (
                <div className="sticky bottom-36 mt-6 flex flex-wrap items-center gap-2 rounded-full border border-rule bg-paper/95 p-1.5 pl-4 shadow-[var(--shadow-soft)] backdrop-blur md:bottom-20">
                  <span className="min-w-0 flex-1 truncate font-display text-sm italic text-ink-soft">“{picked}”</span>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await saveLine({ text: picked, deliveryId: d.id, sourceTitle: d.title });
                        setNote(res.error ?? "Disimpan ke Lines I Love ♡");
                        clearPicked();
                        router.refresh();
                      })
                    }
                  >
                    ♡ Simpan baris
                  </Button>
                  <Link
                    href={`/words/canvas?delivery=${d.id}&text=${encodeURIComponent(picked.slice(0, 600))}`}
                    className="inline-flex h-9 items-center rounded-full px-3 text-sm text-ink-soft hover:text-accent-ink"
                  >
                    🎨 Kartu
                  </Link>
                </div>
              ) : null}
            </PaperCard>

            {note ? (
              <p className="text-sm text-ink-soft" role="status">
                {note}
              </p>
            ) : null}

            {iAmRecipient ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={favorite ? "primary" : "soft"}
                  onClick={() => {
                    setFavorite(!favorite);
                    start(async () => {
                      const res = await markDelivery(d.id, { favorite: !favorite });
                      if (res.error) {
                        setFavorite(favorite);
                        setNote(res.error);
                      }
                    });
                  }}
                >
                  {favorite ? "♥ Favorit" : "♡ Favorit"}
                </Button>
                <Button size="sm" variant="soft" onClick={() => reply(false)} disabled={pending}>
                  ✍️ Balas dengan tulisan
                </Button>
                {aiReady ? (
                  <Button size="sm" variant="soft" onClick={() => reply(true)}>
                    ✒️ Balas bersama The Muse
                  </Button>
                ) : null}
                <Link
                  href={`/words/canvas?delivery=${d.id}`}
                  className="inline-flex h-9 items-center rounded-full border border-rule bg-paper px-4 text-sm text-ink hover:border-accent-ink/40"
                >
                  🎨 Jadikan kartu
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setArchived(!archived);
                    start(async () => {
                      const res = await markDelivery(d.id, { archived: !archived });
                      setNote(res.error ?? (!archived ? "Disimpan di arsip — tetap bisa dibuka dari To You." : "Kembali ke library ♡"));
                    });
                  }}
                >
                  {archived ? "↺ Keluarkan dari arsip" : "Arsipkan"}
                </Button>
              </div>
            ) : (
              <SenderActions id={d.id} opened={!!d.opened_at} locked={state === "locked"} unlockAt={d.unlock_at} timezone={timezone} partnerName={partnerName} />
            )}

            {detail.replyTo || detail.replies.length ? (
              <div className="flex flex-col gap-2 rounded-2xl border border-rule bg-paper p-5 text-sm">
                {detail.replyTo ? (
                  <p className="text-ink-soft">
                    Membalas{" "}
                    <Link href={`/words/to-you/${detail.replyTo.id}`} className="font-display italic text-accent-ink underline-offset-4 hover:underline">
                      “{detail.replyTo.title}”
                    </Link>
                  </p>
                ) : null}
                {detail.replies.map((r) => (
                  <p key={r.id} className="text-ink-soft">
                    ↳ Balasan dari {r.sender_id === d.sender_id ? from : to}:{" "}
                    <Link href={`/words/to-you/${r.id}`} className="font-display italic text-accent-ink underline-offset-4 hover:underline">
                      “{r.title}”
                    </Link>
                  </p>
                ))}
              </div>
            ) : null}

            {aiReady ? <ExplainPanel text={d.content} language={d.language} /> : null}
          </motion.div>
        )}
      </AnimatePresence>
      {opened && iAmRecipient ? (
        <p className={cn("text-center text-xs text-ink-faint")}>Blok satu kalimat untuk menyimpannya ke Lines I Love.</p>
      ) : null}
    </div>
  );
}

function SenderActions({
  id,
  opened,
  locked,
  unlockAt,
  timezone,
  partnerName,
}: {
  id: string;
  opened: boolean;
  locked: boolean;
  unlockAt: string | null;
  timezone: string;
  partnerName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2 text-sm text-ink-soft">
      <p>
        {opened
          ? `${partnerName} sudah membukanya ♡`
          : locked && unlockAt
            ? `Tersegel untuk ${partnerName} sampai ${format(new TZDate(new Date(unlockAt).getTime(), timezone), "d MMM yyyy · HH:mm", { locale: localeId })}.`
            : `Menunggu ${partnerName} membukanya.`}
      </p>
      {!opened ? (
        <div>
          {confirm ? (
            <Button
              size="sm"
              variant="soft"
              className="border-danger/40 text-danger"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await withdrawDelivery(id);
                  if (res.error) setError(res.error);
                  else router.push("/words/to-you");
                })
              }
            >
              Ya, tarik kembali
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
              Tarik kembali
            </Button>
          )}
        </div>
      ) : null}
      {error ? <p className="text-danger">{error}</p> : null}
    </div>
  );
}
