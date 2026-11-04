"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { TZDate } from "@date-fns/tz";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { BackLink } from "@/components/words/back-link";
import { deliveryState, excerpt } from "@/lib/words/logic";
import { OPEN_WHEN, openWhenLabel, workTypeOf } from "@/lib/words/options";
import type { Delivery, ToYou } from "@/lib/words/queries";
import { cn } from "@/lib/utils";
import { withdrawDelivery } from "../actions";

function when(iso: string, tz: string) {
  return format(new TZDate(new Date(iso).getTime(), tz), "d MMM yyyy · HH:mm", { locale: localeId });
}

/** To You — what was given to me (sealed, waiting, read) and what I gave. */
export function ToYouInbox({ data, partnerName, timezone }: { data: ToYou; partnerName: string; timezone: string }) {
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [showArchived, setShowArchived] = useState(false);
  const waiting = data.received.filter((d) => deliveryState(d) !== "opened");
  const read = data.received.filter((d) => deliveryState(d) === "opened");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink />
        <Eyebrow className="mt-4">To You</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink text-balance">Words between you and {partnerName}.</h1>
        <p className="mt-2 text-ink-soft">Karya yang dikirim hanya bisa dibaca oleh kalian berdua. Drafmu tetap milikmu sendiri.</p>
      </div>

      <div className="flex gap-1 self-start rounded-full border border-rule bg-paper p-1" role="tablist">
        {(
          [
            ["received", `Untukku${waiting.length + data.sealed.length ? ` · ${waiting.length + data.sealed.length}` : ""}`],
            ["sent", `Dariku · ${data.sent.length}`],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn("rounded-full px-4 py-1.5 text-sm transition", tab === k ? "bg-blush/70 text-ink" : "text-ink-soft")}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "received" ? (
        <div className="flex flex-col gap-6">
          {data.sealed.length || waiting.length ? (
            <section className="grid gap-3 sm:grid-cols-2">
              {data.sealed.map((s) => {
                const ow = OPEN_WHEN.find((o) => o.key === s.open_when);
                return (
                  <Envelope
                    key={s.id}
                    href={`/words/to-you/${s.id}`}
                    emoji="🔒"
                    title={openWhenLabel(s.open_when, s.open_when_label) ?? `Something from ${partnerName}`}
                    sub={`Tersegel sampai ${when(s.unlock_at, timezone)}`}
                    locked
                    glyph={ow?.emoji ?? "✉️"}
                  />
                );
              })}
              {waiting.map((d) => {
                const ow = OPEN_WHEN.find((o) => o.key === d.open_when);
                return (
                  <Envelope
                    key={d.id}
                    href={`/words/to-you/${d.id}`}
                    emoji={ow?.emoji ?? "✉️"}
                    title={openWhenLabel(d.open_when, d.open_when_label) ?? `A little ${workTypeOf(d.work_type).label.toLowerCase()} from ${partnerName}`}
                    sub={d.open_when ? "Kamu yang memilih kapan membukanya." : "Belum dibuka · tap untuk membaca"}
                    glyph={ow?.emoji ?? "💌"}
                  />
                );
              })}
            </section>
          ) : null}

          {read.length ? (
            <section className="flex flex-col gap-2">
              <Eyebrow>Sudah dibaca</Eyebrow>
              <ul className="flex flex-col divide-y divide-rule-soft rounded-2xl border border-rule bg-paper">
                {read.map((d) => (
                  <Row key={d.id} d={d} meta={`dari ${partnerName}`} />
                ))}
              </ul>
            </section>
          ) : null}

          {!data.sealed.length && !data.received.length ? (
            <PaperCard className="border-dashed text-center">
              <p className="font-hand text-2xl text-accent-ink">nothing yet — but soon, maybe</p>
              <p className="mt-1 text-sm text-ink-soft">Apa yang {partnerName} kirim untukmu akan menunggu di sini.</p>
            </PaperCard>
          ) : null}

          {data.archived.length ? (
            <div>
              <button type="button" onClick={() => setShowArchived((v) => !v)} className="text-sm text-ink-faint hover:text-ink-soft">
                {showArchived ? "▾" : "▸"} Disimpan di arsip ({data.archived.length})
              </button>
              {showArchived ? (
                <ul className="mt-2 flex flex-col divide-y divide-rule-soft rounded-2xl border border-rule bg-paper">
                  {data.archived.map((d) => (
                    <Row key={d.id} d={d} meta="diarsipkan" />
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <SentList sent={data.sent} partnerName={partnerName} timezone={timezone} />
      )}
    </div>
  );
}

function Envelope({
  href,
  emoji,
  title,
  sub,
  locked,
  glyph,
}: {
  href: string;
  emoji: string;
  title: string;
  sub: string;
  locked?: boolean;
  glyph: string;
}) {
  return (
    <Link href={href} className="group block">
      <PaperCard
        lift
        className={cn(
          "relative h-full overflow-hidden transition group-hover:-translate-y-0.5",
          locked ? "bg-paper-2/60" : "bg-gradient-to-br from-blush/50 to-paper",
        )}
      >
        {/* the envelope flap */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-[linear-gradient(160deg,transparent_49%,var(--rule)_50%,transparent_51%),linear-gradient(200deg,transparent_49%,var(--rule)_50%,transparent_51%)] opacity-70" />
        <p className="relative mt-4 text-xl" aria-hidden>
          {emoji}
        </p>
        <p className="relative mt-2 font-display text-lg italic text-ink text-balance">{title}</p>
        <p className="relative mt-1 text-sm text-ink-soft">{sub}</p>
        <span aria-hidden className="pointer-events-none absolute -right-1 -bottom-3 text-6xl opacity-10">
          {glyph}
        </span>
      </PaperCard>
    </Link>
  );
}

function Row({ d, meta }: { d: Delivery; meta: string }) {
  return (
    <li>
      <Link href={`/words/to-you/${d.id}`} className="flex gap-4 px-5 py-4 transition hover:bg-paper-2/50">
        <span aria-hidden className="mt-1">
          {workTypeOf(d.work_type).emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate font-display text-[17px] text-ink">{d.title}</span>
            {d.recipient_favorite ? <span className="text-accent-ink">♥</span> : null}
          </span>
          <span className="block truncate text-sm italic text-ink-soft">{excerpt(d.content, 90)}</span>
        </span>
        <span className="flex-none pt-1 text-right font-mono text-[11px] text-ink-faint">
          {format(new Date(d.created_at), "d MMM", { locale: localeId })}
          <br />
          {meta}
        </span>
      </Link>
    </li>
  );
}

function SentList({ sent, partnerName, timezone }: { sent: Delivery[]; partnerName: string; timezone: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!sent.length) {
    return (
      <PaperCard className="border-dashed text-center">
        <p className="font-hand text-2xl text-accent-ink">nothing sent yet</p>
        <p className="mt-1 text-sm text-ink-soft">
          Buka sebuah karya di{" "}
          <Link href="/words/library" className="text-accent-ink underline underline-offset-4">
            The Library
          </Link>{" "}
          lalu tekan “💌 Kirim ke {partnerName}”.
        </p>
      </PaperCard>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <ul className="flex flex-col divide-y divide-rule-soft rounded-2xl border border-rule bg-paper">
        {sent.map((d) => {
          const state = deliveryState(d);
          const status =
            state === "locked"
              ? `🔒 terbuka ${when(d.unlock_at!, timezone)}`
              : state === "opened"
                ? `dibuka ♡ ${format(new Date(d.opened_at!), "d MMM", { locale: localeId })}`
                : "belum dibuka";
          return (
            <li key={d.id} className="flex items-center gap-3 px-5 py-4">
              <Link href={`/words/to-you/${d.id}`} className="min-w-0 flex-1">
                <span className="block truncate font-display text-[17px] text-ink">{d.title}</span>
                <span className="block truncate text-xs text-ink-faint">
                  {format(new Date(d.created_at), "d MMM yyyy", { locale: localeId })}
                  {d.open_when ? ` · ${openWhenLabel(d.open_when, d.open_when_label)}` : ""} · {status}
                </span>
              </Link>
              {!d.opened_at ? (
                confirm === d.id ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await withdrawDelivery(d.id);
                        if (res.error) setError(res.error);
                        setConfirm(null);
                        router.refresh();
                      })
                    }
                    className="flex-none text-xs text-danger"
                  >
                    tarik kembali?
                  </button>
                ) : (
                  <button type="button" onClick={() => setConfirm(d.id)} className="flex-none text-xs text-ink-faint hover:text-danger">
                    tarik
                  </button>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-ink-faint">Yang belum dibuka masih bisa ditarik. Yang sudah dibaca, sudah jadi miliknya juga.</p>
    </div>
  );
}
