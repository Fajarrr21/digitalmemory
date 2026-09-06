"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PaperCard } from "@/components/ui/paper-card";
import type { ForYouMessage } from "@/lib/for-you";
import { openMessage, deleteMessage } from "./actions";

export function ForYouList({
  messages,
  isRecipient,
  canDelete,
}: {
  messages: ForYouMessage[];
  isRecipient: boolean;
  canDelete: boolean;
}) {
  if (messages.length === 0) {
    return (
      <PaperCard className="border-dashed text-center">
        <p className="font-hand text-xl text-accent-ink">nothing here yet</p>
        <p className="mt-1 text-sm text-ink-soft">
          {canDelete ? "Titipkan pesan pertama di bawah. ♡" : "Sebentar lagi ada sesuatu untukmu. ♡"}
        </p>
      </PaperCard>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {messages.map((m) => (
        <MessageCard key={m.id} message={m} isRecipient={isRecipient} canDelete={canDelete} />
      ))}
    </div>
  );
}

function MessageCard({
  message,
  isRecipient,
  canDelete,
}: {
  message: ForYouMessage;
  isRecipient: boolean;
  canDelete: boolean;
}) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Keeper sees the body only after opening; the author always sees it.
  const [open, setOpen] = useState(!isRecipient || message.opened_at !== null);

  function reveal() {
    if (open) return;
    setOpen(true);
    if (isRecipient && !message.opened_at) void openMessage(message.id);
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteMessage(message.id);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={reveal} className="group w-full text-left">
        <PaperCard lift className="bg-gradient-to-br from-blush/50 to-paper transition group-hover:-translate-y-0.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-ink">a message for you</p>
          <p className="mt-2 font-display text-xl font-medium text-ink text-balance">{message.title}</p>
          <p className="mt-1 font-hand text-lg text-accent-ink">ketuk untuk membuka ♡</p>
        </PaperCard>
      </button>
    );
  }

  return (
    <PaperCard lift>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-medium text-ink text-balance">{message.title}</h3>
        {canDelete ? (
          <button onClick={handleDelete} disabled={pending} className="flex-none text-xs text-ink-faint hover:text-danger" aria-label="Hapus pesan">
            {pending ? "…" : "⋯"}
          </button>
        ) : null}
      </div>
      <AnimatePresence>
        <motion.p
          className="mt-3 whitespace-pre-line font-display text-[1.1rem] leading-[1.8] text-ink"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          {message.body}
        </motion.p>
      </AnimatePresence>
      <p className="mt-4 text-right font-hand text-lg text-accent-ink">— dari aku ♡</p>
    </PaperCard>
  );
}
