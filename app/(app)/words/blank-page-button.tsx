"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWork } from "./actions";

/** "or start with a blank page" — a new empty draft, straight into the editor. */
export function BlankPageButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await createWork({ content: "", work_type: "poetry", origin: "manual" });
            if (res.error || !res.id) setError(res.error ?? "Gagal membuat halaman.");
            else router.push(`/words/w/${res.id}`);
          })
        }
        className="text-sm text-ink-soft underline decoration-rule underline-offset-4 hover:text-accent-ink disabled:opacity-50"
      >
        {pending ? "menyiapkan halaman…" : "atau mulai dari halaman kosong"}
      </button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </>
  );
}
