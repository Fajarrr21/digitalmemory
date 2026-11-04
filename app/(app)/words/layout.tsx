import { Cormorant_Garamond, Playfair_Display } from "next/font/google";
import { WordsMusic } from "@/components/words/words-music";

/**
 * little words. — two extra typefaces, loaded only on /words: Cormorant
 * Garamond (classic serif) and Playfair Display (editorial). The app's own
 * Fraunces / Instrument Sans / Caveat cover elegant serif, minimal sans and
 * handwritten. Variables are set on this wrapper (not <html>), so the card
 * renderer resolves them from the studio element.
 */
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  weight: ["400", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

export default function WordsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-words-root className={`${cormorant.variable} ${playfair.variable}`}>
      {children}
      {/* The soundtrack (Nadin Amizah – Ah · Tulus – Jatuh Suka) keeps playing across /words pages. */}
      <WordsMusic />
    </div>
  );
}
