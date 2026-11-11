"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { replyAdore } from "./actions";

/** Her one reply to an item — she can rewrite or clear it. He only reads it. */
export function ReplyBox({
  id,
  reply,
  canWrite,
  onSaved,
}: {
  id: string;
  reply: string | null;
  canWrite: boolean;
  onSaved: (reply: string | null) => void;
}) {
  const [draft, setDraft] = useState(reply ?? "");
  const [editing, setEditing] = useState(!reply);
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);

  if (!canWrite) {
    return (
      <div className="rounded-2xl border border-rule-soft p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">balasannya</p>
        <p className="mt-1 whitespace-pre-line font-hand text-xl leading-snug text-accent-ink">“{reply}”</p>
      </div>
    );
  }

  if (!editing && reply) {
    return (
      <div className="rounded-2xl border border-rule-soft p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">balasanmu</p>
        <p className="mt-1 whitespace-pre-line font-hand text-xl leading-snug text-accent-ink">“{reply}”</p>
        <button type="button" onClick={() => setEditing(true)} className="mt-2 text-xs text-ink-soft hover:text-ink">
          ubah
        </button>
      </div>
    );
  }

  function save(text: string) {
    start(async () => {
      const res = await replyAdore(id, text);
      setFailed(!res.ok);
      if (!res.ok) return;
      const next = text.trim() || null;
      onSaved(next);
      setEditing(!next);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-rule-soft p-4">
      <label htmlFor={`reply-${id}`} className="text-sm text-ink-soft">
        Mau balas? <span className="text-xs text-ink-faint">(opsional — cuma dia yang baca)</span>
      </label>
      <textarea
        id={`reply-${id}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={2000}
        rows={3}
        className="w-full resize-y rounded-xl border border-rule bg-ground px-3 py-2 text-ink outline-none focus:border-accent-ink/50"
      />
      {failed ? <p role="alert" className="text-sm text-danger">Gagal mengirim. Coba lagi ya.</p> : null}
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" disabled={pending || !draft.trim()} onClick={() => save(draft)}>
          {pending ? "…" : "Kirim ♡"}
        </Button>
        {reply ? (
          <button type="button" disabled={pending} onClick={() => save("")} className="text-xs text-ink-faint hover:text-danger">
            hapus balasan
          </button>
        ) : null}
      </div>
    </div>
  );
}
