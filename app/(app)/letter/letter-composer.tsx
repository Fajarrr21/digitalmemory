"use client";

import { useActionState, useState } from "react";
import { sendLetterSequence, type SendLetterState } from "./actions";
import { parseSpotifyTrackId, spotifyEmbedUrl } from "@/lib/spotify";
import { Button } from "@/components/ui/button";

const MAX = 10;

const fieldClass =
  "w-full rounded-xl border border-rule bg-ground px-3.5 py-2.5 text-ink placeholder:text-ink-faint outline-none transition focus:border-accent-ink/50";

type Draft = { id: string; title: string; body: string; song: string };

let _seq = 0;
function emptyDraft(): Draft {
  return { id: `d${_seq++}`, title: "", body: "", song: "" };
}

export function LetterComposer({ partnerName }: { partnerName: string }) {
  const [state, action, pending] = useActionState<SendLetterState, FormData>(
    sendLetterSequence,
    {},
  );
  const [drafts, setDrafts] = useState<Draft[]>(() => [emptyDraft()]);
  const [seenState, setSeenState] = useState(state);

  // Reset to a single empty draft after a successful send (render-time reset).
  if (state !== seenState) {
    setSeenState(state);
    if (state.ok) setDrafts([emptyDraft()]);
  }

  function update(id: string, patch: Partial<Draft>) {
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }
  function add() {
    setDrafts((ds) => (ds.length >= MAX ? ds : [...ds, emptyDraft()]));
  }
  function remove(id: string) {
    setDrafts((ds) => (ds.length <= 1 ? ds : ds.filter((d) => d.id !== id)));
  }
  function move(index: number, dir: -1 | 1) {
    setDrafts((ds) => {
      const next = [...ds];
      const j = index + dir;
      if (j < 0 || j >= next.length) return ds;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  const isSequence = drafts.length > 1;
  const payload = JSON.stringify(
    drafts.map(({ title, body, song }) => ({ title, body, song })),
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="letters" value={payload} />

      {drafts.map((d, i) => {
        const trackId = parseSpotifyTrackId(d.song);
        const songTouched = d.song.trim().length > 0;
        return (
          <div
            key={d.id}
            className="flex flex-col gap-3 rounded-2xl border border-rule-soft bg-ground/40 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs uppercase tracking-[0.16em] text-accent-ink">
                {isSequence ? `Surat ${i + 1} dari ${drafts.length}` : "Surat"}
              </span>
              {isSequence ? (
                <div className="flex items-center gap-1">
                  <IconButton
                    label="Naikkan"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    ↑
                  </IconButton>
                  <IconButton
                    label="Turunkan"
                    disabled={i === drafts.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </IconButton>
                  <IconButton label="Hapus surat" onClick={() => remove(d.id)}>
                    ✕
                  </IconButton>
                </div>
              ) : null}
            </div>

            <input
              className={fieldClass}
              placeholder="Judul (opsional)"
              maxLength={120}
              value={d.title}
              onChange={(e) => update(d.id, { title: e.target.value })}
            />

            <textarea
              rows={4}
              className={`${fieldClass} resize-y leading-relaxed`}
              placeholder={`Tulis untuk ${partnerName}… ♡`}
              value={d.body}
              onChange={(e) => update(d.id, { body: e.target.value })}
            />

            <input
              className={fieldClass}
              placeholder="Tempel link lagu Spotify… (opsional)"
              inputMode="url"
              value={d.song}
              onChange={(e) => update(d.id, { song: e.target.value })}
            />
            {songTouched && !trackId ? (
              <p className="text-xs text-ink-faint">
                Buka lagu di Spotify → Bagikan → Salin link, lalu tempel di sini.
              </p>
            ) : null}
            {trackId ? (
              <iframe
                title="Pratinjau lagu"
                src={spotifyEmbedUrl(trackId)}
                width="100%"
                height={152}
                loading="lazy"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                style={{ border: 0, borderRadius: 12 }}
              />
            ) : null}
          </div>
        );
      })}

      {drafts.length < MAX ? (
        <button
          type="button"
          onClick={add}
          className="self-start rounded-xl border border-dashed border-rule px-3.5 py-2 text-sm text-ink-soft transition hover:border-accent-ink/50 hover:text-accent-ink"
        >
          + Tambah surat berikutnya
        </button>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-accent-ink">
          Terkirim. {isSequence ? "Rangkaian suratmu" : "Suratmu"} menunggu untuk dibuka. ♡
        </p>
      ) : null}

      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending
          ? "Mengirim…"
          : isSequence
            ? `Kirim ${drafts.length} surat`
            : "Kirim surat"}
      </Button>
    </form>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-rule text-ink-soft transition hover:border-accent-ink/50 hover:text-accent-ink disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}
