import { getSpaceContext, getPartner } from "@/lib/auth";
import { resolveDailyLetter } from "@/lib/letters";
import { createClient } from "@/lib/supabase/server";
import { formatDateLabel, localDateISO } from "@/lib/date";
import { PaperCard } from "@/components/ui/paper-card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { LetterExperience } from "./letter-experience";
import { AddLetterForm } from "./add-letter-form";
import { LetterComposer } from "./letter-composer";
import { DirectLettersInbox, type InboxLetter } from "./direct-letters-inbox";

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

      <DirectLetters />

      {ctx.role === "author" ? <AuthorPanel /> : null}
    </div>
  );
}

/** Letters written on the spot between the two members: a received inbox (sealed
 *  until opened) and a compose box. Available in both directions, so the keeper
 *  can write to the author too. */
async function DirectLetters() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const partner = await getPartner(ctx.spaceId, ctx.userId);
  if (!partner) return null;

  const supabase = await createClient();
  const { data: received } = await supabase
    .from("direct_letters")
    .select("id, title, body, status, created_at, song_track_id, song_title, batch_id, sort_index")
    .eq("recipient_id", ctx.userId)
    .order("created_at", { ascending: false })
    .order("sort_index", { ascending: true });

  type Row = NonNullable<typeof received>[number];

  // Group the letters of each sequence so we can gate them: a letter stays
  // locked until the one before it (lower sort_index) has been opened.
  const byBatch = new Map<string, Row[]>();
  for (const r of received ?? []) {
    if (!r.batch_id) continue;
    const arr = byBatch.get(r.batch_id) ?? [];
    arr.push(r);
    byBatch.set(r.batch_id, arr);
  }
  for (const arr of byBatch.values()) arr.sort((a, b) => a.sort_index - b.sort_index);

  function gating(r: Row): { locked: boolean; pos: number | null; total: number | null } {
    if (!r.batch_id) return { locked: false, pos: null, total: null };
    const group = byBatch.get(r.batch_id)!;
    const idx = group.findIndex((g) => g.id === r.id);
    const prevOpened = idx <= 0 || group[idx - 1].status === "opened";
    return { locked: !prevOpened, pos: idx + 1, total: group.length };
  }

  const letters: InboxLetter[] = (received ?? []).map((l) => {
    const g = gating(l);
    return {
      id: l.id,
      title: l.title,
      body: l.body,
      status: l.status,
      dateLabel: formatDateLabel(localDateISO(ctx.profile.timezone, new Date(l.created_at))),
      songTrackId: l.song_track_id,
      songTitle: l.song_title,
      locked: g.locked,
      seqPosition: g.pos,
      seqTotal: g.total,
    };
  });

  const unopened = letters.filter((l) => l.status === "sealed").length;

  return (
    <>
      {letters.length > 0 ? (
        <section className="border-t border-rule-soft pt-7">
          <div className="flex items-center justify-between gap-4">
            <Eyebrow>surat dari {partner.name}</Eyebrow>
            {unopened > 0 ? (
              <span className="font-mono text-xs text-accent-ink">{unopened} belum dibuka</span>
            ) : null}
          </div>
          <h2 className="mt-2 mb-4 font-display text-xl font-medium text-ink">Kotak suratmu</h2>
          <DirectLettersInbox letters={letters} senderName={partner.name} />
        </section>
      ) : null}

      <section className="border-t border-rule-soft pt-7">
        <Eyebrow>kirim surat</Eyebrow>
        <h2 className="mt-2 font-display text-xl font-medium text-ink">
          Tulis surat untuk {partner.name}
        </h2>
        <p className="mt-1 mb-4 text-sm text-ink-soft">
          Bisa lebih dari satu surat sekaligus — tambah &amp; urutkan, masing-masing boleh satu
          lagu. Kalau lebih dari satu, {partner.name} membukanya berurutan, satu per satu. ♡
        </p>
        <PaperCard>
          <LetterComposer partnerName={partner.name} />
        </PaperCard>
      </section>
    </>
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
