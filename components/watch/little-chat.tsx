"use client";

import { useEffect, useRef, useState } from "react";
import { formatClock } from "@/lib/watch/sync";
import { cn } from "@/lib/utils";

/**
 * 💬 Little Chat — the small, loud running commentary beside the video.
 *
 * A panel on a wide screen, a drawer over the bottom on a phone, so the player
 * stays the thing you're looking at either way.
 */

export type ChatLine = {
  id: string;
  userId: string;
  body: string;
  replyTo: string | null;
  atSeconds: number | null;
  createdAt: string;
  /** Shown immediately, still on its way to the server. */
  pending?: boolean;
  failed?: boolean;
};

export function LittleChat({
  open,
  lines,
  selfId,
  selfName,
  partnerName,
  maxLength,
  onSend,
  onClose,
}: {
  open: boolean;
  lines: ChatLine[];
  selfId: string;
  selfName: string;
  partnerName: string;
  maxLength: number;
  onSend: (body: string, replyTo: string | null) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatLine | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Follow the conversation as it happens.
  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [lines.length, open]);

  if (!open) return null;

  const nameOf = (id: string) => (id === selfId ? selfName : partnerName);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (body.length === 0) return;
    onSend(body.slice(0, maxLength), replyTo?.id ?? null);
    setDraft("");
    setReplyTo(null);
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col rounded-2xl border border-rule bg-paper",
        "max-h-[55vh] lg:max-h-none lg:h-full",
      )}
    >
      <div className="flex flex-none items-center justify-between border-b border-rule-soft px-4 py-3">
        <p className="font-mono text-[11px] tracking-[0.18em] text-accent-ink uppercase">
          💬 little chat
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup chat"
          className="text-ink-faint transition hover:text-ink-soft"
        >
          ×
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {lines.length === 0 ? (
          <p className="py-6 text-center font-hand text-lg text-accent-ink">
            belum ada yang bilang apa-apa…
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {lines.map((line) => {
              const mine = line.userId === selfId;
              const parent = line.replyTo ? lines.find((l) => l.id === line.replyTo) : null;
              return (
                <li key={line.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
                      {nameOf(line.userId)}
                    </span>
                    {line.atSeconds !== null ? (
                      <span className="font-mono text-[10px] text-ink-faint">
                        {formatClock(line.atSeconds)}
                      </span>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => setReplyTo(line)}
                    title="Balas"
                    className={cn(
                      "mt-1 max-w-[85%] rounded-2xl px-3 py-2 text-left text-sm transition",
                      mine
                        ? "bg-accent/60 text-[#4a2b30]"
                        : "bg-paper-2 text-ink hover:bg-blush/40",
                      line.pending && "opacity-60",
                      line.failed && "opacity-60 ring-1 ring-red-400/50",
                    )}
                  >
                    {parent ? (
                      <span className="mb-1 block border-l-2 border-current/30 pl-2 text-[11px] opacity-70">
                        {nameOf(parent.userId)}: {parent.body.slice(0, 60)}
                        {parent.body.length > 60 ? "…" : ""}
                      </span>
                    ) : null}
                    <span className="whitespace-pre-wrap break-words">{line.body}</span>
                  </button>

                  {line.failed ? (
                    <span className="mt-0.5 font-mono text-[10px] text-ink-faint">
                      nggak terkirim
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex-none border-t border-rule-soft p-3">
        {replyTo ? (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-paper-2 px-2 py-1 text-[11px] text-ink-soft">
            <span className="min-w-0 flex-1 truncate">
              Membalas {nameOf(replyTo.userId)}: {replyTo.body}
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label="Batal membalas"
              className="flex-none text-ink-faint hover:text-ink-soft"
            >
              ×
            </button>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={maxLength}
            placeholder="Say something…"
            aria-label="Tulis pesan"
            className="min-w-0 flex-1 rounded-full border border-rule bg-ground px-4 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-accent-ink/50"
          />
          <button
            type="submit"
            disabled={draft.trim().length === 0}
            aria-label="Kirim"
            className="flex-none rounded-full bg-accent px-3.5 py-2 text-[#4a2b30] transition disabled:opacity-40"
          >
            ➤
          </button>
        </div>
      </form>
    </div>
  );
}
