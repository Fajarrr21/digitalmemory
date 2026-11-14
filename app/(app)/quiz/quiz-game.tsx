"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { cn } from "@/lib/utils";
import { QUESTIONS, QUIZ_SIZE } from "@/lib/quiz/config";
import { feedbackFor, scoreOf, winnerOf, type SheetItem } from "@/lib/quiz/logic";
import {
  answerRound,
  cancelGame,
  getQuizState,
  lockSheet,
  saveSheet,
  suggestDecoys,
  type QuizView,
  type RevealedRound,
} from "./actions";

const POLL_MS = 2500;
const LETTERS = ["A", "B", "C", "D"];
const pad = (n: number) => String(n).padStart(2, "0");
const guessText = (idx: number, name: string) => QUESTIONS[idx].guess.replace("{n}", name);

export function QuizGame({ initial }: { initial: QuizView }) {
  const [view, setView] = useState(initial);
  // Rounds whose reveal I've already seen; on a reload we skip straight to now.
  const [ack, setAck] = useState(initial.round);

  const refresh = useCallback(async () => {
    const res = await getQuizState(view.id);
    if (res.view) setView(res.view);
  }, [view.id]);

  const waiting =
    (view.status === "preparing" && view.myLocked) ||
    (view.status === "playing" && view.current?.myChoice != null);
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [waiting, refresh]);

  if (view.status === "cancelled") {
    return (
      <PaperCard className="text-center">
        <p className="font-display text-xl text-ink">Permainan ini dibatalkan.</p>
        <Link href="/quiz" className="mt-3 inline-block text-sm text-accent-ink hover:underline">← Kembali</Link>
      </PaperCard>
    );
  }

  if (view.status === "preparing") {
    return view.myLocked ? (
      <PaperCard className="text-center">
        <Eyebrow>persiapan</Eyebrow>
        <p className="mt-3 font-display text-xl text-ink">Jawabanmu sudah dikunci ♡</p>
        <p className="mt-2 text-sm text-ink-soft">
          {view.partnerLocked ? "Menyiapkan permainan…" : `Menunggu ${view.partnerName} selesai mengisi…`}
        </p>
        <CancelLink id={view.id} />
      </PaperCard>
    ) : (
      <Prep view={view} onLocked={setView} />
    );
  }

  const pending = view.revealed.find((r) => r.idx === ack);
  if (pending) {
    return <Reveal view={view} r={pending} onNext={() => setAck((a) => a + 1)} />;
  }
  if (view.status === "completed") return <Result view={view} />;
  if (view.current) return <Play key={view.current.idx} view={view} onAnswered={setView} />;
  return null;
}

function CancelLink({ id }: { id: string }) {
  const router = useRouter();
  const [sure, setSure] = useState(false);
  return (
    <button
      type="button"
      className="mt-5 text-xs text-ink-faint hover:text-accent-ink"
      onClick={async () => {
        if (!sure) return setSure(true);
        await cancelGame(id);
        router.push("/quiz");
      }}
    >
      {sure ? "Yakin batalkan? Tap sekali lagi." : "Batalkan permainan"}
    </button>
  );
}

/* ------------------------------------------------------------ prep -- */

const blank = (): SheetItem[] => QUESTIONS.map(() => ({ a: "", d: ["", "", ""] }));

function Prep({ view, onLocked }: { view: QuizView; onLocked: (v: QuizView) => void }) {
  const draftKey = `quiz:draft:${view.id}`;
  const [items, setItems] = useState<SheetItem[]>(() => {
    try {
      const d = localStorage.getItem(draftKey);
      if (d) return JSON.parse(d);
    } catch {}
    return view.mySheet.length === QUIZ_SIZE ? view.mySheet : blank();
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | "all" | null>(null);
  const [pending, start] = useTransition();
  const [confirmLock, setConfirmLock] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(items));
    } catch {}
  }, [items, draftKey]);

  const set = (i: number, patch: (it: SheetItem) => SheetItem) =>
    setItems((xs) => xs.map((it, k) => (k === i ? patch(it) : it)));

  const answered = items.filter((it) => it.a.trim()).length;
  const complete = items.filter((it) => it.a.trim() && it.d.every((d) => d.trim())).length;

  async function decoys(which: number | "all") {
    const list =
      which === "all"
        ? items.map((it, idx) => ({ idx, answer: it.a })).filter((x, idx) => x.answer.trim() && items[idx].d.some((d) => !d.trim()))
        : [{ idx: which, answer: items[which].a }];
    if (!list.length) return setMsg("Semua pengecoh sudah terisi ♡");
    setBusy(which);
    setMsg(null);
    const res = await suggestDecoys(view.id, list);
    setBusy(null);
    if (res.error) return setMsg(res.error);
    setItems((xs) =>
      xs.map((it, idx) => {
        const got = res.decoys?.[idx];
        if (!got) return it;
        // "all" only fills empty slots; the per-question ✨ redoes all three.
        let k = 0;
        const d = it.d.map((old) => (which === "all" && old.trim() ? old : (got[k++] ?? old)));
        return { ...it, d };
      }),
    );
  }

  return (
    <div className="space-y-4">
      <PaperCard>
        <Eyebrow>persiapan · tentang dirimu</Eyebrow>
        <p className="mt-2 font-display text-xl text-ink">Jawab jujur tentang dirimu sendiri.</p>
        <p className="mt-1 text-sm text-ink-soft">
          Jawabanmu jadi kunci saat {view.partnerName} menebak. Tiap jawaban butuh 3 pengecoh — tulis sendiri atau
          minta ✨ dibuatkan, lalu periksa lagi. {view.partnerName} tidak bisa melihat isianmu.
        </p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-rule">
          <div className="h-full bg-accent transition-all" style={{ width: `${(complete / QUIZ_SIZE) * 100}%` }} />
        </div>
        <p className="mt-2 font-mono text-[11px] text-ink-faint">
          {answered}/{QUIZ_SIZE} dijawab · {complete}/{QUIZ_SIZE} lengkap
        </p>
        <Button variant="soft" size="sm" className="mt-3" disabled={busy != null} onClick={() => decoys("all")}>
          {busy === "all" ? "Membuat pengecoh…" : "✨ Buatkan semua pengecoh yang kosong"}
        </Button>
      </PaperCard>

      {QUESTIONS.map((q, i) => (
        <PaperCard key={i} className="p-5">
          <p className="font-mono text-[11px] text-ink-faint">
            {pad(i + 1)} · {q.cat}
          </p>
          <label className="mt-1 block font-display text-lg text-ink" htmlFor={`qa-${i}`}>
            {q.self}
          </label>
          <input
            id={`qa-${i}`}
            value={items[i].a}
            maxLength={200}
            onChange={(e) => set(i, (it) => ({ ...it, a: e.target.value }))}
            placeholder="Jawaban aslimu"
            className="mt-2 w-full rounded-xl border border-rule bg-ground px-3 py-2 text-ink outline-none focus:border-accent-ink"
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-ink-soft">Pengecoh</p>
            <button
              type="button"
              disabled={!items[i].a.trim() || busy != null}
              onClick={() => decoys(i)}
              className="text-xs text-accent-ink disabled:opacity-40"
            >
              {busy === i ? "…" : "✨ buat ulang"}
            </button>
          </div>
          <div className="mt-1 grid gap-2 sm:grid-cols-3">
            {items[i].d.map((d, k) => (
              <input
                key={k}
                aria-label={`Pengecoh ${k + 1} untuk pertanyaan ${i + 1}`}
                value={d}
                maxLength={200}
                onChange={(e) => set(i, (it) => ({ ...it, d: it.d.map((x, j) => (j === k ? e.target.value : x)) }))}
                placeholder={`Pengecoh ${k + 1}`}
                className="w-full rounded-xl border border-rule bg-ground px-3 py-2 text-sm text-ink outline-none focus:border-accent-ink"
              />
            ))}
          </div>
        </PaperCard>
      ))}

      <PaperCard className="sticky bottom-20 z-10 flex flex-wrap items-center gap-3 p-4 lg:bottom-4">
        {msg && <p className="w-full text-sm text-accent-ink" role="status">{msg}</p>}
        <Button
          variant="soft"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveSheet(view.id, items);
              setMsg(r.error ?? "Tersimpan ♡");
            })
          }
        >
          Simpan
        </Button>
        <Button
          size="sm"
          disabled={pending || complete < QUIZ_SIZE}
          onClick={() => {
            if (!confirmLock) return setConfirmLock(true);
            start(async () => {
              const r = await lockSheet(view.id, items);
              if (r.error) return setMsg(r.error);
              try {
                localStorage.removeItem(draftKey);
              } catch {}
              if (r.view) onLocked(r.view);
            });
          }}
        >
          {confirmLock ? "Yakin? Setelah dikunci tidak bisa diubah" : "🔒 Kunci jawaban"}
        </Button>
        <CancelLink id={view.id} />
      </PaperCard>
    </div>
  );
}

/* ------------------------------------------------------------ play -- */

function Play({ view, onAnswered }: { view: QuizView; onAnswered: (v: QuizView) => void }) {
  const cur = view.current!;
  const [picked, setPicked] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const locked = cur.myChoice != null;
  const shown = locked ? cur.myChoice : picked;

  return (
    <motion.div key={cur.idx} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <PaperCard>
        <div className="flex items-center justify-between">
          <Eyebrow>ronde {pad(cur.idx + 1)} / {QUIZ_SIZE}</Eyebrow>
          <span className="font-mono text-[11px] text-ink-faint">{QUESTIONS[cur.idx].cat}</span>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-rule">
          <div className="h-full bg-accent" style={{ width: `${(cur.idx / QUIZ_SIZE) * 100}%` }} />
        </div>
        <h2 className="mt-5 font-display text-2xl text-ink">{guessText(cur.idx, view.partnerName)}</h2>
        <div className="mt-5 grid gap-2">
          {cur.options.map((o, i) => (
            <motion.button
              key={i}
              type="button"
              disabled={locked || pending}
              whileTap={{ scale: 0.98 }}
              onClick={() => setPicked(i)}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                shown === i ? "border-accent-ink bg-blush/40 text-ink" : "border-rule bg-ground text-ink hover:border-accent-ink/40",
                locked && shown !== i && "opacity-50",
              )}
            >
              <span className="font-mono text-xs text-accent-ink">{LETTERS[i]}</span>
              <span>{o}</span>
            </motion.button>
          ))}
        </div>

        {locked ? (
          <p className="mt-5 text-center text-sm text-ink-soft" role="status">
            Kamu sudah menjawab ·{" "}
            {cur.partnerAnswered ? "menyiapkan hasil ronde…" : `${view.partnerName} sedang berpikir…`}
          </p>
        ) : (
          <div className="mt-5 flex flex-col items-center gap-2">
            {error && <p className="text-sm text-accent-ink">{error}</p>}
            <Button
              disabled={picked == null || pending}
              onClick={() =>
                start(async () => {
                  const r = await answerRound(view.id, cur.idx, picked!);
                  if (r.error) setError(r.error);
                  if (r.view) onAnswered(r.view);
                })
              }
            >
              Kirim jawaban
            </Button>
            <p className="text-xs text-ink-faint">
              {cur.partnerAnswered ? `${view.partnerName} sudah menjawab.` : "Tanpa timer — pikirkan pelan-pelan."}
            </p>
          </div>
        )}
      </PaperCard>
    </motion.div>
  );
}

/* ---------------------------------------------------------- reveal -- */

function Reveal({ view, r, onNext }: { view: QuizView; r: RevealedRound; onNext: () => void }) {
  const reduce = useReducedMotion();
  const fb = feedbackFor(view.tone, r.mine.correct, `${view.id}:${r.idx}:${view.selfId}`);
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
      <PaperCard className="text-center">
        <Eyebrow>hasil ronde {pad(r.idx + 1)}</Eyebrow>
        <motion.p
          className="mt-4 text-5xl"
          animate={reduce ? undefined : r.mine.correct ? { scale: [1, 1.25, 1] } : { x: [0, -8, 8, -5, 5, 0] }}
          transition={{ duration: 0.5 }}
        >
          {r.mine.correct ? "❤️" : "😭"}
        </motion.p>
        <p className="mt-3 font-display text-2xl text-ink">{fb.title}</p>
        <p className="mt-1 text-ink-soft">“{fb.line}”</p>
        <p className="mt-4 text-sm text-ink-soft">{guessText(r.idx, view.partnerName)}</p>
        <p className="mt-1 text-sm">
          Jawaban asli: <b className="text-ink">{r.mine.options[r.mine.correctIdx]}</b>
          {!r.mine.correct && <span className="text-ink-faint"> · kamu pilih {r.mine.options[r.mine.choice]}</span>}
        </p>
        <p className="mt-1 font-mono text-[11px] text-accent-ink">{r.mine.correct ? "+100" : "+0"}</p>
      </PaperCard>
      <PaperCard className="p-4 text-sm text-ink-soft">
        {view.partnerName} menebak tentangmu: {r.theirs.correct ? "benar ✓" : `salah ✗ (pilih “${r.theirs.options[r.theirs.choice]}”)`}
      </PaperCard>
      <div className="text-center">
        <Button onClick={onNext}>{r.idx + 1 >= QUIZ_SIZE ? "Lihat hasil akhir →" : "Lanjut →"}</Button>
      </div>
    </motion.div>
  );
}

/* ---------------------------------------------------------- result -- */

function Result({ view }: { view: QuizView }) {
  const reduce = useReducedMotion();
  const me = scoreOf(view.revealed.map((r) => ({ idx: r.idx, correct: r.mine.correct })));
  const them = scoreOf(view.revealed.map((r) => ({ idx: r.idx, correct: r.theirs.correct })));
  const win = winnerOf(me.right, them.right);
  const bothWrong = view.revealed.filter((r) => !r.mine.correct && !r.theirs.correct);
  const learned = view.revealed.filter((r) => !r.mine.correct);
  const step = (i: number) => ({
    initial: reduce ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: reduce ? 0 : 0.4 + i * 0.6 },
  });

  return (
    <div className="space-y-4">
      <motion.div {...step(0)} className="text-center">
        <Eyebrow>seberapa kenal kita? ❤️</Eyebrow>
        <p className="mt-2 font-display text-3xl text-ink">Permainan selesai!</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { label: `Kamu mengenal ${view.partnerName}`, s: me },
          { label: `${view.partnerName} mengenal kamu`, s: them },
        ].map(({ label, s }, i) => (
          <motion.div key={label} {...step(1 + i)}>
            <PaperCard className="h-full">
              <p className="text-sm text-ink-soft">{label}</p>
              <p className="mt-2 font-display text-4xl text-ink">{s.points.toLocaleString("id-ID")}</p>
              <p className="font-mono text-xs text-ink-faint">
                {s.pct}% · {s.right}/{QUIZ_SIZE} benar
              </p>
              <p className="mt-2 font-hand text-xl text-accent-ink">{s.title}</p>
            </PaperCard>
          </motion.div>
        ))}
      </div>

      <motion.div {...step(3)}>
        <PaperCard lift className="text-center">
          <p className="text-4xl">{win === "tie" ? "🤝" : "🏆"}</p>
          <p className="mt-2 font-display text-2xl text-ink">
            {win === "tie" ? "SERI!" : win === "me" ? "PEMENANG: KAMU!" : `PEMENANG: ${view.partnerName.toUpperCase()}!`}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {win === "tie"
              ? "Sama-sama kenal, sama-sama sayang."
              : win === "me"
                ? "Ternyata kamu lebih mengenal pasanganmu kali ini!"
                : `${view.partnerName} lebih mengenalmu kali ini. Ayo kenalan lagi. 😌`}
          </p>
          {me.pct === 100 && <p className="mt-2 text-2xl">🎉✨💖✨🎉</p>}
        </PaperCard>
      </motion.div>

      <motion.div {...step(4)}>
        <PaperCard>
          <Eyebrow>statistik</Eyebrow>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-soft">Benar / salah (kamu)</dt>
            <dd className="text-ink">{me.right} / {me.wrong}</dd>
            <dt className="text-ink-soft">Benar beruntun terpanjang</dt>
            <dd className="text-ink">{me.streak}</dd>
            <dt className="text-ink-soft">Paling dikuasai</dt>
            <dd className="text-ink">{me.bestCat ?? "—"}</dd>
            <dt className="text-ink-soft">Paling banyak salah</dt>
            <dd className="text-ink">{me.wrong ? me.worstCat : "—"}</dd>
            <dt className="text-ink-soft">Selisih skor</dt>
            <dd className="text-ink">{Math.abs(me.points - them.points).toLocaleString("id-ID")}</dd>
            <dt className="text-ink-soft">Sama-sama terkecoh</dt>
            <dd className="text-ink">{bothWrong.length ? bothWrong.map((r) => r.idx + 1).join(", ") : "—"}</dd>
          </dl>
        </PaperCard>
      </motion.div>

      {learned.length > 0 && (
        <motion.div {...step(5)}>
          <PaperCard>
            <Eyebrow>ada hal yang belum kamu ketahui ❤️</Eyebrow>
            <ul className="mt-3 space-y-3">
              {learned.map((r) => (
                <li key={r.idx}>
                  <p className="text-sm text-ink-soft">{guessText(r.idx, view.partnerName)}</p>
                  <p className="font-display text-lg text-ink">“{r.mine.options[r.mine.correctIdx]}”</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 font-hand text-lg text-accent-ink">Sekarang kamu tahu hal baru tentang {view.partnerName}.</p>
          </PaperCard>
        </motion.div>
      )}

      <motion.div {...step(6)}>
        <Review view={view} />
      </motion.div>
      <div className="text-center">
        <Link href="/quiz" className="text-sm text-accent-ink hover:underline">← Kembali</Link>
      </div>
    </div>
  );
}

function Review({ view }: { view: QuizView }) {
  const [open, setOpen] = useState(false);
  return (
    <PaperCard>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between">
        <Eyebrow>review jawaban</Eyebrow>
        <span className="text-sm text-accent-ink">{open ? "tutup" : "buka"}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 space-y-4">
            {view.revealed.map((r) => (
              <li key={r.idx} className="border-t border-rule pt-3 text-sm">
                <p className="font-mono text-[11px] text-ink-faint">{pad(r.idx + 1)} · {QUESTIONS[r.idx].cat}</p>
                <p className="mt-1 text-ink">
                  Tentang {view.partnerName}: <b>{r.mine.options[r.mine.correctIdx]}</b> — kamu{" "}
                  {r.mine.correct ? "✓" : `✗ (${r.mine.options[r.mine.choice]})`}
                </p>
                <p className="text-ink-soft">
                  Tentangmu: <b>{r.theirs.options[r.theirs.correctIdx]}</b> — {view.partnerName}{" "}
                  {r.theirs.correct ? "✓" : `✗ (${r.theirs.options[r.theirs.choice]})`}
                </p>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </PaperCard>
  );
}
