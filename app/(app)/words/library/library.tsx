"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { BackLink } from "@/components/words/back-link";
import { inputClass } from "@/components/words/chips";
import {
  LIBRARY_CATEGORIES,
  excerpt,
  fallbackTitle,
  filterLibrary,
  type LibraryCategory,
  type LibraryItem,
  type LibrarySort,
} from "@/lib/words/logic";
import { GENRES, WORK_TYPES, labelOf, workTypeOf } from "@/lib/words/options";
import type { WorkType } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

/**
 * The Library — every work I wrote, plus everything given to me. Search and
 * filtering run in the browser over the whole (small) collection, so it's
 * instant and works the same offline-ish.
 */
export function Library({
  items,
  partnerName,
  initialCategory,
}: {
  items: LibraryItem[];
  partnerName: string;
  initialCategory: string | null;
}) {
  const [category, setCategory] = useState<LibraryCategory>(
    LIBRARY_CATEGORIES.some((c) => c.key === initialCategory) ? (initialCategory as LibraryCategory) : "all",
  );
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<string>("");
  const [workType, setWorkType] = useState<string>("");
  const [author, setAuthor] = useState<"" | "me" | "partner">("");
  const [month, setMonth] = useState("");
  const [sort, setSort] = useState<LibrarySort>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Remember the last category for this device.
  useEffect(() => {
    if (initialCategory) return;
    try {
      const c = localStorage.getItem("words:library:category") as LibraryCategory | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore of a per-device preference
      if (c && LIBRARY_CATEGORIES.some((x) => x.key === c)) setCategory(c);
    } catch {}
  }, [initialCategory]);
  useEffect(() => {
    try {
      localStorage.setItem("words:library:category", category);
    } catch {}
  }, [category]);

  const shown = useMemo(
    () =>
      filterLibrary(items, {
        category,
        query,
        genre: genre || null,
        workType: (workType || null) as WorkType | null,
        author: author || null,
        month: month || null,
        sort,
      }),
    [items, category, query, genre, workType, author, month, sort],
  );
  const counts = useMemo(() => {
    const out: Partial<Record<LibraryCategory, number>> = {};
    for (const c of LIBRARY_CATEGORIES) out[c.key] = filterLibrary(items, { category: c.key }).length;
    return out;
  }, [items]);
  const months = useMemo(() => [...new Set(items.map((i) => i.date.slice(0, 7)))].sort().reverse(), [items]);
  const activeFilters = [genre, workType, author, month].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink />
        <Eyebrow className="mt-4">The Library</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink">Everything you&apos;ve written.</h1>
      </div>

      <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
        <div className="flex w-max gap-1.5" role="tablist" aria-label="Kategori">
          {LIBRARY_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={category === c.key}
              onClick={() => setCategory(c.key)}
              className={cn(
                "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition",
                category === c.key ? "border-accent-ink/50 bg-blush/60 text-ink" : "border-rule bg-paper text-ink-soft hover:text-ink",
              )}
            >
              {c.key === "for_you" ? `For You` : c.label}
              <span className="ml-1.5 font-mono text-[10px] text-ink-faint">{counts[c.key] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari judul, isi, genre, penulis…"
            className={cn(inputClass, "py-2.5 text-sm")}
            aria-label="Cari karya"
          />
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className="flex-none rounded-xl border border-rule bg-paper px-3 text-sm text-ink-soft"
          >
            Filter{activeFilters ? ` · ${activeFilters}` : ""}
          </button>
        </div>
        {filtersOpen ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Select label="Bentuk" value={workType} onChange={setWorkType} options={WORK_TYPES.map((w) => [w.key, w.label])} />
            <Select label="Genre" value={genre} onChange={setGenre} options={GENRES.map((g) => [g.key, g.label])} />
            <Select
              label="Penulis"
              value={author}
              onChange={(v) => setAuthor(v as "" | "me" | "partner")}
              options={[
                ["me", "Aku"],
                ["partner", partnerName],
              ]}
            />
            <Select
              label="Bulan"
              value={month}
              onChange={setMonth}
              options={months.map((m) => [m, format(new Date(`${m}-01T12:00:00`), "MMMM yyyy", { locale: localeId })])}
            />
            <Select
              label="Urutkan"
              value={sort}
              onChange={(v) => setSort((v || "newest") as LibrarySort)}
              options={[
                ["newest", "Terbaru"],
                ["oldest", "Terlama"],
                ["favorites", "Favorit dulu"],
              ]}
              noAll
            />
          </div>
        ) : null}
      </div>

      {shown.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {shown.map((it) => (
            <li key={`${it.source}-${it.id}`}>
              <Link href={it.href} className="group block h-full">
                <PaperCard className="flex h-full flex-col gap-2 p-5 transition group-hover:-translate-y-0.5">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                    <span>
                      {workTypeOf(it.work_type).emoji} {workTypeOf(it.work_type).label}
                    </span>
                    {it.status === "draft" ? <span className="rounded-full border border-rule px-1.5">draft</span> : null}
                    {it.source === "received" ? <span className="text-accent-ink">dari {it.author}</span> : null}
                    {it.sentCount ? <span className="text-accent-ink">dikirim ♡</span> : null}
                    {it.favorite ? <span className="ml-auto text-accent-ink">♥</span> : null}
                  </div>
                  <p className="font-display text-lg leading-snug text-ink">{it.title || fallbackTitle(it.content)}</p>
                  <p className="line-clamp-3 font-display text-sm italic text-ink-soft">{excerpt(it.content, 180) || "Halaman kosong"}</p>
                  <p className="mt-auto pt-1 text-xs text-ink-faint">
                    {format(new Date(it.date), "d MMM yyyy", { locale: localeId })}
                    {it.genre ? ` · ${labelOf(GENRES, it.genre)}` : ""}
                  </p>
                </PaperCard>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <PaperCard className="border-dashed text-center">
          <p className="font-hand text-2xl text-accent-ink">{items.length ? "nothing here yet" : "the shelves are waiting"}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {items.length ? "Tidak ada karya yang cocok." : "Karya pertamamu akan tinggal di sini."}{" "}
            <Link href="/words/muse" className="text-accent-ink underline underline-offset-4">
              Mulai menulis →
            </Link>
          </p>
        </PaperCard>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  noAll,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  noAll?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-xl border border-rule bg-paper px-2 text-sm text-ink"
      >
        {noAll ? null : <option value="">Semua</option>}
        {options.map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
