"use client";

import { useEffect, useRef } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  fontFamily: "inherit",
});

export function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let cancelled = false;
    const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
    mermaid
      .render(id, chart)
      .then(({ svg }) => {
        if (!cancelled) el.innerHTML = svg;
      })
      .catch((err) => {
        if (!cancelled) console.error("Mermaid render failed:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [chart]);

  return <div ref={ref} className="my-4 flex justify-center [&_svg]:max-w-full" />;
}
