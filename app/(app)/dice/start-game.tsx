"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MODES, type DiceMode } from "@/lib/dice/config";
import { createDiceGame } from "./actions";

/** Game Setup: pick the mood, then open the lobby. */
export function StartGame() {
  const router = useRouter();
  const [mode, setMode] = useState<DiceMode>("soft");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <p className="text-sm text-ink-soft">Malam ini mau yang seperti apa?</p>
      <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Mode permainan">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={mode === m.key}
            onClick={() => setMode(m.key)}
            className={cn(
              "rounded-2xl border px-4 py-3 text-left transition active:scale-[0.98]",
              mode === m.key ? "border-accent-ink bg-blush/40" : "border-rule hover:border-accent-ink/40",
            )}
          >
            <span className="text-lg">{m.emoji}</span>
            <span className="mt-1 block font-display text-base text-ink">{m.label}</span>
            <span className="block text-xs text-ink-faint">{m.hint}</span>
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-accent-ink">{error}</p>}
      <Button
        className="mt-5"
        size="lg"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await createDiceGame(mode);
            if (r.id) router.push(`/dice/${r.id}`);
            else setError(r.error ?? "Gagal memulai.");
          })
        }
      >
        Buka meja permainan 🎲
      </Button>
    </div>
  );
}
