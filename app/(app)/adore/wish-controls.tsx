"use client";

import { useState, useTransition } from "react";
import type { AdoreType, WishState } from "@/lib/supabase/database.types";
import { WISH_STATES } from "./adore-config";
import { setWish } from "./actions";

/**
 * A Future With You: move a wish along (someday → planned → in progress →
 * fulfilled). In Another Universe: only "it came true". Either of us may do
 * it, and add the story of how it happened.
 */
export function WishControls({
  id,
  kind,
  state,
  note,
  onChange,
}: {
  id: string;
  kind: AdoreType;
  state: WishState | null;
  note: string | null;
  onChange: (state: WishState, note: string | null) => void;
}) {
  const [draft, setDraft] = useState(note ?? "");
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const states = kind === "future_wish" ? WISH_STATES : WISH_STATES.filter((s) => s.key === "fulfilled" || s.key === "someday");

  function save(next: WishState) {
    start(async () => {
      const res = await setWish(id, next, draft);
      setFailed(!res.ok);
      if (res.ok) onChange(next, draft.trim() || note);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-rule-soft p-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
        {states.map((s) => (
          <button
            key={s.key}
            type="button"
            disabled={pending}
            onClick={() => save(s.key)}
            aria-pressed={(state ?? "someday") === s.key}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              (state ?? "someday") === s.key ? "border-accent-ink/50 bg-blush/50 text-ink" : "border-rule text-ink-soft hover:border-accent-ink/30"
            }`}
          >
            {kind === "another_universe" && s.key === "someday" ? "Belum" : s.label}
          </button>
        ))}
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={2000}
        rows={2}
        placeholder="Kalau sudah terwujud — ceritanya gimana? ♡"
        className="w-full resize-y rounded-xl border border-rule bg-ground px-3 py-2 text-sm text-ink outline-none focus:border-accent-ink/50"
      />
      {failed ? <p role="alert" className="text-sm text-danger">Gagal menyimpan. Coba lagi ya.</p> : null}
      <p className="text-xs text-ink-faint">Pilih status untuk menyimpan ceritanya juga.</p>
    </div>
  );
}
