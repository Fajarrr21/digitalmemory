"use client";

import { useTransition } from "react";
import { dismissNudge } from "../tasks/actions";
import { dismissMoonReminder } from "../moon/actions";

/** "Okay, I've seen it" — clears one nudge without touching the task itself. */
export function DismissNudge({ reminderId }: { reminderId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => void dismissNudge(reminderId))}
      className="flex-none rounded-full border border-rule-soft px-3 py-1 text-xs text-ink-faint transition hover:border-accent-ink/40 hover:text-accent-ink disabled:opacity-50"
    >
      oke ♡
    </button>
  );
}

/** "oke ♡" for one of her own her-little-moon reminders — for today only. */
export function DismissMoonReminder({ reminderId }: { reminderId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => void dismissMoonReminder(reminderId))}
      className="flex-none rounded-full border border-rule-soft px-3 py-1 text-xs text-ink-faint transition hover:border-accent-ink/40 hover:text-accent-ink disabled:opacity-50"
    >
      oke ♡
    </button>
  );
}
