import { PaperCard } from "@/components/ui/paper-card";
import { Eyebrow } from "@/components/ui/eyebrow";

export function ComingSoon({
  eyebrow,
  title,
  note,
}: {
  eyebrow: string;
  title: string;
  note: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink text-balance">
          {title}
        </h1>
      </div>
      <PaperCard className="border-dashed text-center">
        <p className="font-hand text-xl text-accent-ink">coming very soon</p>
        <p className="mt-1 text-sm text-ink-soft">{note}</p>
      </PaperCard>
    </div>
  );
}
