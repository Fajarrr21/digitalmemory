"use client";

import { cn } from "@/lib/utils";
import { ALL_FRAMES, isFrameUnlocked, type BoothFrame } from "./photobooth-config";

/** "Choose a frame" — every frame, milestone ones locked until earned. */
export function FramePicker({
  value,
  onChange,
  bestFlameDay,
  disabled = false,
}: {
  value: string;
  onChange: (id: string) => void;
  bestFlameDay: number;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {ALL_FRAMES.map((f) => {
        const unlocked = isFrameUnlocked(f, bestFlameDay);
        const active = value === f.id;
        return (
          <button
            key={f.id}
            type="button"
            disabled={disabled || !unlocked}
            onClick={() => onChange(f.id)}
            aria-pressed={active}
            title={unlocked ? f.tagline : `Terbuka di flame Day ${f.milestoneDay}`}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition",
              active ? "border-accent-ink/60 bg-blush/30" : "border-rule bg-paper hover:border-accent-ink/40",
              !unlocked && "opacity-45",
            )}
          >
            <FrameSwatch frame={f} locked={!unlocked} />
            <span className="text-xs text-ink">{unlocked ? f.name : `🔒 ${f.name}`}</span>
            <span className="text-[10px] leading-tight text-ink-faint">
              {unlocked ? f.tagline : `Day ${f.milestoneDay}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FrameSwatch({ frame, locked }: { frame: BoothFrame; locked: boolean }) {
  return (
    <span
      aria-hidden
      className="flex h-12 w-full items-center justify-center rounded-lg border text-xl"
      style={{
        background: `linear-gradient(160deg, ${frame.bgTop}, ${frame.bgBottom})`,
        borderColor: frame.paperBorder,
      }}
    >
      {locked ? "🔒" : frame.emoji}
    </span>
  );
}
