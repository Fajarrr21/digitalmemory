import Link from "next/link";
import { getSpaceContext } from "@/lib/auth";
import { isAvailable } from "@/lib/adore/logic";
import { getAdore } from "@/lib/adore/queries";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { KINDS, categoryLabel, itemHref } from "../adore-config";

/** Everything she starred, in one place. Read-only; un-star from the note itself. */
export default async function AdoreFavorites() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  const rows = ((await getAdore(ctx.spaceId)) ?? []).filter((r) => r.favorite && isAvailable(r)).reverse();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>the way i adore you. ♡</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink text-balance">Yang ingin kubaca lagi.</h1>
        {ctx.role === "author" ? <p className="mt-1 text-ink-soft">Yang dia simpan. ♡</p> : null}
      </div>
      {rows.length === 0 ? (
        <PaperCard className="border-dashed text-center">
          <p className="font-hand text-xl text-accent-ink">belum ada yang disimpan</p>
          <p className="mt-1 text-sm text-ink-soft">Tekan ☆ simpan di catatan mana pun. ♡</p>
        </PaperCard>
      ) : (
        rows.map((r) => (
          <PaperCard key={r.id} lift>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-ink">
              <Link href={itemHref(r.content_type, r.id)} className="hover:underline">
                {KINDS[r.content_type].label}
              </Link>
              {categoryLabel(r.content_type, r.category) ? ` · ${categoryLabel(r.content_type, r.category)}` : ""}
            </p>
            <h2 className="mt-2 font-display text-xl font-medium text-ink text-balance">{r.title}</h2>
            {r.body ? <p className="mt-3 whitespace-pre-line font-display leading-[1.8] text-ink">{r.body}</p> : null}
          </PaperCard>
        ))
      )}
      <Link href="/adore" className="self-center text-xs text-ink-faint hover:text-ink">← the way i adore you</Link>
    </div>
  );
}
