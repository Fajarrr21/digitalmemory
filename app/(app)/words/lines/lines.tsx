"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { BackLink } from "@/components/words/back-link";
import { inputClass } from "@/components/words/chips";
import { normalize } from "@/lib/words/logic";
import type { Line } from "@/lib/words/queries";
import { cn } from "@/lib/utils";
import { deleteLine } from "../actions";

/** Lines I Love — single lines kept from any work, searchable, card-able. */
export function Lines({ lines }: { lines: Line[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pending, start] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);

  const shown = useMemo(() => {
    const terms = normalize(query).split(" ").filter(Boolean);
    if (!terms.length) return lines;
    return lines.filter((l) => {
      const hay = normalize(`${l.text} ${l.source_title ?? ""}`);
      return terms.every((t) => hay.includes(t));
    });
  }, [lines, query]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink />
        <Eyebrow className="mt-4">Lines I Love</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink text-balance">The lines you couldn&apos;t let go.</h1>
        <p className="mt-2 text-ink-soft">Blok satu kalimat di karya mana pun — milikmu atau yang diberikan untukmu — lalu simpan di sini.</p>
      </div>

      {lines.length ? (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari kata…"
          className={cn(inputClass, "py-2.5 text-sm")}
          aria-label="Cari baris"
        />
      ) : null}

      {shown.length ? (
        <ul className="columns-1 gap-3 sm:columns-2 [&>li]:mb-3">
          {shown.map((l) => (
            <li key={l.id} className="break-inside-avoid">
              <PaperCard className="flex flex-col gap-3 p-5">
                <p className="whitespace-pre-line font-display text-lg italic leading-relaxed text-ink">“{l.text}”</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                  {l.work_id ? (
                    <Link href={`/words/w/${l.work_id}`} className="hover:text-accent-ink">
                      dari {l.source_title || "karyamu"} →
                    </Link>
                  ) : l.delivery_id ? (
                    <Link href={`/words/to-you/${l.delivery_id}`} className="hover:text-accent-ink">
                      dari {l.source_title || "sebuah pemberian"} →
                    </Link>
                  ) : (
                    <span>{l.source_title ? `dari ${l.source_title}` : "karya aslinya sudah tidak ada"}</span>
                  )}
                  <span>{format(new Date(l.created_at), "d MMM yyyy", { locale: localeId })}</span>
                  <span className="ml-auto flex gap-3">
                    <Link href={`/words/canvas?line=${l.id}`} className="text-ink-soft hover:text-accent-ink">
                      🎨 kartu
                    </Link>
                    {removing === l.id ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            await deleteLine(l.id);
                            setRemoving(null);
                            router.refresh();
                          })
                        }
                        className="text-danger"
                      >
                        hapus?
                      </button>
                    ) : (
                      <button type="button" onClick={() => setRemoving(l.id)} className="hover:text-danger" aria-label="Hapus baris">
                        ✕
                      </button>
                    )}
                  </span>
                </div>
              </PaperCard>
            </li>
          ))}
        </ul>
      ) : (
        <PaperCard className="border-dashed text-center">
          <p className="font-hand text-2xl text-accent-ink">{lines.length ? "no line matches" : "no lines yet"}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {lines.length ? "Coba kata lain." : "Buka sebuah karya, blok kalimat yang kamu suka, lalu tekan “♡ Simpan baris”."}
          </p>
        </PaperCard>
      )}
    </div>
  );
}
