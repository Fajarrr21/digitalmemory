"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TONES, type QuizTone } from "@/lib/quiz/config";
import { createGame } from "./actions";

export function StartGame() {
  const router = useRouter();
  const [tone, setTone] = useState<QuizTone>("playful");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <p className="text-sm text-ink-soft">Gaya pesan saat benar / salah:</p>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Gaya pesan">
        {TONES.map((t) => (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={tone === t.key}
            onClick={() => setTone(t.key)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition",
              tone === t.key ? "border-accent-ink bg-blush/40 text-ink" : "border-rule text-ink-soft",
            )}
          >
            {t.label} <span className="text-ink-faint">· {t.hint}</span>
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-accent-ink">{error}</p>}
      <Button
        className="mt-4"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await createGame(tone);
            if (r.id) router.push(`/quiz/${r.id}`);
            else setError(r.error ?? "Gagal memulai.");
          })
        }
      >
        Mulai permainan ❤️
      </Button>
    </div>
  );
}
