"use client";

import { motion, useReducedMotion } from "motion/react";

// 🏠 "Building Our Someday" — lapisan visual yang tumbuh sepanjang perjalanan.
// Semua ilustrasi bergaya coretan garis minimalis (bukan foto), hingga di ending
// elemen-elemennya berkumpul menjadi sebuah rumah kecil: simbol kenangan masa
// depan yang belum terjadi. Tidak menyentuh alur/teks chapter — murni visual.

const STROKE = 2.2;

// Garis yang "tergambar sendiri" (pathLength). reduce = tampil penuh langsung.
function Draw({
  d,
  delay = 0,
  duration = 1.2,
  reduce,
  ...rest
}: {
  d: string;
  delay?: number;
  duration?: number;
  reduce: boolean | null;
} & Pick<React.SVGProps<SVGPathElement>, "stroke" | "opacity" | "className">) {
  return (
    <motion.path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={reduce ? false : { pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ delay, duration, ease: "easeInOut" }}
      {...rest}
    />
  );
}

// ── Sketsa yang tumbuh (persisten, menempel di bawah layar) ───────────────────
// Muncul pelan seiring chapter selesai. Sengaja tipis biar tak melawan teks.

export function GrowingSketch({ scene }: { scene: number }) {
  const reduce = useReducedMotion();
  const fade = (on: boolean) => ({
    animate: { opacity: on ? 1 : 0 },
    transition: { duration: 1.1, ease: "easeInOut" as const },
    initial: reduce ? false : { opacity: 0 },
  });

  // Posisi "dua orang": scene 1 berjauhan, scene ≥ 2 berdampingan.
  const together = scene >= 2;
  const leftX = together ? 186 : 150;
  const rightX = together ? 214 : 250;

  return (
    <svg
      viewBox="0 0 400 200"
      className="h-full w-full text-ink-faint"
      fill="none"
      aria-hidden
      preserveAspectRatio="xMidYMax meet"
    >
      {/* garis tanah */}
      <motion.line
        x1="40"
        y1="162"
        x2="360"
        y2="162"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: scene >= 1 ? 0.7 : 0.3 }}
        transition={{ duration: 1.4, ease: "easeInOut" }}
      />

      {/* satu titik di pembuka */}
      <motion.circle cx="200" cy="152" r="4" fill="currentColor" {...fade(scene === 0)} />

      {/* dua orang (titik) — mendekat di scene ≥ 2 */}
      <motion.circle
        cy="152"
        r="4.5"
        fill="currentColor"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: scene >= 1 ? 1 : 0, cx: leftX }}
        transition={{ duration: 1.1, ease: "easeInOut" }}
      />
      <motion.circle
        cy="152"
        r="4.5"
        fill="currentColor"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: scene >= 1 ? 1 : 0, cx: rightX }}
        transition={{ duration: 1.1, ease: "easeInOut" }}
      />

      {/* meja + dua kursi + dua gelas (A Simple Day) */}
      <motion.g {...fade(scene >= 2)}>
        <Draw d="M120 150 h34" reduce={reduce} />
        <Draw d="M124 150 v10 M150 150 v10" reduce={reduce} delay={0.15} />
        <Draw d="M110 138 v22 M110 138 h8" reduce={reduce} delay={0.3} />
        <Draw d="M164 138 v22 M164 138 h-8" reduce={reduce} delay={0.3} />
        <Draw d="M128 146 a4 4 0 0 0 8 0" reduce={reduce} delay={0.45} />
        <Draw d="M140 146 a4 4 0 0 0 8 0" reduce={reduce} delay={0.55} />
      </motion.g>

      {/* jendela kecil melayang dengan langit yang berubah pelan */}
      <motion.g {...fade(scene >= 3)}>
        <motion.rect
          x="256"
          y="96"
          width="34"
          height="34"
          rx="2"
          initial={{ fill: "#bcd0e0" }}
          animate={
            reduce
              ? undefined
              : { fill: ["#bcd0e0", "#f4d0b0", "#c7b6d8", "#bcd0e0"] }
          }
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          opacity={0.55}
        />
        <Draw d="M256 96 h34 v34 h-34 z" reduce={reduce} />
        <Draw d="M273 96 v34 M256 113 h34" reduce={reduce} delay={0.3} />
      </motion.g>

      {/* kamera kecil di atas tripod (Our First Photo) */}
      <motion.g {...fade(scene >= 4)}>
        <Draw d="M96 120 h26 v16 h-26 z" reduce={reduce} />
        <Draw d="M122 124 l8 -4 v20 l-8 -4" reduce={reduce} delay={0.2} />
        <Draw d="M109 136 v18 M109 154 l-7 6 M109 154 l7 6" reduce={reduce} delay={0.35} />
      </motion.g>

      {/* tanaman kecil di sepanjang tanah (Someday List) */}
      <motion.g {...fade(scene >= 5)} className="text-accent-ink">
        <Draw d="M70 162 v-12 M70 154 l-5 -3 M70 156 l5 -3" reduce={reduce} stroke="currentColor" />
        <Draw d="M320 162 v-14 M320 152 l-5 -3 M320 154 l5 -4" reduce={reduce} delay={0.2} stroke="currentColor" />
        <Draw d="M300 162 v-9 M300 156 l-4 -2 M300 158 l4 -3" reduce={reduce} delay={0.35} stroke="currentColor" />
      </motion.g>

      {/* cahaya lampu hangat (bab reassurance) */}
      <motion.circle
        cx="137"
        cy="132"
        r="16"
        fill="#ffcf8a"
        {...fade(scene >= 6)}
        style={{ filter: "blur(6px)" }}
      />
    </svg>
  );
}

// ── Kilat kamera (dipakai di chapter Our First Photo) ─────────────────────────

export function CameraSketch({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <svg
      viewBox="0 0 60 44"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 14h8l3-4h14l3 4h8a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V17a3 3 0 0 1 3-3z" />
      <circle cx="30" cy="27" r="8" />
      <motion.circle
        cx="30"
        cy="27"
        r="3.5"
        fill="currentColor"
        stroke="none"
        animate={reduce ? undefined : { opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2.4, repeat: Infinity }}
      />
    </svg>
  );
}

// ── Rumah kecil di ending — payoff dari semua elemen tadi ──────────────────────

export function HouseDiorama() {
  const reduce = useReducedMotion();

  return (
    <svg
      viewBox="0 0 400 240"
      className="h-full w-full"
      fill="none"
      aria-hidden
      preserveAspectRatio="xMidYMax slice"
    >
      <defs>
        <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e1830" stopOpacity="0" />
          <stop offset="45%" stopColor="#2c2340" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#7c5560" stopOpacity="0.95" />
        </linearGradient>
        <radialGradient id="lamp" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd79a" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffd79a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* langit senja yang muncul pelan */}
      <motion.rect
        x="0"
        y="0"
        width="400"
        height="240"
        fill="url(#dusk)"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2.4, ease: "easeOut" }}
      />

      {/* bulan + bintang berkedip lembut */}
      <motion.circle
        cx="320"
        cy="52"
        r="12"
        fill="#f6eccf"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 0.9 }}
        transition={{ delay: 1.2, duration: 1.6 }}
      />
      {[
        [70, 44],
        [120, 70],
        [200, 40],
        [260, 66],
        [350, 90],
        [40, 96],
      ].map(([cx, cy], i) => (
        <motion.circle
          key={i}
          cx={cx}
          cy={cy}
          r="1.6"
          fill="#f6eccf"
          initial={reduce ? false : { opacity: 0 }}
          animate={reduce ? { opacity: 0.8 } : { opacity: [0.2, 0.9, 0.2] }}
          transition={{
            delay: 1 + i * 0.2,
            duration: 3 + i * 0.4,
            repeat: reduce ? 0 : Infinity,
          }}
        />
      ))}

      {/* seluruh homestead: zoom-out lembut */}
      <motion.g
        className="text-ink"
        style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
        initial={reduce ? false : { scale: 1.12, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 2.6, ease: "easeOut" }}
      >
        {/* tanah */}
        <Draw d="M20 196 H380" reduce={reduce} duration={1.6} />

        {/* jalan setapak menuju pintu */}
        <Draw d="M200 196 L176 232 M200 196 L224 232" reduce={reduce} delay={0.4} />

        {/* badan rumah */}
        <Draw d="M150 196 V120 H250 V196" reduce={reduce} delay={0.7} duration={1.4} />
        {/* atap */}
        <Draw d="M138 122 L200 78 L262 122 Z" reduce={reduce} delay={1.1} duration={1.4} />
        {/* cerobong */}
        <Draw d="M228 98 V80 h12 V108" reduce={reduce} delay={1.5} />
        {/* pintu */}
        <Draw d="M190 196 V158 h20 V196" reduce={reduce} delay={1.6} />
        <motion.circle
          cx="205"
          cy="178"
          r="1.6"
          fill="currentColor"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.1, duration: 0.6 }}
        />

        {/* cahaya jendela yang hangat + bingkai (echo jendela sketsa) */}
        <motion.circle
          cx="177"
          cy="146"
          r="26"
          fill="url(#lamp)"
          initial={reduce ? false : { opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { opacity: [0.65, 1, 0.65] }}
          transition={
            reduce
              ? { delay: 1.8, duration: 0.8 }
              : { delay: 1.8, duration: 4, repeat: Infinity, ease: "easeInOut" }
          }
        />
        <motion.rect
          x="165"
          y="134"
          width="24"
          height="24"
          rx="1.5"
          fill="#ffdca6"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 0.9 }}
          transition={{ delay: 1.9, duration: 1 }}
        />
        <Draw d="M165 134 h24 v24 h-24 z" reduce={reduce} delay={1.4} />
        <Draw d="M177 134 v24 M165 146 h24" reduce={reduce} delay={1.7} />

        {/* dua tanaman kecil mengapit (echo Someday List) */}
        <motion.g
          className="text-accent-ink"
          style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
          animate={reduce ? undefined : { rotate: [0, 3, 0, -3, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <Draw d="M120 196 v-18 M120 184 l-7 -5 M120 188 l7 -6" reduce={reduce} delay={2} stroke="currentColor" />
        </motion.g>
        <motion.g
          className="text-accent-ink"
          style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
          animate={reduce ? undefined : { rotate: [0, -3, 0, 3, 0] }}
          transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Draw d="M282 196 v-16 M282 186 l-6 -4 M282 190 l6 -5" reduce={reduce} delay={2.15} stroke="currentColor" />
        </motion.g>

        {/* dua sosok kecil di depan pintu (echo dua titik) */}
        <motion.circle
          cx="238"
          cy="190"
          r="3.4"
          fill="currentColor"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 0.85 }}
          transition={{ delay: 2.4, duration: 1 }}
        />
        <motion.circle
          cx="248"
          cy="190"
          r="3.4"
          fill="currentColor"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 0.85 }}
          transition={{ delay: 2.6, duration: 1 }}
        />
      </motion.g>
    </svg>
  );
}
