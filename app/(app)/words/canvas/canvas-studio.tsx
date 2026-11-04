"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { BackLink } from "@/components/words/back-link";
import { inputClass } from "@/components/words/chips";
import {
  BACKGROUNDS,
  DEFAULT_DESIGN,
  FONTS,
  FORMATS,
  cardSize,
  cardWords,
  drawCard,
  exportCardPng,
  loadFonts,
  resolveFonts,
  type CardDesign,
  type FontFamilies,
  type SignatureMode,
} from "@/components/words/card-render";
import { cn } from "@/lib/utils";

export type CanvasSource = { key: string; title: string; text: string; author: string; backHref: string };

type Tab = "text" | "background" | "type" | "signature" | "export";

const TABS: { key: Tab; label: string }[] = [
  { key: "text", label: "Teks" },
  { key: "background", label: "Latar" },
  { key: "type", label: "Huruf" },
  { key: "signature", label: "Tanda tangan" },
  { key: "export", label: "Ekspor" },
];

/**
 * The Canvas — a real editor, not a preview: drag the words where they
 * belong, pick a paper, a typeface, a colour for one word, sign it, export
 * a PNG at full size. Design is remembered per source on this device.
 */
export function CanvasStudio({ source, selfName }: { source: CanvasSource; selfName: string }) {
  const storeKey = `words:canvas:${source.key}`;
  const initial: CardDesign = useMemo(
    () => ({
      ...DEFAULT_DESIGN,
      text: source.text,
      title: source.title,
      signatureText: source.author || selfName,
      signature: source.author ? "name" : "none",
      size: autoSize(source.text),
    }),
    [source, selfName],
  );
  const [d, setD] = useState<CardDesign>(initial);
  const [tab, setTab] = useState<Tab>("text");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [families, setFamilies] = useState<FontFamilies | null>(null);
  const [overflow, setOverflow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const hydrated = useRef(false);

  // Restore this source's last design; resolve the font families.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<CardDesign>;
        // Style is remembered; the words always come fresh from the source
        // (highlights only survive if the words are unchanged).
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from localStorage after mount
        setD((cur) => ({
          ...cur,
          ...saved,
          text: cur.text,
          title: cur.title,
          highlights: saved.text === cur.text ? (saved.highlights ?? []) : [],
          background: saved.background === "custom" && !saved.customColor ? cur.background : (saved.background ?? cur.background),
        }));
      }
    } catch {}
    hydrated.current = true;
    const root = rootRef.current?.closest("[data-words-root]") ?? document.documentElement;
    setFamilies(resolveFonts(root));
  }, [storeKey]);

  useEffect(() => {
    if (!hydrated.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(storeKey, JSON.stringify(d));
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [d, storeKey]);

  const { w: W, h: H } = cardSize(d);

  // Draw the preview at the screen's own resolution.
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !families) return;
    const cssW = wrap.clientWidth;
    const cssH = (cssW * H) / W;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    const res = drawCard(ctx, d, W, H, families, d.background === "custom" ? image : null);
    setOverflow(res.overflow);
  }, [d, families, image, W, H]);

  useEffect(() => {
    if (!families) return;
    let cancelled = false;
    draw();
    void loadFonts(d, families).then(() => {
      if (!cancelled) draw();
    });
    return () => {
      cancelled = true;
    };
  }, [draw, d, families]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  const set = <K extends keyof CardDesign>(k: K, v: CardDesign[K]) => setD((cur) => ({ ...cur, [k]: v }));

  function pickBackground(key: CardDesign["background"]) {
    const bg = BACKGROUNDS.find((b) => b.key === key)!;
    setD((cur) => ({ ...cur, background: key, color: bg.ink, accent: bg.accent }));
  }

  // Drag the text block around the card.
  function pointerPos(e: React.PointerEvent) {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }
  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = pointerPos(e);
    drag.current = { dx: d.x - p.x, dy: d.y - p.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drag.current) return;
    const p = pointerPos(e);
    const clamp = (n: number) => Math.min(0.95, Math.max(0.05, n));
    setD((cur) => ({ ...cur, x: clamp(p.x + drag.current!.dx), y: clamp(p.y + drag.current!.dy) }));
  }
  function onUp() {
    drag.current = null;
  }

  async function onImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNote("Pilih file gambar ya.");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setD((cur) => ({ ...cur, background: "custom", color: "#ffffff", accent: "#ffd9e0", customDim: 0.3 }));
    };
    img.onerror = () => setNote("Gambarnya tidak bisa dibuka.");
    img.src = url;
  }

  async function exportPng(share: boolean) {
    if (!families) return;
    setBusy(true);
    setNote(null);
    try {
      const blob = await exportCardPng(d, families, d.background === "custom" ? image : null);
      const name = `little-words-${slug(d.title || d.text)}-${W}x${H}.png`;
      const file = new File([blob], name, { type: "image/png" });
      if (share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: d.title || "little words." });
          setNote("Dibagikan ♡");
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setNote(`Tersimpan sebagai PNG ${W}×${H} ♡`);
    } catch {
      setNote("Gagal membuat gambar. Coba lagi ya.");
    } finally {
      setBusy(false);
    }
  }

  function fit() {
    // Largest size whose block fits ~80% of the card height.
    if (!families) return;
    const c = document.createElement("canvas").getContext("2d");
    if (!c) return;
    let lo = 18;
    let hi = 120;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      c.canvas.width = W;
      c.canvas.height = H;
      const res = drawCard(c, { ...d, size: mid, signature: "none" }, W, H, families, null);
      if (res.blockH < H * 0.72) lo = mid;
      else hi = mid;
    }
    set("size", Math.round(lo));
  }

  const words = useMemo(() => cardWords(d.text), [d.text]);

  return (
    <div ref={rootRef} className="flex flex-col gap-5">
      <div>
        <BackLink href={source.backHref} label={source.key === "blank" ? "little words." : "kembali"} />
        <Eyebrow className="mt-4">The Canvas</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink">Make it something to keep.</h1>
      </div>

      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        {/* preview */}
        <div className="md:sticky md:top-6 md:w-[46%]">
          <div ref={wrapRef} className={cn("mx-auto w-full", H / W > 1.5 ? "max-w-[300px] md:max-w-none" : "max-w-[380px] md:max-w-none")}>
            <canvas
              ref={canvasRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              className="block w-full cursor-grab touch-none rounded-xl shadow-[var(--shadow-soft)] active:cursor-grabbing"
              role="img"
              aria-label="Pratinjau kartu — seret untuk memindahkan teks"
            />
          </div>
          <p className="mt-2 text-center text-xs text-ink-faint">
            Seret teks untuk memindahkannya · {W}×{H}
          </p>
          {overflow ? (
            <p className="mt-1 text-center text-xs text-danger">
              Teksnya tidak muat.{" "}
              <button type="button" className="underline" onClick={fit}>
                Sesuaikan ukuran
              </button>
            </p>
          ) : null}
        </div>

        {/* controls */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
            <div className="flex w-max gap-1 rounded-full border border-rule bg-paper p-1" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={cn("whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm", tab === t.key ? "bg-blush/70 text-ink" : "text-ink-soft")}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-5 rounded-2xl border border-rule bg-paper p-5">
            {tab === "text" ? (
              <>
                <Ctl label="Tulisan">
                  <textarea
                    value={d.text}
                    onChange={(e) => setD((cur) => ({ ...cur, text: e.target.value.slice(0, 3000), highlights: [] }))}
                    rows={6}
                    className={cn(inputClass, "font-display text-[15px]")}
                    placeholder="Tulis atau tempel kata-katamu…"
                  />
                </Ctl>
                <label className="flex items-center gap-3 text-sm text-ink-soft">
                  <input type="checkbox" checked={d.showTitle} onChange={(e) => set("showTitle", e.target.checked)} className="accent-[var(--accent-ink)]" />
                  Tampilkan judul
                </label>
                {d.showTitle ? (
                  <input value={d.title} onChange={(e) => set("title", e.target.value.slice(0, 80))} className={cn(inputClass, "py-2 text-sm")} />
                ) : null}
                <Ctl label="Posisi">
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["Atas", 0.28],
                        ["Tengah", 0.5],
                        ["Bawah", 0.72],
                      ] as const
                    ).map(([l, y]) => (
                      <Pill key={l} on={Math.abs(d.y - y) < 0.02 && Math.abs(d.x - 0.5) < 0.02} onClick={() => setD((c) => ({ ...c, x: 0.5, y }))}>
                        {l}
                      </Pill>
                    ))}
                  </div>
                </Ctl>
                <Ctl label="Perataan">
                  <div className="flex gap-2">
                    {(["left", "center", "right"] as const).map((a) => (
                      <Pill key={a} on={d.align === a} onClick={() => set("align", a)}>
                        {a === "left" ? "⟸ Kiri" : a === "center" ? "Tengah" : "Kanan ⟹"}
                      </Pill>
                    ))}
                  </div>
                </Ctl>
                {words.length ? (
                  <Ctl label="Tekankan kata" hint="tap kata untuk memberi warna aksen">
                    <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
                      {words.map((w, i) => {
                        const on = d.highlights.includes(i);
                        return (
                          <button
                            key={i}
                            type="button"
                            aria-pressed={on}
                            onClick={() => set("highlights", on ? d.highlights.filter((x) => x !== i) : [...d.highlights, i])}
                            className={cn(
                              "rounded-md px-1.5 py-0.5 font-display text-sm",
                              on ? "bg-blush text-accent-ink" : "text-ink-soft hover:bg-paper-2",
                            )}
                          >
                            {w}
                          </button>
                        );
                      })}
                    </div>
                  </Ctl>
                ) : null}
              </>
            ) : null}

            {tab === "background" ? (
              <>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {BACKGROUNDS.map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      aria-pressed={d.background === b.key}
                      onClick={() => pickBackground(b.key)}
                      className={cn("flex flex-col items-center gap-1 rounded-xl p-1.5 text-[11px] text-ink-soft", d.background === b.key && "bg-blush/50 text-ink")}
                    >
                      <span className="block aspect-[3/4] w-full rounded-lg border border-rule" style={{ background: b.swatch }} />
                      {b.label}
                    </button>
                  ))}
                </div>
                {d.background === "custom" ? (
                  <div className="flex flex-col gap-3">
                    <Ctl label="Warna latar">
                      <input type="color" value={d.customColor} onChange={(e) => set("customColor", e.target.value)} className="h-10 w-16 rounded" />
                    </Ctl>
                    <Ctl label="Atau foto sendiri" hint="tidak diunggah — hanya dipakai di perangkat ini">
                      <input type="file" accept="image/*" onChange={(e) => void onImage(e.target.files?.[0])} className="text-sm text-ink-soft" />
                    </Ctl>
                    {image ? (
                      <Ctl label={`Redupkan foto · ${Math.round(d.customDim * 100)}%`}>
                        <input
                          type="range"
                          min={0}
                          max={0.7}
                          step={0.05}
                          value={d.customDim}
                          onChange={(e) => set("customDim", Number(e.target.value))}
                          className="accent-[var(--accent-ink)]"
                        />
                      </Ctl>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}

            {tab === "type" ? (
              <>
                <Ctl label="Tipografi">
                  <div className="flex flex-wrap gap-2">
                    {FONTS.map((f) => (
                      <Pill key={f.key} on={d.font === f.key} onClick={() => set("font", f.key)}>
                        <span style={{ fontFamily: families?.[f.key] }}>{f.label}</span>
                      </Pill>
                    ))}
                  </div>
                </Ctl>
                <Range label="Ukuran" value={d.size} min={18} max={120} step={1} onChange={(v) => set("size", v)} />
                <Range label="Jarak antarbaris" value={d.lineHeight} min={1} max={2.6} step={0.05} onChange={(v) => set("lineHeight", v)} fmt={(v) => v.toFixed(2)} />
                <Range label="Jarak antarhuruf" value={d.letterSpacing} min={-2} max={12} step={0.5} onChange={(v) => set("letterSpacing", v)} />
                <div className="flex flex-wrap items-center gap-4">
                  <Ctl label="Warna tulisan">
                    <input type="color" value={d.color} onChange={(e) => set("color", e.target.value)} className="h-10 w-16 rounded" />
                  </Ctl>
                  <Ctl label="Warna aksen">
                    <input type="color" value={d.accent} onChange={(e) => set("accent", e.target.value)} className="h-10 w-16 rounded" />
                  </Ctl>
                </div>
                <div className="flex gap-2">
                  <Pill on={d.bold} onClick={() => set("bold", !d.bold)}>
                    <b>B</b> Tebal
                  </Pill>
                  <Pill on={d.italic} onClick={() => set("italic", !d.italic)}>
                    <i>I</i> Miring
                  </Pill>
                  <Pill on={d.underline} onClick={() => set("underline", !d.underline)}>
                    <u>U</u> Garis bawah
                  </Pill>
                </div>
              </>
            ) : null}

            {tab === "signature" ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["none", "Tanpa"],
                      ["name", "Nama"],
                      ["pen", "Nama pena"],
                      ["initials", "Inisial"],
                      ["drawn", "Tanda tangan"],
                    ] as [SignatureMode, string][]
                  ).map(([k, l]) => (
                    <Pill key={k} on={d.signature === k} onClick={() => set("signature", k)}>
                      {l}
                    </Pill>
                  ))}
                </div>
                {d.signature === "name" || d.signature === "pen" || d.signature === "initials" ? (
                  <input
                    value={d.signatureText}
                    onChange={(e) => set("signatureText", e.target.value.slice(0, 40))}
                    placeholder={d.signature === "pen" ? "nama pena…" : "nama…"}
                    className={cn(inputClass, "py-2 text-sm")}
                  />
                ) : null}
                {d.signature === "drawn" ? <SignaturePad strokes={d.strokes} onChange={(s) => set("strokes", s)} /> : null}
              </>
            ) : null}

            {tab === "export" ? (
              <>
                <Ctl label="Format">
                  <div className="flex flex-wrap gap-2">
                    {FORMATS.map((f) => (
                      <Pill key={f.key} on={d.format === f.key} onClick={() => set("format", f.key)}>
                        {f.label}
                      </Pill>
                    ))}
                  </div>
                </Ctl>
                {d.format === "custom" ? (
                  <div className="flex items-center gap-2 text-sm text-ink-soft">
                    <input
                      type="number"
                      min={320}
                      max={4000}
                      value={d.customW}
                      onChange={(e) => set("customW", Number(e.target.value))}
                      className={cn(inputClass, "w-28 py-2 text-sm")}
                      aria-label="Lebar"
                    />
                    ×
                    <input
                      type="number"
                      min={320}
                      max={4000}
                      value={d.customH}
                      onChange={(e) => set("customH", Number(e.target.value))}
                      className={cn(inputClass, "w-28 py-2 text-sm")}
                      aria-label="Tinggi"
                    />
                    px
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => exportPng(false)} disabled={busy || !d.text.trim()}>
                    {busy ? "Membuat…" : "↓ Simpan PNG"}
                  </Button>
                  <Button variant="soft" onClick={() => exportPng(true)} disabled={busy || !d.text.trim()}>
                    ↗ Bagikan
                  </Button>
                </div>
                <p className="text-xs text-ink-faint">PNG resolusi penuh ({W}×{H}). Di ponsel, “Bagikan” membuka IG Story / WA Status.</p>
              </>
            ) : null}
          </div>
          {note ? (
            <p className="text-sm text-ink-soft" role="status">
              {note}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setD(initial);
              setImage(null);
            }}
            className="self-start text-xs text-ink-faint hover:text-ink-soft"
          >
            ↺ mulai ulang desain
          </button>
        </div>
      </div>
    </div>
  );
}

function autoSize(text: string) {
  const n = text.trim().length;
  if (n < 60) return 64;
  if (n < 140) return 54;
  if (n < 300) return 44;
  if (n < 600) return 36;
  return 28;
}

function slug(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 5)
      .join("-") || "card"
  );
}

function Ctl({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        {label}
        {hint ? <span className="ml-2 normal-case tracking-normal">· {hint}</span> : null}
      </p>
      {children}
    </div>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition",
        on ? "border-accent-ink/50 bg-blush/60 text-ink" : "border-rule text-ink-soft hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        {label}
        <span>{fmt ? fmt(value) : value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-[var(--accent-ink)]" />
    </label>
  );
}

/** A simple signature pad: strokes kept as normalised points, drawn crisp at any export size. */
function SignaturePad({ strokes, onChange }: { strokes: [number, number][][]; onChange: (s: [number, number][][]) => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const current = useRef<[number, number][] | null>(null);
  const [live, setLive] = useState(strokes);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep the pad in step when the parent resets it
    setLive(strokes);
  }, [strokes]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = w * dpr;
    c.height = h * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = getComputedStyle(c).color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of live) {
      if (!s.length) continue;
      ctx.beginPath();
      ctx.moveTo(s[0][0] * w, s[0][1] * h);
      for (const p of s.slice(1)) ctx.lineTo(p[0] * w, p[1] * h);
      ctx.stroke();
    }
  }, [live]);

  function pos(e: React.PointerEvent): [number, number] {
    const r = ref.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  }

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={ref}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          current.current = [pos(e)];
          setLive((l) => [...l, current.current!]);
        }}
        onPointerMove={(e) => {
          if (!current.current) return;
          current.current.push(pos(e));
          setLive((l) => [...l.slice(0, -1), [...current.current!]]);
        }}
        onPointerUp={() => {
          if (current.current) onChange([...live]);
          current.current = null;
        }}
        onPointerCancel={() => {
          current.current = null;
        }}
        className="h-[120px] w-full max-w-[300px] touch-none rounded-xl border border-dashed border-rule bg-ground text-ink"
        aria-label="Area tanda tangan"
      />
      <div className="flex gap-3 text-xs">
        <span className="text-ink-faint">Tanda tangan di kotak ini.</span>
        <button type="button" onClick={() => onChange([])} className="text-ink-soft underline">
          hapus
        </button>
      </div>
    </div>
  );
}
