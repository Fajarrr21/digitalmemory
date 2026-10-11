import type { Metadata } from "next";
import Link from "next/link";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { getPastHolds } from "@/lib/hold/queries";
import { objectFor } from "@/lib/hold/logic";
import { formatInstant } from "@/lib/date";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { ACTIONS, OBJECT_COPY, STATUS_LABEL } from "../hold-config";
import { PastActions } from "./past-actions";

export const metadata: Metadata = { title: "Past Holds" };

const OBJECT_GLYPH = { cloud: "☁️", star: "✦", heart: "♡", moon: "☾" } as const;

/**
 * Past Holds — only what was chosen to be kept. Deliberately compact: a date,
 * the object, the gesture, the status. Not a diary, not a second timeline,
 * and never a count of who showed up how fast.
 */
export default async function PastHoldsPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const [past, partner] = await Promise.all([
    getPastHolds(ctx.spaceId),
    getPartner(ctx.spaceId, ctx.userId),
  ]);
  const them = partner?.name ?? "Dia";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/hold" className="text-sm text-ink-faint hover:text-ink-soft">
          ← Hold
        </Link>
        <Eyebrow className="mt-4">past holds</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink text-balance">
          Ruang-ruang yang kalian simpan
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Yang tidak disimpan akan dilupakan sendiri — kata-katanya langsung dihapus saat ruangnya
          selesai, dan sisanya hilang dalam 7 hari. Hanya yang membuka sebuah ruang yang bisa
          melepaskan atau menghapusnya; menghapus berarti hilang untuk kalian berdua.
        </p>
      </div>

      {past.length === 0 ? (
        <PaperCard className="border-dashed text-center">
          <p className="font-display text-lg text-ink">Belum ada yang disimpan.</p>
          <p className="mt-1 text-sm text-ink-soft">Dan itu juga nggak apa-apa. ♡</p>
        </PaperCard>
      ) : (
        <ul className="flex flex-col gap-3">
          {past.map((s) => {
            const object = objectFor(s.feeling);
            const mine = s.sender_id === ctx.userId;
            const gestures = s.actions.filter(Boolean).map((a) => ACTIONS[a!].label);
            return (
              <li key={s.id}>
                <PaperCard className="flex flex-col gap-3 py-5">
                  <Link href={`/hold/${s.id}`} className="group flex items-start gap-4">
                    <span
                      aria-hidden
                      className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#3a2436] text-lg text-[#f4c7cf]"
                    >
                      {OBJECT_GLYPH[object]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[11px] text-ink-faint">
                        {formatInstant(s.created_at, ctx.profile.timezone)} ·{" "}
                        {mine ? "ruangmu" : `ruang ${them}`}
                      </span>
                      <span className="mt-0.5 block font-display text-lg text-ink group-hover:text-accent-ink">
                        {OBJECT_COPY[object].name}
                      </span>
                      <span className="mt-0.5 block text-sm text-ink-soft">
                        {gestures.length ? gestures.join(" · ") : "Tanpa gestur"} ·{" "}
                        {STATUS_LABEL[s.status]}
                      </span>
                    </span>
                  </Link>
                  {mine ? <PastActions id={s.id} partnerName={them} /> : null}
                </PaperCard>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
