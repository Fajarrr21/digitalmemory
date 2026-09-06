"use client";

import { useActionState, useEffect, useRef } from "react";
import { addPoolLetter, type AddLetterState } from "./actions";
import { LETTER_CATEGORIES } from "./categories";
import { Button } from "@/components/ui/button";

const fieldClass =
  "w-full rounded-xl border border-rule bg-ground px-3.5 py-2.5 text-ink placeholder:text-ink-faint outline-none transition focus:border-accent-ink/50";

export function AddLetterForm() {
  const [state, action, pending] = useActionState<AddLetterState, FormData>(
    addPoolLetter,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="category" className="text-sm text-ink-soft">
          Jenis surat
        </label>
        <select id="category" name="category" className={fieldClass} defaultValue="random_love">
          {LETTER_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm text-ink-soft">
          Judul <span className="text-ink-faint">(opsional)</span>
        </label>
        <input id="title" name="title" className={fieldClass} placeholder="—" maxLength={120} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="body" className="text-sm text-ink-soft">
          Isi surat
        </label>
        <textarea
          id="body"
          name="body"
          rows={5}
          required
          className={`${fieldClass} resize-y leading-relaxed`}
          placeholder="Tulis dengan suaramu sendiri — bukan template. Dia akan tahu bedanya. ♡"
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-accent-ink">Tersimpan. Satu surat lagi menunggu untuk hari nanti. ♡</p>
      ) : null}

      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Menyimpan…" : "Simpan ke pool"}
      </Button>
    </form>
  );
}
