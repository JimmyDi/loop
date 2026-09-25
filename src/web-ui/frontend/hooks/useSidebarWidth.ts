import { useEffect, useState } from "react";
import type { PointerEvent } from "react";

import { readPreference, writePreference } from "../lib/preferences";

export const clampWidth = (width: number) =>
  Number.isFinite(width) ? Math.min(420, Math.max(260, width)) : 260;

export const useSidebarWidth = () => {
  const [width, setWidth] = useState(() => clampWidth(readPreference("sidebarWidth", 260)));

  useEffect(() => writePreference("sidebarWidth", width), [width]);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) setWidth(clampWidth(event.clientX));
  };

  return {
    width,
    setWidth: (value: number) => setWidth(clampWidth(value)),
    onPointerDown,
    onPointerMove,
  };
};
