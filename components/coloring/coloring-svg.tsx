"use client";

import { cn } from "@/lib/utils";
import type { ColoringRegion, ColoringTemplate } from "@/app/(app)/today/coloring-config";

export type Fills = Record<string, string>;

/**
 * Renders a coloring scene from a template + a region→colour map.
 *
 * Two modes:
 *  - display (default): read-only artwork, uncoloured regions show through as the
 *    card background (transparent).
 *  - interactive: fillable regions are tappable and call `onPick(regionId)`.
 *
 * Strokes use `currentColor`, so wrap this with an ink-toned text colour
 * (defaults to `text-ink`) and it reads correctly in light and dark.
 */
export function ColoringSvg({
  template,
  fills,
  interactive = false,
  onPick,
  className,
}: {
  template: ColoringTemplate;
  fills: Fills;
  interactive?: boolean;
  onPick?: (regionId: string) => void;
  className?: string;
}) {
  return (
    <svg
      viewBox={template.viewBox}
      className={cn("text-ink", className)}
      role="img"
      aria-label={`Coloring: ${template.name}`}
    >
      {template.regions.map((r) => (
        <RegionEl
          key={r.id}
          region={r}
          fill={fills[r.id]}
          interactive={interactive}
          onPick={onPick}
        />
      ))}
    </svg>
  );
}

function RegionEl({
  region,
  fill,
  interactive,
  onPick,
}: {
  region: ColoringRegion;
  fill: string | undefined;
  interactive: boolean;
  onPick?: (regionId: string) => void;
}) {
  const g = region.geom;
  const tappable = interactive && !region.decorative;

  const common: React.SVGProps<SVGElement> & { [k: string]: unknown } = {
    transform: region.transform,
    fill: region.decorative ? "none" : fill ?? "transparent",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinejoin: "round",
    strokeLinecap: "round",
    vectorEffect: "non-scaling-stroke",
  };

  if (tappable) {
    // A transparent fill still needs pointer-events to catch taps.
    common.style = { cursor: "pointer", pointerEvents: "all" };
    common.onClick = () => onPick?.(region.id);
    common.role = "button";
    common.tabIndex = 0;
    common.onKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onPick?.(region.id);
      }
    };
  } else {
    common["aria-hidden"] = true;
  }

  switch (g.el) {
    case "path":
      return <path d={g.d} {...(common as React.SVGProps<SVGPathElement>)} />;
    case "circle":
      return <circle cx={g.cx} cy={g.cy} r={g.r} {...(common as React.SVGProps<SVGCircleElement>)} />;
    case "ellipse":
      return (
        <ellipse cx={g.cx} cy={g.cy} rx={g.rx} ry={g.ry} {...(common as React.SVGProps<SVGEllipseElement>)} />
      );
    case "rect":
      return (
        <rect
          x={g.x}
          y={g.y}
          width={g.width}
          height={g.height}
          rx={g.rx}
          {...(common as React.SVGProps<SVGRectElement>)}
        />
      );
    case "polygon":
      return <polygon points={g.points} {...(common as React.SVGProps<SVGPolygonElement>)} />;
    case "line":
      return <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} {...(common as React.SVGProps<SVGLineElement>)} />;
    case "polyline":
      return <polyline points={g.points} {...(common as React.SVGProps<SVGPolylineElement>)} />;
    default:
      return null;
  }
}
