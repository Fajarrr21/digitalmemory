/**
 * How Today Felt — the line-art scenes and colour palette.
 *
 * Shared by the interactive canvas (client) and the read-only display used on
 * /today and in the diary (client component rendered from a server component).
 *
 * A scene is a set of `regions`. A fillable region can be tapped and painted
 * with a palette colour; a `decorative` region is stroke-only detail (steam,
 * a handle, mullions) and is never fillable. Everything is drawn with
 * `currentColor` strokes so the outline follows the ink token in both themes.
 *
 * The artwork is stored as { templateId, fills } where `fills` maps a region id
 * to a palette colour value — never a rendered image (see migration 0010).
 */

export type PaletteColor = { id: string; name: string; value: string };

/**
 * A gentle spread — warm, cool, neutral, and dark — so the day can be coloured
 * any way it *felt*, not how it scored. There is no "correct" colour.
 */
export const COLORING_PALETTE: PaletteColor[] = [
  { id: "blush", name: "Blush", value: "#f4b6bd" },
  { id: "rose", name: "Rose", value: "#e0808c" },
  { id: "coral", name: "Coral", value: "#f0a074" },
  { id: "amber", name: "Amber", value: "#f4c95d" },
  { id: "butter", name: "Butter", value: "#fbe6a2" },
  { id: "sage", name: "Sage", value: "#a6c6a0" },
  { id: "teal", name: "Teal", value: "#7dc0b4" },
  { id: "sky", name: "Sky", value: "#a9cbe8" },
  { id: "blue", name: "Blue", value: "#6f9bd1" },
  { id: "lavender", name: "Lavender", value: "#c3b0dd" },
  { id: "stone", name: "Stone", value: "#b7ada2" },
  { id: "slate", name: "Slate", value: "#7c828b" },
  { id: "charcoal", name: "Charcoal", value: "#4a464e" },
  { id: "cream", name: "Cream", value: "#fbf2e6" },
];

export const PALETTE_VALUES = new Set(COLORING_PALETTE.map((c) => c.value));

type Geom =
  | { el: "path"; d: string }
  | { el: "circle"; cx: number; cy: number; r: number }
  | { el: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { el: "rect"; x: number; y: number; width: number; height: number; rx?: number }
  | { el: "polygon"; points: string }
  | { el: "line"; x1: number; y1: number; x2: number; y2: number }
  | { el: "polyline"; points: string };

export type ColoringRegion = {
  id: string;
  geom: Geom;
  /** Stroke-only detail — not tappable, never filled. */
  decorative?: boolean;
  /** Optional SVG transform (e.g. rotate) applied to the element. */
  transform?: string;
};

export type ColoringTemplate = {
  id: string;
  /** A soft, non-prescriptive name for the scene. */
  name: string;
  viewBox: string;
  regions: ColoringRegion[];
};

export const COLORING_TEMPLATES: ColoringTemplate[] = [
  {
    id: "cup",
    name: "Secangkir hangat",
    viewBox: "0 0 200 200",
    regions: [
      { id: "saucer", geom: { el: "ellipse", cx: 100, cy: 158, rx: 58, ry: 13 } },
      { id: "cup", geom: { el: "path", d: "M62 92 L68 148 Q69 154 76 154 L124 154 Q131 154 132 148 L138 92 Z" } },
      { id: "drink", geom: { el: "ellipse", cx: 100, cy: 92, rx: 38, ry: 9 } },
      { id: "handle", decorative: true, geom: { el: "path", d: "M138 104 C165 104 165 134 130 134" } },
      { id: "steam-1", decorative: true, geom: { el: "path", d: "M88 78 C82 70 94 64 88 56" } },
      { id: "steam-2", decorative: true, geom: { el: "path", d: "M112 78 C106 70 118 64 112 56" } },
    ],
  },
  {
    id: "window",
    name: "Jendela pagi",
    viewBox: "0 0 200 200",
    regions: [
      { id: "sky", geom: { el: "rect", x: 48, y: 38, width: 104, height: 104, rx: 3 } },
      { id: "hills", geom: { el: "path", d: "M48 142 L48 118 Q80 100 110 118 Q135 132 152 116 L152 142 Z" } },
      { id: "sun", geom: { el: "circle", cx: 124, cy: 66, r: 14 } },
      { id: "sill", geom: { el: "rect", x: 38, y: 142, width: 124, height: 11, rx: 2 } },
      { id: "frame", decorative: true, geom: { el: "rect", x: 44, y: 34, width: 112, height: 112, rx: 3 } },
      { id: "mullion-v", decorative: true, geom: { el: "line", x1: 100, y1: 38, x2: 100, y2: 142 } },
      { id: "mullion-h", decorative: true, geom: { el: "line", x1: 48, y1: 90, x2: 152, y2: 90 } },
    ],
  },
  {
    id: "flower",
    name: "Bunga",
    viewBox: "0 0 200 200",
    regions: [
      { id: "pot", geom: { el: "path", d: "M76 152 L82 190 L118 190 L124 152 Z" } },
      { id: "rim", geom: { el: "rect", x: 72, y: 146, width: 56, height: 10, rx: 2 } },
      { id: "stem", decorative: true, geom: { el: "line", x1: 100, y1: 148, x2: 100, y2: 92 } },
      { id: "leaf-left", geom: { el: "path", d: "M100 132 C78 124 70 136 84 144 C93 146 100 140 100 132 Z" } },
      { id: "leaf-right", geom: { el: "path", d: "M100 120 C122 112 130 124 116 132 C107 134 100 128 100 120 Z" } },
      { id: "petal-1", transform: "rotate(0 100 70)", geom: { el: "ellipse", cx: 100, cy: 44, rx: 11, ry: 20 } },
      { id: "petal-2", transform: "rotate(72 100 70)", geom: { el: "ellipse", cx: 100, cy: 44, rx: 11, ry: 20 } },
      { id: "petal-3", transform: "rotate(144 100 70)", geom: { el: "ellipse", cx: 100, cy: 44, rx: 11, ry: 20 } },
      { id: "petal-4", transform: "rotate(216 100 70)", geom: { el: "ellipse", cx: 100, cy: 44, rx: 11, ry: 20 } },
      { id: "petal-5", transform: "rotate(288 100 70)", geom: { el: "ellipse", cx: 100, cy: 44, rx: 11, ry: 20 } },
      { id: "center", geom: { el: "circle", cx: 100, cy: 70, r: 13 } },
    ],
  },
  {
    id: "house",
    name: "Rumah kecil",
    viewBox: "0 0 200 200",
    regions: [
      { id: "sky", geom: { el: "rect", x: 20, y: 22, width: 160, height: 120 } },
      { id: "sun", geom: { el: "circle", cx: 156, cy: 50, r: 13 } },
      { id: "ground", geom: { el: "rect", x: 20, y: 142, width: 160, height: 38 } },
      { id: "tree-top", geom: { el: "circle", cx: 44, cy: 112, r: 16 } },
      { id: "tree-trunk", geom: { el: "rect", x: 40, y: 124, width: 8, height: 24 } },
      { id: "house", geom: { el: "rect", x: 60, y: 95, width: 80, height: 55 } },
      { id: "roof", geom: { el: "polygon", points: "54,95 100,60 146,95" } },
      { id: "door", geom: { el: "rect", x: 90, y: 116, width: 20, height: 34, rx: 1 } },
      { id: "window", geom: { el: "rect", x: 68, y: 106, width: 18, height: 18 } },
    ],
  },
  {
    id: "two-cups",
    name: "Berdua",
    viewBox: "0 0 200 200",
    regions: [
      { id: "table", geom: { el: "ellipse", cx: 100, cy: 166, rx: 72, ry: 14 } },
      { id: "cup-left", geom: { el: "path", d: "M40 112 L45 150 Q46 156 52 156 L84 156 Q90 156 91 150 L96 112 Z" } },
      { id: "drink-left", geom: { el: "ellipse", cx: 68, cy: 112, rx: 28, ry: 6 } },
      { id: "cup-right", geom: { el: "path", d: "M104 112 L109 150 Q110 156 116 156 L148 156 Q154 156 155 150 L160 112 Z" } },
      { id: "drink-right", geom: { el: "ellipse", cx: 132, cy: 112, rx: 28, ry: 6 } },
      { id: "heart", geom: { el: "path", d: "M100 72 C94 62 78 64 78 78 C78 90 100 102 100 102 C100 102 122 90 122 78 C122 64 106 62 100 72 Z" } },
      { id: "handle-left", decorative: true, geom: { el: "path", d: "M96 122 C116 122 116 144 90 144" } },
      { id: "handle-right", decorative: true, geom: { el: "path", d: "M104 122 C84 122 84 144 110 144" } },
    ],
  },
  {
    id: "night",
    name: "Malam",
    viewBox: "0 0 200 200",
    regions: [
      { id: "sky", geom: { el: "rect", x: 15, y: 15, width: 170, height: 140 } },
      { id: "moon", geom: { el: "circle", cx: 140, cy: 55, r: 22 } },
      { id: "star-1", geom: { el: "polygon", points: "45,40 50,45 45,50 40,45" } },
      { id: "star-2", geom: { el: "polygon", points: "76,68 80,72 76,76 72,72" } },
      { id: "star-3", geom: { el: "polygon", points: "104,38 109,43 104,48 99,43" } },
      { id: "star-4", geom: { el: "polygon", points: "60,98 64,102 60,106 56,102" } },
      { id: "hills", geom: { el: "path", d: "M15 155 L15 130 Q55 105 100 128 Q145 150 185 122 L185 155 Z" } },
      { id: "ground", geom: { el: "rect", x: 15, y: 155, width: 170, height: 30 } },
    ],
  },
];

const TEMPLATE_BY_ID = new Map(COLORING_TEMPLATES.map((t) => [t.id, t]));

export function getTemplate(id: string): ColoringTemplate | undefined {
  return TEMPLATE_BY_ID.get(id);
}

/** A random scene — the day is not literally drawn, just given a canvas. */
export function randomTemplate(): ColoringTemplate {
  return COLORING_TEMPLATES[Math.floor(Math.random() * COLORING_TEMPLATES.length)];
}

/** Region ids that can actually be painted, for validating a saved fill map. */
export function fillableIds(template: ColoringTemplate): Set<string> {
  return new Set(template.regions.filter((r) => !r.decorative).map((r) => r.id));
}
