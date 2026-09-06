import { getSpaceContext } from "@/lib/auth";
import { resolveDailyLetter } from "@/lib/letters";
import { createClient } from "@/lib/supabase/server";
import { formatDateLabel } from "@/lib/date";
import { PaperCard } from "@/components/ui/paper-card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { LetterExperience } from "./letter-experience";
import { AddLetterForm } from "./add-letter-form";

export default async function LetterPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const resolved = await resolveDailyLetter(ctx.spaceId, ctx.userId);

  if (!resolved) {
    return (
      <PaperCard className="border-dashed text-center">
        <p className="font-hand text-xl text-accent-ink">belum ada penerima</p>
        <p className="mt-1 text-sm text-ink-soft">
          Surat harian muncul begitu akun untuk dia sudah terhubung ke space ini.
        </p>
      </PaperCard>
    );
  }

  const { letter, isRecipient } = resolved;

  return (
    <div className="flex flex-col gap-8">
      <LetterExperience
        letterId={letter.id}
        category={letter.category}
        title={letter.title}
        body={letter.body}
        status={letter.status}
        isRecipient={isRecipient}
        dateLabel={formatDateLabel(letter.letter_date)}
      />

      {ctx.role === "author" ? <AuthorPanel /> : null}
    </div>
  );
}

async function AuthorPanel() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const [{ count: total }, { count: ready }] = await Promise.all([
    supabase.from("letter_pool").select("*", { count: "exact", head: true }),
    supabase
      .from("letter_pool")
      .select("*", { count: "exact", head: true })
      .is("used_on", null),
  ]);

  const readyCount = ready ?? 0;

  return (
    <section className="border-t border-rule-soft pt-7">
      <div className="flex items-center justify-between gap-4">
        <Eyebrow>ruang penulis</Eyebrow>
        <span className="font-mono text-xs text-ink-faint">
          {readyCount} siap · {(total ?? 0) - readyCount} terkirim
        </span>
      </div>
      <h2 className="mt-2 font-display text-xl font-medium text-ink">Tulis surat berikutnya</h2>
      <p className="mt-1 mb-4 text-sm text-ink-soft">
        Setiap surat cuma dipakai sekali. Isi pool-nya pelan-pelan biar dia selalu punya
        sesuatu untuk dibuka.
      </p>

      {readyCount <= 1 ? (
        <p className="mb-4 rounded-xl bg-note-bg px-4 py-3 text-sm text-note-ink">
          Tinggal {readyCount} surat yang belum terpakai. Tambah beberapa lagi ya. ♡
        </p>
      ) : null}

      <PaperCard>
        <AddLetterForm />
      </PaperCard>
    </section>
  );
}
