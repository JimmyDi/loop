import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";

import { readPreference, writePreference } from "../lib/preferences";

export const clampWidth = (width: number) =>
  Number.isFinite(width) ? Math.min(420, Math.max(240, width)) : 240;

export const useSidebarWidth = () => {
  const [width, setWidth] = useState(() => clampWidth(readPreference("sidebarWidth", 280)));
  const dragStart = useRef({ x: 0, width });

  useEffect(() => writePreference("sidebarWidth", width), [width]);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    dragStart.current = { x: event.clientX, width };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      setWidth(clampWidth(dragStart.current.width + event.clientX - dragStart.current.x));
  };

  return {
    width,
    setWidth: (value: number) => setWidth(clampWidth(value)),
    onPointerDown,
    onPointerMove,
  };
};
