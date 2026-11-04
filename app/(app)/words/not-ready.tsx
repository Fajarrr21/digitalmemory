import { PaperCard } from "@/components/ui/paper-card";

export function NotReady() {
  return (
    <PaperCard className="border-dashed">
      <p className="font-display text-lg text-ink">Ruang menulisnya sedang disiapkan.</p>
      <p className="mt-1 text-sm text-ink-soft">
        Jalankan{" "}
        <code className="rounded bg-paper-2 px-1 font-mono text-xs">supabase/migrations/0022_little_words.sql</code> di SQL editor
        Supabase, lalu buka lagi halaman ini. ♡
      </p>
    </PaperCard>
  );
}
