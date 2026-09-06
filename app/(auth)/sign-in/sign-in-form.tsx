"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { signIn, type SignInState } from "./actions";

const fieldClass =
  "w-full rounded-xl border border-rule bg-ground px-4 py-3 text-ink placeholder:text-ink-faint outline-none transition focus:border-accent-ink/50";

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(
    signIn,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-soft">Email</span>
        <input
          className={fieldClass}
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="you@little.place"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-soft">Password</span>
        <input
          className={fieldClass}
          type="password"
          name="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="mt-2 w-full">
        {pending ? "One moment…" : "Come in ♡"}
      </Button>
    </form>
  );
}
