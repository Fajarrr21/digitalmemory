"use client";

import { useActionState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { saveReflection, type ReflectionState } from "./actions";
import { REFLECTION_QUESTIONS, CLOSING_MESSAGE, type ReflectionKey } from "./questions";

export type ReflectionValues = Partial<Record<ReflectionKey, string | null>>;

const fieldClass =
  "w-full rounded-xl border border-rule bg-ground px-3.5 py-2.5 text-ink placeholder:text-ink-faint outline-none transition focus:border-accent-ink/50 resize-y leading-relaxed";

export function ReflectionForm({ existing }: { existing: ReflectionValues }) {
  const reduce = useReducedMotion();
  const [state, action, pending] = useActionState<ReflectionState, FormData>(saveReflection, {});

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-5">
        {REFLECTION_QUESTIONS.map(({ key, label }) => (
          <div key={key} className="flex flex-col gap-1.5">
            <label htmlFor={key} className="font-display text-[1.05rem] text-ink">
              {label}
            </label>
            <textarea
              id={key}
              name={key}
              rows={2}
              defaultValue={existing[key] ?? ""}
              className={fieldClass}
              placeholder="…"
            />
          </div>
        ))}

        {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}

        <Button type="submit" size="lg" disabled={pending} className="self-start">
          {pending ? "Menyimpan…" : "Selesai untuk hari ini"}
        </Button>
      </form>

      <AnimatePresence>
        {state.ok ? (
          <motion.div
            className="rounded-2xl border border-accent/40 bg-blush/40 px-6 py-6 text-center"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="font-display text-xl leading-relaxed text-ink text-balance">
              {CLOSING_MESSAGE}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
