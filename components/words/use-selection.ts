"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * The text currently selected inside `ref` (a reading view), or "" — used for
 * "♡ keep this line" and "make a card from this". Listens to selectionchange
 * so it works for mouse, touch handles and keyboard alike.
 */
export function useSelectionIn(ref: RefObject<HTMLElement | null>): [string, () => void] {
  const [text, setText] = useState("");

  useEffect(() => {
    function onChange() {
      const sel = typeof window !== "undefined" ? window.getSelection() : null;
      const el = ref.current;
      if (!sel || !el || sel.rangeCount === 0 || sel.isCollapsed) {
        setText("");
        return;
      }
      const range = sel.getRangeAt(0);
      if (!el.contains(range.commonAncestorContainer)) {
        setText("");
        return;
      }
      setText(sel.toString().trim().slice(0, 600));
    }
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, [ref]);

  const clear = () => {
    window.getSelection()?.removeAllRanges();
    setText("");
  };
  return [text, clear];
}
