"use client";

import { useId } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { StayGiftKind, StayObjectKind } from "@/lib/supabase/database.types";
import type { BearSpot, Pose, RoomAction, RoomState } from "@/lib/stay/room";
import type { LightState } from "@/lib/stay/logic";
import { giftShapes, P } from "@/components/stay/gift-art";
import { cn } from "@/lib/utils";

/**
 * stay, my love. — the room, drawn.
 *
 * One 400×500 SVG composed back-to-front: wall + fairy lights, the window
 * (rain / night / morning) with its curtains, a little shelf, the bedside
 * table with the lamp, the "I'm here" jar and the gift cubby, the bed, the
 * blanket, the little character, the teddy bear on its pouf, then the
 * lighting on top. Everything that can be touched is ALSO a real HTML
 * <button> laid over the drawing in percentages — so touch targets are big
 * enough, focus rings are real, and screen readers hear a proper name.
 *
 * Pure presentation: every state comes in through props (see lib/stay/room.ts)
 * and every touch goes out through `onAct`. `calm` stops every loop.
 */

const W = 400;
const H = 500;

const C = {
  wall: "#f2e5d7",
  wallDot: "#e7d2bf",
  floor: "#c9a07f",
  floorLine: "#b48b6a",
  base: "#e8d6c5",
  wood: "#a8775d",
  woodDark: "#7e5544",
  woodLight: "#bf8f72",
  frame: "#7a5544",
  sheet: "#f7ece1",
  blanket: "#d99aa6",
  blanketDeep: "#c27f8d",
  rug: "#dcaab1",
  skin: "#f1d1bc",
  hair: "#4a3229",
  sweater: "#d68f9d",
  pants: "#8c7ba3",
  bear: "#c8946a",
  bearDark: "#a5734f",
  amber: "#f4c27c",
  night: "#2a2340",
};

export type TableGift = { id: string; kind: StayGiftKind; object_kind: StayObjectKind | null; opened: boolean };

export function RoomScene({
  room,
  light,
  showCharacter,
  calm,
  dimmed = false,
  table,
  tableGlow,
  sparkleKey,
  hearts,
  partnerName,
  onAct,
  onTable,
  onLight,
  className,
}: {
  room: RoomState;
  light: LightState;
  showCharacter: boolean;
  calm: boolean;
  dimmed?: boolean;
  table: TableGift[];
  tableGlow: boolean;
  sparkleKey: number;
  hearts: { id: string; mine: boolean }[];
  partnerName: string;
  onAct: (a: RoomAction) => void;
  onTable: () => void;
  onLight: () => void;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const loop = (duration: number) =>
    calm ? { duration: 0 } : { duration, repeat: Infinity, ease: "easeInOut" as const };

  const lampGlow = room.lamp === "warm" ? 0.6 : room.lamp === "dim" ? 0.28 : 0;
  const tint = (room.lamp === "warm" ? 0.1 : room.lamp === "dim" ? 0.3 : 0.4) - (room.scene === "morning" ? 0.1 : 0) + (dimmed ? 0.14 : 0);
  const tintColor = room.lamp === "window" && room.scene !== "morning" ? "#24304f" : "#3a2638";
  const beam = room.lamp === "window" ? 0.26 : 0.08;
  const beamColor = room.scene === "morning" ? "#ffe3c0" : "#cdd7f4";

  const bearAt = bearPosition(room.bear, room.pose, showCharacter);

  return (
    <div className={cn("relative w-full select-none", className)} style={{ aspectRatio: `${W} / ${H}` }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <pattern id={`dots-${uid}`} width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="4" cy="4" r="1.1" fill={C.wallDot} />
            <circle cx="13" cy="13" r="1.1" fill={C.wallDot} />
          </pattern>
          <radialGradient id={`lamp-${uid}`} cx="56" cy="262" r="190" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={C.amber} stopOpacity="0.9" />
            <stop offset="45%" stopColor={C.amber} stopOpacity="0.25" />
            <stop offset="100%" stopColor={C.amber} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`sky-rain-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b4263" />
            <stop offset="100%" stopColor="#5c6283" />
          </linearGradient>
          <linearGradient id={`sky-night-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f2343" />
            <stop offset="100%" stopColor="#3d3f69" />
          </linearGradient>
          <linearGradient id={`sky-morning-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f3cdbb" />
            <stop offset="100%" stopColor="#fbeadb" />
          </linearGradient>
          <clipPath id={`pane-${uid}`}>
            <rect x="244" y="66" width="120" height="134" rx="3" />
          </clipPath>
          <filter id={`soft-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>

        {/* ---- Wall ---- */}
        <rect width={W} height="320" fill={C.wall} />
        <rect width={W} height="320" fill={`url(#dots-${uid})`} opacity="0.7" />
        <FairyLights calm={calm} />

        {/* ---- Window ---- */}
        <g clipPath={`url(#pane-${uid})`}>
          <AnimatePresence initial={false}>
            <motion.g key={room.scene} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }}>
              <rect x="244" y="66" width="120" height="134" fill={`url(#sky-${room.scene}-${uid})`} />
              {room.scene === "rain" ? <Rain calm={calm} /> : null}
              {room.scene === "night" ? <NightSky calm={calm} /> : null}
              {room.scene === "morning" ? <Morning /> : null}
            </motion.g>
          </AnimatePresence>
        </g>
        <rect x="241" y="63" width="126" height="140" rx="4" fill="none" stroke={C.frame} strokeWidth="6" />
        <path d="M304 66 V200 M244 132 H364" stroke={C.frame} strokeWidth="4" />
        <rect x="232" y="203" width="144" height="9" rx="2" fill={C.woodLight} />
        <rect x="232" y="210" width="144" height="3" fill={C.woodDark} opacity="0.35" />
        {/* curtains */}
        <rect x="214" y="44" width="182" height="4" rx="2" fill={C.frame} />
        <motion.path
          d="M216 48 L252 48 Q 246 130 258 236 L 216 236 Z"
          fill={C.blanket}
          style={{ originX: "234px", originY: "48px" }}
          animate={calm ? { skewX: 0 } : { skewX: [0, 1.2, 0, -0.8, 0] }}
          transition={loop(9)}
        />
        <path d="M228 52 Q 226 140 232 232 M240 52 Q 238 140 246 232" stroke={C.blanketDeep} strokeOpacity="0.45" fill="none" />
        <motion.path
          d="M394 48 L358 48 Q 364 130 352 236 L 394 236 Z"
          fill={C.blanket}
          style={{ originX: "376px", originY: "48px" }}
          animate={calm ? { skewX: 0 } : { skewX: [0, -1, 0, 0.8, 0] }}
          transition={loop(11)}
        />
        <path d="M382 52 Q 384 140 378 232 M370 52 Q 372 140 364 232" stroke={C.blanketDeep} strokeOpacity="0.45" fill="none" />

        {/* ---- A little shelf above the bed ---- */}
        <rect x="150" y="186" width="74" height="5" rx="2" fill={C.woodLight} />
        <rect x="160" y="166" width="7" height="20" rx="1" fill="#9fb4c9" />
        <rect x="168" y="170" width="6" height="16" rx="1" fill={C.blanketDeep} />
        <path d="M200 186 l-6 -14 h20 l-6 14 z" fill="#c78b6e" />
        <path d="M204 172 c -6 -10 -2 -16 0 -18 c 2 2 6 8 0 18 z M204 172 c 4 -8 10 -9 12 -8 c -1 3 -5 8 -12 8 z M204 172 c -4 -7 -10 -8 -12 -7 c 1 3 5 7 12 7 z" fill={P.green} />

        {/* ---- Floor ---- */}
        <rect y="318" width={W} height="182" fill={C.floor} />
        {[352, 394, 442, 490].map((y) => (
          <line key={y} x1="0" x2={W} y1={y} y2={y} stroke={C.floorLine} strokeOpacity="0.45" />
        ))}
        {[[60, 318, 352], [190, 352, 394], [300, 318, 352], [110, 394, 442], [340, 394, 442], [230, 442, 490]].map(([x, a, b]) => (
          <line key={`${x}-${a}`} x1={x} x2={x} y1={a} y2={b} stroke={C.floorLine} strokeOpacity="0.35" />
        ))}
        <rect y="313" width={W} height="7" fill={C.base} />
        {/* window light on the floor */}
        <motion.path
          d="M248 212 L360 212 L372 500 L196 500 Z"
          fill={beamColor}
          animate={{ opacity: beam }}
          transition={{ duration: 1.4 }}
        />
        <ellipse cx="236" cy="452" rx="156" ry="34" fill={C.rug} />
        <ellipse cx="236" cy="452" rx="136" ry="26" fill="none" stroke={P.cream} strokeOpacity="0.6" strokeDasharray="3 5" />

        {/* ---- Bedside table, lamp, jar ---- */}
        <ellipse cx="68" cy="404" rx="56" ry="7" fill="#000" opacity="0.08" />
        <rect x="24" y="390" width="6" height="14" fill={C.woodDark} />
        <rect x="106" y="390" width="6" height="14" fill={C.woodDark} />
        <rect x="22" y="306" width="92" height="86" rx="3" fill={C.wood} />
        <rect x="30" y="314" width="76" height="34" rx="2" fill={C.woodDark} />
        <motion.rect
          x="30"
          y="314"
          width="76"
          height="34"
          rx="2"
          fill={C.amber}
          animate={{ opacity: tableGlow ? (calm ? 0.35 : [0.15, 0.45, 0.15]) : 0 }}
          transition={tableGlow && !calm ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.8 }}
        />
        <rect x="30" y="354" width="76" height="28" rx="2" fill={C.woodLight} />
        <circle cx="68" cy="368" r="2.6" fill={C.woodDark} />
        <rect x="16" y="298" width="104" height="9" rx="2" fill={C.woodLight} />
        {/* gifts in the cubby */}
        {table.map((g, i) => (
          <motion.g
            key={g.id}
            initial={calm ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 * i }}
          >
            <g transform={`translate(${31 + i * 19} ${318}) scale(0.44)`}>{giftShapes(g.kind, g.object_kind)}</g>
            {!g.opened ? <circle cx={40 + i * 19} cy="317" r="1.6" fill={C.amber} /> : null}
          </motion.g>
        ))}
        <Sparkles key={sparkleKey} active={sparkleKey > 0 && !calm} />

        {/* lamp */}
        <ellipse cx="56" cy="294" rx="13" ry="4" fill={C.woodDark} />
        <rect x="54" y="264" width="4" height="30" fill={C.woodDark} />
        <motion.path
          d="M30 268 L40 238 L72 238 L82 268 Z"
          animate={{ fill: room.lamp === "window" ? "#cfa79d" : "#efc0b0" }}
          transition={{ duration: 0.9 }}
        />
        <path d="M30 268 L82 268" stroke={C.blanketDeep} strokeOpacity="0.4" />
        <motion.ellipse cx="56" cy="270" rx="18" ry="4" fill={C.amber} animate={{ opacity: lampGlow }} transition={{ duration: 0.9 }} />

        {/* the "I'm here" jar */}
        <JarLight light={light} calm={calm} />

        {/* ---- Bed ---- */}
        <ellipse cx="252" cy="394" rx="130" ry="8" fill="#000" opacity="0.08" />
        <rect x="136" y="368" width="7" height="24" fill={C.woodDark} />
        <rect x="360" y="368" width="7" height="24" fill={C.woodDark} />
        <path d="M124 384 V 244 Q 124 226 142 226 Q 154 226 154 244 V 384 Z" fill={C.wood} />
        <path d="M132 380 V 250 Q 132 236 142 236" stroke={C.woodLight} strokeWidth="2" fill="none" />
        <rect x="358" y="292" width="18" height="84" rx="5" fill={C.wood} />
        <rect x="140" y="342" width="232" height="32" rx="4" fill={C.woodLight} />
        <rect x="142" y="310" width="226" height="36" rx="8" fill={C.sheet} />
        {/* pillow */}
        <path d="M140 300 Q 140 290 152 290 L 192 290 Q 204 290 204 300 L 204 308 Q 204 318 192 318 L 152 318 Q 140 318 140 308 Z" fill={P.cream} />
        <path d="M150 304 Q 172 300 196 304" stroke={C.wallDot} fill="none" />

        {/* ---- The little character (behind the blanket when lying) ---- */}
        {showCharacter ? <Character pose={room.pose} tucked={room.tucked} calm={calm} beat={room.beat} focus={room.focus} /> : null}

        {/* ---- Blanket ---- */}
        <motion.path
          initial={false}
          animate={{ d: room.tucked ? BLANKET_TUCKED : BLANKET_FOLDED }}
          transition={{ duration: calm ? 0 : 1.1, ease: [0.4, 0, 0.2, 1] }}
          fill={C.blanket}
        />
        <motion.path
          initial={false}
          animate={{ d: room.tucked ? HEM_TUCKED : HEM_FOLDED }}
          transition={{ duration: calm ? 0 : 1.1, ease: [0.4, 0, 0.2, 1] }}
          fill="none"
          stroke={C.blanketDeep}
          strokeWidth="2"
          strokeOpacity="0.55"
        />
        <motion.g animate={{ opacity: room.tucked ? 0 : 1 }} transition={{ duration: 0.6 }}>
          <path d="M300 322 H 364 M300 332 H 364" stroke={C.blanketDeep} strokeOpacity="0.5" />
        </motion.g>
        {/* the blanket breathes, very slightly, while someone's tucked in */}
        {room.tucked && !calm ? (
          <motion.ellipse
            cx="236"
            cy="300"
            rx="34"
            ry="5"
            fill={C.blanket}
            animate={{ ry: [5, 6.2, 5] }}
            transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}

        {/* ---- Bear's pouf + bear ---- */}
        <ellipse cx="366" cy="446" rx="28" ry="8" fill="#000" opacity="0.08" />
        <path d="M340 432 Q 340 420 366 420 Q 392 420 392 432 L 392 440 Q 392 448 366 448 Q 340 448 340 440 Z" fill="#b9a4c7" />
        <ellipse cx="366" cy="424" rx="25" ry="6" fill="#c9b6d6" />
        <motion.g
          initial={false}
          animate={{ x: bearAt.x, y: bearAt.y, scale: bearAt.s }}
          transition={{ duration: calm ? 0 : 0.9, ease: [0.4, 0, 0.2, 1] }}
        >
          <motion.g
            key={room.bear === "hugged" ? `hug-${room.beat}` : room.bear}
            initial={false}
            animate={room.bear === "hugged" && !calm ? { scaleX: [1, 1.12, 0.96, 1], scaleY: [1, 0.9, 1.04, 1] } : {}}
            transition={{ duration: 0.7 }}
          >
            <Bear sleepy={room.pose === "lying" && room.bear === "beside"} />
          </motion.g>
        </motion.g>
        {/* little hands around the bear while it's being hugged */}
        {showCharacter && room.bear === "hugged" ? (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1, x: bearAt.x, y: bearAt.y }} transition={{ duration: calm ? 0 : 0.9 }}>
            <circle cx={-10 * bearAt.s} cy={6 * bearAt.s} r={3.6 * bearAt.s} fill={C.skin} stroke={C.sweater} strokeWidth="1" />
            <circle cx={10 * bearAt.s} cy={6 * bearAt.s} r={3.6 * bearAt.s} fill={C.skin} stroke={C.sweater} strokeWidth="1" />
          </motion.g>
        ) : null}

        {/* ---- Light ---- */}
        <motion.rect width={W} height={H} fill={tintColor} animate={{ opacity: Math.max(0, tint) }} transition={{ duration: 1.4 }} />
        <motion.rect width={W} height={H} fill={`url(#lamp-${uid})`} animate={{ opacity: lampGlow }} transition={{ duration: 1.4 }} style={{ mixBlendMode: "screen" }} />

        {/* hearts between the two lights */}
        <AnimatePresence>
          {hearts.map((h, i) => (
            <motion.path
              key={h.id}
              d="M0 6c-3.3-2.3-5.7-4.4-5.7-6.8 0-1.8 1.4-3 2.9-3 1.2 0 2.2.7 2.8 1.6.6-.9 1.6-1.6 2.8-1.6 1.5 0 2.9 1.2 2.9 3 0 2.4-2.4 4.5-5.7 6.8z"
              fill={h.mine ? C.amber : "#f0a3b2"}
              initial={{ x: 95, y: 284, opacity: 0, scale: 0.6 }}
              animate={{ x: 95 + (i % 2 ? 22 : -18), y: 190, opacity: [0, 1, 1, 0], scale: 1.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: calm ? 0.8 : 3, ease: "easeOut" }}
            />
          ))}
        </AnimatePresence>
      </svg>

      {/* ---- Touchable things (real buttons over the drawing) ---- */}
      <Hit x={232} y={44} w={164} h={194} label={`Jendela — ganti suasana di luar`} onClick={() => onAct({ type: "tap_window" })} />
      <Hit x={124} y={226} w={250} h={160} label="Kasur" onClick={() => onAct({ type: "tap_bed" })} />
      <Hit
        x={room.tucked ? 196 : 294}
        y={room.tucked ? 290 : 300}
        w={room.tucked ? 172 : 74}
        h={room.tucked ? 60 : 46}
        label={room.tucked ? "Selimut — sudah terpasang" : "Selimut — tarik ke atas"}
        onClick={() => onAct({ type: "tap_blanket" })}
      />
      {showCharacter ? <Hit {...characterBox(room.pose)} label="Kamu, di kamar kecilmu" onClick={() => onAct({ type: "tap_character" })} /> : null}
      <Hit
        x={bearAt.x - 24}
        y={bearAt.y - 28}
        w={48}
        h={52}
        label={room.bear === "hugged" ? "Teddy bear — sedang dipeluk" : room.bear === "beside" ? "Teddy bear — di sampingmu" : "Teddy bear — peluk"}
        onClick={() => onAct({ type: "tap_bear" })}
      />
      <Hit x={14} y={300} w={108} h={96} label={table.length ? `Meja samping kasur — ${table.length} hadiah` : "Meja samping kasur"} onClick={onTable} />
      <Hit x={22} y={230} w={68} h={66} label={`Lampu — ${room.lamp === "warm" ? "hangat" : room.lamp === "dim" ? "redup" : "mati, cahaya jendela"}`} onClick={() => onAct({ type: "tap_lamp" })} />
      <Hit
        x={78}
        y={266}
        w={40}
        h={36}
        label={light === "together" ? `Lampu kecil — ${partnerName} juga di sini, kirim hati` : "Lampu kecil di samping kasur"}
        onClick={onLight}
      />
    </div>
  );
}

function Hit({ x, y, w, h, label, onClick }: { x: number; y: number; w: number; h: number; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="absolute cursor-pointer rounded-2xl bg-transparent outline-none transition focus-visible:ring-2 focus-visible:ring-[#f4c27c] focus-visible:ring-offset-0 [@media(hover:hover)]:hover:bg-white/[0.06]"
      style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, width: `${(w / W) * 100}%`, height: `${(h / H) * 100}%` }}
    />
  );
}

// ---- Blanket shapes (same command structure, so they morph cleanly) --------
const BLANKET_FOLDED = "M296 316 C 308 308 320 308 330 309 C 342 308 354 308 366 314 L 368 346 L 294 346 Z";
const BLANKET_TUCKED = "M184 304 C 212 290 250 294 282 300 C 312 300 340 300 368 308 L 372 350 L 182 350 Z";
const HEM_FOLDED = "M296 316 C 308 308 320 308 330 309 C 342 308 354 308 366 314";
const HEM_TUCKED = "M184 304 C 212 290 250 294 282 300 C 312 300 340 300 368 308";

function bearPosition(spot: BearSpot, pose: Pose, hasCharacter: boolean): { x: number; y: number; s: number } {
  if (spot === "home") return { x: 366, y: 404, s: 1 };
  if (spot === "beside") return pose === "lying" ? { x: 238, y: 290, s: 0.95 } : { x: 304, y: 296, s: 0.95 };
  // hugged
  if (!hasCharacter) return pose === "idle" ? { x: 366, y: 404, s: 1 } : { x: 238, y: 290, s: 0.95 };
  if (pose === "lying") return { x: 202, y: 296, s: 0.85 };
  if (pose === "sitting") return { x: 252, y: 302, s: 0.85 };
  return { x: 250, y: 394, s: 0.9 };
}

function characterBox(pose: Pose) {
  if (pose === "lying") return { x: 146, y: 272, w: 46, h: 44 };
  if (pose === "sitting") return { x: 226, y: 236, w: 54, h: 70 };
  return { x: 224, y: 318, w: 56, h: 134 };
}

// ---- Pieces --------------------------------------------------------------------

function Head({ cx, cy, r, eyes }: { cx: number; cy: number; r: number; eyes: "open" | "closed" }) {
  return (
    <g>
      <circle cx={cx + r * 0.55} cy={cy - r * 1.02} r={r * 0.46} fill={C.hair} />
      <circle cx={cx} cy={cy - 1} r={r + 3} fill={C.hair} />
      <circle cx={cx} cy={cy} r={r} fill={C.skin} />
      <path
        d={`M${cx - r - 1} ${cy - 1} Q ${cx - r} ${cy - r - 4} ${cx} ${cy - r - 3} Q ${cx + r} ${cy - r - 4} ${cx + r + 1} ${cy - 1} Q ${cx + r * 0.4} ${cy - r * 0.5} ${cx} ${cy - r * 0.42} Q ${cx - r * 0.5} ${cy - r * 0.6} ${cx - r - 1} ${cy - 1} Z`}
        fill={C.hair}
      />
      <circle cx={cx - r * 0.55} cy={cy + r * 0.4} r={r * 0.17} fill={C.blanket} opacity="0.6" />
      <circle cx={cx + r * 0.55} cy={cy + r * 0.4} r={r * 0.17} fill={C.blanket} opacity="0.6" />
      {eyes === "open" ? (
        <>
          <circle cx={cx - r * 0.36} cy={cy + r * 0.12} r={r * 0.09} fill={C.hair} />
          <circle cx={cx + r * 0.36} cy={cy + r * 0.12} r={r * 0.09} fill={C.hair} />
        </>
      ) : (
        <path
          d={`M${cx - r * 0.5} ${cy + r * 0.12} q ${r * 0.14} ${r * 0.12} ${r * 0.28} 0 M${cx + r * 0.22} ${cy + r * 0.12} q ${r * 0.14} ${r * 0.12} ${r * 0.28} 0`}
          stroke={C.hair}
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />
      )}
      <path d={`M${cx - r * 0.12} ${cy + r * 0.48} q ${r * 0.12} ${r * 0.1} ${r * 0.24} 0`} stroke={C.hair} strokeWidth="1" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Character({
  pose,
  tucked,
  calm,
  beat,
  focus,
}: {
  pose: Pose;
  tucked: boolean;
  calm: boolean;
  beat: number;
  focus: RoomState["focus"];
}) {
  const greet = focus === "character";
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.g
        key={pose}
        initial={calm ? { opacity: 0 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: calm ? 0.2 : 0.7 }}
      >
        <motion.g
          key={greet ? `hi-${beat}` : "still"}
          animate={calm ? {} : greet ? { y: [0, -4, 0] } : { y: [0, -0.8, 0] }}
          transition={greet ? { duration: 0.5 } : { duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        >
          {pose === "idle" ? (
            <g>
              <rect x="238" y="412" width="10" height="36" rx="4" fill={C.pants} />
              <rect x="252" y="412" width="10" height="36" rx="4" fill={C.pants} />
              <ellipse cx="243" cy="449" rx="7" ry="3.5" fill={C.woodDark} />
              <ellipse cx="257" cy="449" rx="7" ry="3.5" fill={C.woodDark} />
              <path d="M232 368 Q 250 358 268 368 L 274 414 Q 250 420 226 414 Z" fill={C.sweater} />
              <path d="M232 370 Q 222 390 226 408" stroke={C.sweater} strokeWidth="9" strokeLinecap="round" fill="none" />
              <path d="M268 370 Q 278 390 274 408" stroke={C.sweater} strokeWidth="9" strokeLinecap="round" fill="none" />
              <rect x="246" y="360" width="8" height="8" fill={C.skin} />
              <Head cx={250} cy={344} r={18} eyes="open" />
            </g>
          ) : null}
          {pose === "sitting" ? (
            <g>
              <rect x="240" y="318" width="10" height="44" rx="4" fill={C.pants} />
              <rect x="254" y="318" width="10" height="44" rx="4" fill={C.pants} />
              <ellipse cx="245" cy="364" rx="7" ry="3.5" fill={C.woodDark} />
              <ellipse cx="259" cy="364" rx="7" ry="3.5" fill={C.woodDark} />
              <path d="M236 282 Q 252 274 268 282 L 272 322 Q 252 328 232 322 Z" fill={C.sweater} />
              <path d="M236 286 Q 228 302 234 316" stroke={C.sweater} strokeWidth="8" strokeLinecap="round" fill="none" />
              <path d="M268 286 Q 276 302 270 316" stroke={C.sweater} strokeWidth="8" strokeLinecap="round" fill="none" />
              <rect x="248" y="274" width="8" height="8" fill={C.skin} />
              <Head cx={252} cy={260} r={17} eyes="open" />
            </g>
          ) : null}
          {pose === "lying" ? (
            <g>
              {!tucked ? (
                <>
                  <rect x="292" y="304" width="58" height="9" rx="4" fill={C.pants} />
                  <rect x="292" y="314" width="56" height="9" rx="4" fill={C.pants} />
                  <path d="M186 302 Q 240 296 296 302 L 296 324 Q 240 328 186 322 Z" fill={C.sweater} />
                </>
              ) : null}
              <Head cx={170} cy={298} r={15} eyes="closed" />
            </g>
          ) : null}
        </motion.g>
      </motion.g>
    </AnimatePresence>
  );
}

function Bear({ sleepy }: { sleepy: boolean }) {
  return (
    <g>
      <ellipse cx="-8" cy="15" rx="5" ry="3.6" fill={C.bearDark} />
      <ellipse cx="8" cy="15" rx="5" ry="3.6" fill={C.bearDark} />
      <ellipse cx="0" cy="6" rx="11" ry="11.5" fill={C.bear} />
      <ellipse cx="0" cy="8" rx="6" ry="6.5" fill="#e3bf98" />
      <ellipse cx="-10" cy="4" rx="3.6" ry="5.6" fill={C.bearDark} transform="rotate(20 -10 4)" />
      <ellipse cx="10" cy="4" rx="3.6" ry="5.6" fill={C.bearDark} transform="rotate(-20 10 4)" />
      <circle cx="-7" cy="-17" r="4" fill={C.bear} />
      <circle cx="7" cy="-17" r="4" fill={C.bear} />
      <circle cx="-7" cy="-17" r="2" fill="#e3bf98" />
      <circle cx="7" cy="-17" r="2" fill="#e3bf98" />
      <circle cx="0" cy="-9" r="9.5" fill={C.bear} />
      <ellipse cx="0" cy="-6" rx="4.4" ry="3.2" fill="#e3bf98" />
      <ellipse cx="0" cy="-7.2" rx="1.6" ry="1.1" fill={C.hair} />
      {sleepy ? (
        <path d="M-5.6 -11 q 1.4 1.2 2.8 0 M2.8 -11 q 1.4 1.2 2.8 0" stroke={C.hair} strokeWidth="1" fill="none" strokeLinecap="round" />
      ) : (
        <>
          <circle cx="-3.8" cy="-11" r="1.1" fill={C.hair} />
          <circle cx="3.8" cy="-11" r="1.1" fill={C.hair} />
        </>
      )}
      <path d="M-3 0 q 3 2 6 0" stroke={C.blanketDeep} strokeWidth="1.6" fill="none" />
    </g>
  );
}

function JarLight({ light, calm }: { light: LightState; calm: boolean }) {
  const color = light === "together" ? "#f2a5b4" : C.amber;
  const glow = light === "quiet" ? 0.25 : 0.9;
  return (
    <g>
      <motion.circle
        cx="95"
        cy="289"
        r="12"
        fill={color}
        animate={light === "together" && !calm ? { opacity: [0.25, 0.6, 0.25], r: [11, 15, 11] } : { opacity: glow * 0.4, r: 12 }}
        transition={light === "together" && !calm ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : { duration: 1 }}
      />
      <rect x="86" y="279" width="18" height="19" rx="4" fill={P.cream} fillOpacity="0.28" stroke={P.cream} strokeOpacity="0.8" />
      <rect x="87" y="275" width="16" height="5" rx="1.5" fill={C.woodDark} />
      <motion.circle cx="95" cy="289" r="3.6" fill={color} animate={{ opacity: glow }} transition={{ duration: 1 }} />
    </g>
  );
}

function FairyLights({ calm }: { calm: boolean }) {
  const pts = Array.from({ length: 13 }, (_, i) => {
    const t = (i + 0.5) / 13;
    const x = (1 - t) * (1 - t) * 6 + 2 * (1 - t) * t * 200 + t * t * 394;
    const y = (1 - t) * (1 - t) * 24 + 2 * (1 - t) * t * 62 + t * t * 24;
    return { x, y, i };
  });
  return (
    <g>
      <path d="M6 24 Q 200 62 394 24" stroke="#8d6f60" strokeWidth="1" fill="none" />
      {pts.map((p) => (
        <motion.circle
          key={p.i}
          cx={p.x}
          cy={p.y + 4}
          r="3"
          fill={p.i % 3 === 0 ? "#f3b9c2" : C.amber}
          initial={{ opacity: 0.7 }}
          animate={calm ? { opacity: 0.8 } : { opacity: [0.45, 1, 0.45] }}
          transition={calm ? { duration: 0 } : { duration: 3 + (p.i % 4), repeat: Infinity, ease: "easeInOut", delay: p.i * 0.2 }}
        />
      ))}
    </g>
  );
}

function Rain({ calm }: { calm: boolean }) {
  const drops = [252, 266, 280, 294, 310, 324, 338, 352, 360];
  return (
    <g>
      <motion.g animate={calm ? {} : { y: [0, 40] }} transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}>
        {[-40, 0, 40, 80, 120].map((row) =>
          drops.map((x, i) => (
            <line
              key={`${row}-${x}`}
              x1={x + (row % 80 ? 6 : 0)}
              x2={x + (row % 80 ? 4 : -2)}
              y1={66 + row + (i % 3) * 13}
              y2={78 + row + (i % 3) * 13}
              stroke="#c9d1ee"
              strokeOpacity="0.55"
              strokeWidth="1"
            />
          )),
        )}
      </motion.g>
      {/* drops sliding down the glass */}
      {[
        { x: 262, d: 9 },
        { x: 316, d: 12 },
        { x: 346, d: 10 },
      ].map((g) => (
        <motion.ellipse
          key={g.x}
          cx={g.x}
          rx="1.6"
          ry="2.4"
          fill="#e5ebfb"
          opacity="0.75"
          initial={{ cy: 80 }}
          animate={calm ? { cy: 120 } : { cy: [72, 198] }}
          transition={calm ? { duration: 0 } : { duration: g.d, repeat: Infinity, ease: "easeIn", delay: g.d / 3 }}
        />
      ))}
    </g>
  );
}

function NightSky({ calm }: { calm: boolean }) {
  return (
    <g>
      <circle cx="334" cy="92" r="11" fill="#fdf3dc" />
      <circle cx="339" cy="88" r="10" fill="#262a4c" />
      {[
        [258, 84],
        [282, 112],
        [270, 160],
        [318, 140],
        [350, 176],
        [296, 80],
      ].map(([x, y], i) => (
        <motion.circle
          key={i}
          cx={x}
          cy={y}
          r={i % 2 ? 1.1 : 1.5}
          fill="#fdf3dc"
          animate={calm ? { opacity: 0.8 } : { opacity: [0.3, 1, 0.3] }}
          transition={calm ? { duration: 0 } : { duration: 3 + i, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </g>
  );
}

function Morning() {
  return (
    <g>
      <circle cx="300" cy="168" r="26" fill="#fcd9a6" opacity="0.8" />
      <circle cx="300" cy="168" r="44" fill="#fde7c8" opacity="0.4" />
      <path d="M252 104 q 10 -8 20 0 q 8 -6 16 2 h -36 z" fill="#fff8ef" opacity="0.9" />
      <path d="M318 86 q 8 -6 16 0 q 6 -4 12 2 h -28 z" fill="#fff8ef" opacity="0.8" />
    </g>
  );
}

function Sparkles({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <g>
      {[38, 56, 74, 92, 64, 48, 84].map((x, i) => (
        <motion.circle
          key={i}
          cx={x}
          r={1.6}
          fill={C.amber}
          initial={{ cy: 336, opacity: 0 }}
          animate={{ cy: 270 - (i % 3) * 14, opacity: [0, 1, 0] }}
          transition={{ duration: 2.4, delay: i * 0.18, ease: "easeOut" }}
        />
      ))}
    </g>
  );
}
