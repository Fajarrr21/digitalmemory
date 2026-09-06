"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { createMessage, type ForYouState } from "./actions";

const fieldClass =
  "w-full rounded-xl border border-rule bg-ground px-3.5 py-2.5 text-ink placeholder:text-ink-faint outline-none transition focus:border-accent-ink/50";

export function MessageComposer() {
  const [state, action, pending] = useActionState<ForYouState, FormData>(createMessage, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3 rounded-2xl border border-rule bg-paper p-5">
      <p className="font-display text-lg font-medium text-ink">Titipkan pesan untuk dia</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="fy-title" className="text-sm text-ink-soft">Judul</label>
        <input id="fy-title" name="title" className={fieldClass} placeholder="Misal: buat kamu yang lagi ragu" maxLength={160} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="fy-body" className="text-sm text-ink-soft">Pesan</label>
        <textarea id="fy-body" name="body" rows={5} required className={`${fieldClass} resize-y leading-relaxed`} placeholder="Tulis apa yang pengen dia baca kapan pun dia butuh. ♡" />
      </div>
      {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-accent-ink">Tersimpan. Menunggu dia menemukannya. ♡</p> : null}
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Menyimpan…" : "Simpan pesan"}
      </Button>
    </form>
  );
}
