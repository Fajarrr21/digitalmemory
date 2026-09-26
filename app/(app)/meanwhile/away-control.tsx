"use client";

import { useActionState } from "react";
import { cn } from "@/lib/utils";
import type { AwayKind } from "@/lib/supabase/database.types";
import { AWAY_KINDS } from "./meanwhile-config";
import { setAwayStatus, type AwayState } from "./actions";

/**
 * The manual "I'm away" toggle. Pick a kind to turn it on; pick it again (or
 * "aku balik") to turn it off. Just context for the partner — never tracking.
 */
export function AwayControl({
  current,
}: {
  current: { kind: AwayKind; active: boolean } | null;
}) {
  const [state, act, pending] = useActionState<AwayState, FormData>(setAwayStatus, {});
  const activeKind = current?.active ? current.kind : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {AWAY_KINDS.map((k) => {
          const isActive = activeKind === k.kind;
          return (
            <form key={k.kind} action={act}>
              <input type="hidden" name="kind" value={isActive ? "off" : k.kind} />
              <button
                type="submit"
                disabled={pending}
                aria-pressed={isActive}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition disabled:opacity-50",
                  isActive
                    ? "border-accent-ink bg-blush/40 text-accent-ink"
                    : "border-rule bg-paper text-ink-soft hover:border-accent-ink/40",
                )}
              >
                <span aria-hidden>{k.emoji}</span>
                {k.label}
              </button>
            </form>
          );
        })}
      </div>
      {activeKind ? (
        <form action={act}>
          <input type="hidden" name="kind" value="off" />
          <button
            type="submit"
            disabled={pending}
            className="text-sm text-accent-ink hover:underline disabled:opacity-50"
          >
            ✓ aku balik
          </button>
        </form>
      ) : (
        <p className="text-xs text-ink-faint">
          Nyalakan biar dia tahu kamu lagi sibuk — bukan menghilang.
        </p>
      )}
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
