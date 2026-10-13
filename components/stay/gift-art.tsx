import type { StayGiftKind, StayObjectKind } from "@/lib/supabase/database.types";

/**
 * stay, my love. — the little gifts, drawn. Each is a group of shapes in a
 * 40×40 box centred on (20, 20), so the same drawing sits tiny on the bedside
 * table inside the room's SVG and large in the opened-gift sheet.
 */

export const P = {
  cream: "#fff6ec",
  paper: "#f8ecdc",
  paperEdge: "#e3cdb6",
  pink: "#e7a9b4",
  pinkDeep: "#c97f8e",
  cocoa: "#5b3d33",
  amber: "#f2c27e",
  lavender: "#b9a8cf",
  lavenderDeep: "#8f7cad",
  gold: "#ecd28f",
  green: "#9db58c",
};

export function giftShapes(kind: StayGiftKind, objectKind: StayObjectKind | null) {
  if (kind === "note") {
    return (
      <g>
        <path d="M8 12 L30 9 L33 29 L11 32 Z" fill={P.paper} stroke={P.paperEdge} strokeWidth="1" strokeLinejoin="round" />
        <path d="M9.5 21 L31.5 18.5" stroke={P.paperEdge} strokeWidth="0.8" />
        <path d="M13 14.5 h12 M13.5 17 h9" stroke={P.cocoa} strokeOpacity="0.35" strokeWidth="0.8" strokeLinecap="round" />
        <path d="M21 25.6c-1.4-1-2.6-1.9-2.6-3 0-.8.6-1.3 1.3-1.3.5 0 1 .3 1.3.7.3-.4.8-.7 1.3-.7.7 0 1.3.5 1.3 1.3 0 1.1-1.2 2-2.6 3z" fill={P.pinkDeep} />
      </g>
    );
  }
  if (kind === "comfort") {
    return (
      <g>
        <rect x="7" y="12" width="26" height="18" rx="2" fill={P.cream} stroke={P.paperEdge} strokeWidth="1" />
        <path d="M7.5 12.5 L20 22 L32.5 12.5" fill="none" stroke={P.paperEdge} strokeWidth="1" />
        <path d="M20 12 v18" stroke={P.pink} strokeWidth="2" opacity="0.8" />
        <circle cx="20" cy="22" r="3.2" fill={P.amber} stroke="#d9a35e" strokeWidth="0.8" />
      </g>
    );
  }
  if (kind === "voice") {
    return (
      <g>
        <circle cx="20" cy="20" r="13" fill={P.lavender} />
        <circle cx="20" cy="20" r="13" fill="none" stroke={P.lavenderDeep} strokeWidth="1" />
        <path
          d="M12 20 v0 M15 17 v6 M18 14 v12 M21 16 v8 M24 13 v14 M27 18 v4"
          stroke={P.cream}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </g>
    );
  }
  switch (objectKind) {
    case "flower":
      return (
        <g>
          <path d="M20 22 C 20 28, 19 31, 18 34" stroke={P.green} strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M19 29 c -3 -1 -5 0 -6 2 c 3 1 5 0 6 -2z" fill={P.green} />
          {[0, 72, 144, 216, 288].map((r) => (
            <ellipse key={r} cx="20" cy="13.5" rx="3.6" ry="5" fill={P.pink} transform={`rotate(${r} 20 18)`} />
          ))}
          <circle cx="20" cy="18" r="2.6" fill={P.amber} />
        </g>
      );
    case "heart":
      return (
        <g>
          <circle cx="20" cy="20" r="15" fill={P.pink} opacity="0.22" />
          <path d="M20 30c-5.5-3.8-9.5-7.3-9.5-11.3 0-3 2.3-5 4.8-5 2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 2.5 0 4.8 2 4.8 5 0 4-4 7.5-9.5 11.3z" fill={P.pinkDeep} />
          <path d="M15 17.5c.5-1.3 1.6-2 2.7-2" stroke={P.cream} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.8" />
        </g>
      );
    case "star":
      return (
        <g>
          <path
            d="M20 7.5 l3.7 7.6 8.3 1.2 -6 5.8 1.4 8.3 -7.4 -3.9 -7.4 3.9 1.4 -8.3 -6 -5.8 8.3 -1.2z"
            fill={P.gold}
            stroke="#cfb067"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <path
            d="M20 11 l2.6 5.2 5.7 .8 -4.1 4 1 5.7 -5.2 -2.7 -5.2 2.7 1 -5.7 -4.1 -4 5.7 -.8z"
            fill="none"
            stroke={P.cream}
            strokeWidth="0.7"
            strokeDasharray="1.2 1.4"
          />
          <circle cx="17.5" cy="19" r="0.9" fill={P.cocoa} />
          <circle cx="22.5" cy="19" r="0.9" fill={P.cocoa} />
        </g>
      );
    case "crane":
      return (
        <g strokeLinejoin="round">
          <path d="M6 22 L18 18 L20 26 Z" fill={P.pink} />
          <path d="M18 18 L34 12 L22 22 Z" fill={P.cream} stroke={P.paperEdge} strokeWidth="0.8" />
          <path d="M18 18 L20 26 L28 25 L22 22 Z" fill={P.pinkDeep} opacity="0.85" />
          <path d="M28 25 L33 18 L31 25 Z" fill={P.pink} />
        </g>
      );
    case "moon":
    default:
      return (
        <g>
          <path d="M20 4 v7" stroke={P.paperEdge} strokeWidth="0.8" />
          <path d="M24 12a10 10 0 1 0 6 15.5a8 8 0 1 1 -6 -15.5z" fill={P.gold} stroke="#cfb067" strokeWidth="1" />
          <circle cx="29" cy="13" r="0.9" fill={P.gold} />
        </g>
      );
  }
}

/** A standalone drawing for the sheet / the creator. */
export function GiftArt({
  kind,
  objectKind = null,
  className,
  title,
}: {
  kind: StayGiftKind;
  objectKind?: StayObjectKind | null;
  className?: string;
  title?: string;
}) {
  return (
    <svg viewBox="0 0 40 40" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      {giftShapes(kind, objectKind)}
    </svg>
  );
}
