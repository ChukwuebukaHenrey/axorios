"use client";

import { useEffect } from "react";

export const SELECT_SECTION_MESSAGE = "axorios:select-section";

/** Inside the builder's preview: clicking a section selects it, and links don't navigate away. */
export function DraftBridge() {
  useEffect(() => {
    if (window.parent === window) return;
    let highlighted: HTMLElement | null = null;

    function onClick(event: MouseEvent) {
      const wrapper = (event.target as Element).closest<HTMLElement>("[data-section-id]");
      if (!wrapper) return;
      event.preventDefault();

      if (highlighted) highlighted.style.outline = "";
      highlighted = wrapper.firstElementChild as HTMLElement | null;
      if (highlighted) {
        highlighted.style.outline = "3px solid #F97316";
        highlighted.style.outlineOffset = "-3px";
      }
      window.parent.postMessage({ type: SELECT_SECTION_MESSAGE, id: wrapper.dataset.sectionId }, window.location.origin);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
