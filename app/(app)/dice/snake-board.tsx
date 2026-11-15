"use client";

import { motion, useReducedMotion } from "motion/react";
import { BOARD_COLS, BOARD_ROWS, BOARD_SIZE, HEARTS, LADDERS, SNAKES, cellOf } from "@/lib/dice/board";

/**
 * The 30-square Ular Tangga board: a CSS grid of squares, an SVG layer of
 * ladders + snakes on top, and two pawns that glide between squares.
 * Square 0 = the start area under the board.
 */

const CELL = 100; // SVG units per square
const W = BOARD_COLS * CELL;
const H = BOARD_ROWS * CELL;

const center = (n: number) => {
  const { col, row } = cellOf(n);
  return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
};

function Ladder({ from, to }: { from: number; to: number }) {
  const a = center(from);
  const b = center(to);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const nx = (-(b.y - a.y) / len) * 11;
  const ny = ((b.x - a.x) / len) * 11;
  const rungs = Math.max(2, Math.floor(len / 34));
  return (
    <g stroke="#a1795f" strokeWidth={5} strokeLinecap="round" opacity={0.85}>
      <line x1={a.x + nx} y1={a.y + ny} x2={b.x + nx} y2={b.y + ny} />
      <line x1={a.x - nx} y1={a.y - ny} x2={b.x - nx} y2={b.y - ny} />
      {Array.from({ length: rungs }, (_, i) => {
        const t = (i + 0.5) / rungs;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        return <line key={i} x1={x + nx} y1={y + ny} x2={x - nx} y2={y - ny} strokeWidth={4} />;
      })}
    </g>
  );
}

function Snake({ from, to }: { from: number; to: number }) {
  const a = center(from); // head
  const b = center(to); // tail
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const nx = (-dy / len) * 32;
  const ny = (dx / len) * 32;
  const p = (t: number, s: number) => `${a.x + dx * t + nx * s},${a.y + dy * t + ny * s}`;
  const d = `M${p(0, 0)} C${p(0.2, 1)} ${p(0.3, 1)} ${p(0.5, 0)} S${p(0.8, -1)} ${p(1, 0)}`;
  return (
    <g>
      <path d={d} fill="none" stroke="#9aa86f" strokeWidth={13} strokeLinecap="round" opacity={0.9} />
      <path d={d} fill="none" stroke="#c9d39a" strokeWidth={4} strokeLinecap="round" strokeDasharray="2 12" />
      <circle cx={a.x} cy={a.y} r={12} fill="#8a9a5b" />
      <circle cx={a.x - 4} cy={a.y - 3} r={2.4} fill="#fff" />
      <circle cx={a.x + 4} cy={a.y - 3} r={2.4} fill="#fff" />
    </g>
  );
}

export type Pawn = { id: string; name: string; avatar: string | null; at: number; color: string };

export function SnakeBoard({ pawns, activeId }: { pawns: Pawn[]; activeId: string | null }) {
  const reduce = useReducedMotion();
  const squares = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1);
  const atStart = pawns.filter((p) => p.at <= 0);

  return (
    <div>
      <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-rule" style={{ aspectRatio: `${W} / ${H}` }}>
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${BOARD_COLS}, 1fr)`, gridTemplateRows: `repeat(${BOARD_ROWS}, 1fr)` }}>
          {squares.map((n) => {
            const { col, row } = cellOf(n);
            const heart = HEARTS.includes(n);
            const shade = (col + row) % 2 === 0;
            return (
              <div
                key={n}
                className="relative border-[0.5px] border-rule/60"
                style={{
                  gridColumn: col + 1,
                  gridRow: row + 1,
                  background: n === BOARD_SIZE ? "color-mix(in srgb, #D99AA8 45%, var(--paper))" : heart ? "color-mix(in srgb, #F8E5E9 80%, var(--paper))" : shade ? "var(--paper)" : "var(--paper-2)",
                }}
              >
                <span className="absolute top-1 left-1.5 font-mono text-[10px] text-ink-faint">{n}</span>
                {heart && <span className="absolute inset-0 grid place-items-center text-lg text-[#D99AA8]">♥</span>}
                {n === BOARD_SIZE && <span className="absolute inset-0 grid place-items-center text-xl">🏁</span>}
              </div>
            );
          })}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          {Object.entries(LADDERS).map(([a, b]) => (
            <Ladder key={a} from={+a} to={b} />
          ))}
          {Object.entries(SNAKES).map(([a, b]) => (
            <Snake key={a} from={+a} to={b} />
          ))}
        </svg>
        {pawns
          .filter((p) => p.at > 0)
          .map((p, i) => {
            const c = center(Math.min(p.at, BOARD_SIZE));
            const shared = pawns.filter((q) => q.at === p.at).length > 1;
            const off = shared ? (i === 0 ? -9 : 9) : 0;
            return (
              <motion.div
                key={p.id}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                initial={false}
                animate={{ left: `${((c.x + off) / W) * 100}%`, top: `${((c.y + off * 0.4) / H) * 100}%` }}
                transition={reduce ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
              >
                <PawnDot p={p} active={p.id === activeId} />
              </motion.div>
            );
          })}
      </div>
      <div className="mt-2 flex min-h-8 items-center justify-center gap-2 font-mono text-[11px] text-ink-faint">
        {atStart.length > 0 && (
          <>
            <span>start:</span>
            {atStart.map((p) => (
              <PawnDot key={p.id} p={p} active={p.id === activeId} />
            ))}
          </>
        )}
      </div>
      <p className="sr-only">
        {pawns.map((p) => `${p.name} di kotak ${p.at || "start"}`).join(", ")}
      </p>
    </div>
  );
}

function PawnDot({ p, active }: { p: Pawn; active: boolean }) {
  return (
    <span
      title={p.name}
      className="grid h-7 w-7 place-items-center overflow-hidden rounded-full border-2 text-[11px] font-medium text-white shadow-md"
      style={{ borderColor: active ? "#fff" : p.color, background: p.color, boxShadow: active ? `0 0 0 3px ${p.color}` : undefined }}
    >
      {p.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
        <img src={p.avatar} alt="" className="h-full w-full object-cover" />
      ) : (
        p.name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
