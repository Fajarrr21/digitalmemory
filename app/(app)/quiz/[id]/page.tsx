import type { Metadata } from "next";
import Link from "next/link";
import { PaperCard } from "@/components/ui/paper-card";
import { getQuizState } from "../actions";
import { QuizGame } from "../quiz-game";

export const metadata: Metadata = { title: "Seberapa Kenal Kita?" };

export default async function QuizGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await getQuizState(id);
  if (!res.view) {
    return (
      <PaperCard className="text-center">
        <p className="font-display text-xl text-ink">Permainan ini tidak ditemukan.</p>
        <Link href="/quiz" className="mt-3 inline-block text-sm text-accent-ink hover:underline">← Kembali</Link>
      </PaperCard>
    );
  }
  return <QuizGame initial={res.view} />;
}
