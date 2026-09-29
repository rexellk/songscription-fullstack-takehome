"use client";

import { useEffect, useRef, useState } from "react";

/** Measures its own box and hands the height to a child that needs a number (a canvas). */
export function FillHeight({ children, min = 160 }: { children: (height: number) => React.ReactNode; min?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(min);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setHeight(Math.max(min, Math.floor(entry.contentRect.height))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return (
    <div ref={box} className="h-full w-full">
      {children(height)}
    </div>
  );
}
