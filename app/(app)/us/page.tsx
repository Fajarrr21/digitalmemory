import { getSpaceContext } from "@/lib/auth";
import { getOurMemories } from "@/lib/our-memories";
import { formatDateLabel } from "@/lib/date";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { MemoryComposer } from "./memory-composer";
import { MemoryNode } from "./memory-node";

export default async function UsPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const memories = await getOurMemories(ctx.spaceId);
  const isAuthor = ctx.role === "author";

  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <Eyebrow>the beginning → today</Eyebrow>
        <h1 className="mt-3 font-display text-3xl font-medium text-ink text-balance sm:text-4xl">
          Our Little Universe
        </h1>
        <p className="mt-2 font-hand text-xl text-accent-ink">tempat kenangan kita disimpan ♡</p>
      </div>

      {memories.length === 0 ? (
        <PaperCard className="border-dashed text-center">
          <p className="font-hand text-xl text-accent-ink">the story starts here</p>
          <p className="mt-1 text-sm text-ink-soft">
            {isAuthor
              ? "Tambah kenangan pertama kalian di bawah — momen yang pengen kamu simpan buat dia."
              : "Belum ada kenangan yang ditulis. Sebentar lagi ada, ya. ♡"}
          </p>
        </PaperCard>
      ) : (
        <ol className="relative ml-2 flex flex-col gap-10 border-l-2 border-rule pl-7">
          <li className="relative">
            <Dot />
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-faint">the beginning</p>
          </li>

          {memories.map((m) => (
            <li key={m.id} className="relative">
              <Dot filled={m.is_featured} />
              <MemoryNode
                id={m.id}
                title={m.title}
                description={m.description}
                dateLabel={m.memory_date ? formatDateLabel(m.memory_date) : null}
                media={m.media}
                canDelete={isAuthor}
              />
            </li>
          ))}

          <li className="relative">
            <Dot />
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-faint">today, and onward</p>
          </li>
        </ol>
      )}

      {isAuthor ? (
        <div className="border-t border-rule-soft pt-6">
          <MemoryComposer spaceId={ctx.spaceId} ownerId={ctx.userId} />
        </div>
      ) : null}
    </div>
  );
}

/** The node marker sitting on the trail line. */
function Dot({ filled = false }: { filled?: boolean }) {
  return (
    <span
      className={`absolute -left-[35px] top-1 h-3.5 w-3.5 rounded-full border-2 border-accent ${
        filled ? "bg-accent" : "bg-ground"
      }`}
      aria-hidden
    />
  );
}
