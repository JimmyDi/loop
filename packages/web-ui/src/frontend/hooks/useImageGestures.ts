import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

type Position = { x: number; y: number; scale: number };
const initial: Position = { x: 0, y: 0, scale: 1 };

export const useImageGestures = (source?: string) => {
  const ref = useRef<HTMLDivElement>(null);
  const position = useRef<Position>({ ...initial });
  const suppressedUntil = useRef(0);
  const [zoomed, setZoomed] = useState(false);
  const update = (next: Position) => {
    const element = ref.current;
    const image = element?.querySelector("img");
    if (!element || !image) return;
    const limitX = Math.max(0, (image.clientWidth * next.scale - element.clientWidth) / 2);
    const limitY = Math.max(0, (image.clientHeight * next.scale - element.clientHeight) / 2);
    position.current = {
      scale: next.scale,
      x: Math.max(-limitX, Math.min(limitX, next.x)),
      y: Math.max(-limitY, Math.min(limitY, next.y)),
    };
    const { x, y, scale } = position.current;
    image.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    setZoomed(scale > 1);
  };
  useEffect(() => {
    const element = ref.current;
    if (!element || !source) return;
    position.current = { ...initial };
    suppressedUntil.current = 0;
    setZoomed(false);
    const image = element.querySelector("img");
    if (image) image.style.transform = "";
    let start: { x: number; y: number; distance: number; position: Position } | undefined;
    let moved = false;
    const measure = (touches: TouchList) => {
      const a = touches[0]!;
      const b = touches[1] ?? a;
      const bounds = element.getBoundingClientRect();
      return {
        x: (a.clientX + b.clientX) / 2 - bounds.left - bounds.width / 2,
        y: (a.clientY + b.clientY) / 2 - bounds.top - bounds.height / 2,
        distance: touches.length > 1 ? Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) : 0,
      };
    };
    const begin = (event: TouchEvent) => {
      if (!event.touches.length) {
        start = undefined;
        if (moved) suppressedUntil.current = Date.now() + 700;
        return;
      }
      if (event.touches.length > 1) {
        event.preventDefault();
        moved = true;
      }
      start = { ...measure(event.touches), position: { ...position.current } };
    };
    const move = (event: TouchEvent) => {
      if (!start || !event.touches.length) return;
      if (event.touches.length === 1 && position.current.scale === 1) return;
      event.preventDefault();
      const current = measure(event.touches);
      const scale =
        start.distance > 0 && current.distance > 0
          ? Math.max(1, Math.min(8, (start.position.scale * current.distance) / start.distance))
          : start.position.scale;
      const ratio = scale / start.position.scale;
      if (
        Math.hypot(current.x - start.x, current.y - start.y) > 3 ||
        scale !== start.position.scale
      )
        moved = true;
      update({
        scale,
        x: current.x - (start.x - start.position.x) * ratio,
        y: current.y - (start.y - start.position.y) * ratio,
      });
    };
    const down = (event: TouchEvent) => {
      if (event.touches.length === 1) moved = false;
      begin(event);
    };
    const cancel = () => {
      start = undefined;
      suppressedUntil.current = Date.now() + 700;
    };
    const resize = () => update(position.current);
    let drag: { x: number; y: number; position: Position } | undefined;
    const pointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0 || position.current.scale <= 1)
        return;
      drag = { x: event.clientX, y: event.clientY, position: { ...position.current } };
      element.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      if (!drag) return;
      const x = event.clientX - drag.x;
      const y = event.clientY - drag.y;
      if (Math.hypot(x, y) > 3) suppressedUntil.current = Date.now() + 700;
      update({ ...drag.position, x: drag.position.x + x, y: drag.position.y + y });
    };
    const pointerEnd = () => {
      drag = undefined;
    };
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(resize);
    observer?.observe(element);
    element.addEventListener("touchstart", down, { passive: false });
    element.addEventListener("touchmove", move, { passive: false });
    element.addEventListener("touchend", begin);
    element.addEventListener("touchcancel", cancel);
    element.addEventListener("pointerdown", pointerDown);
    element.addEventListener("pointermove", pointerMove);
    element.addEventListener("pointerup", pointerEnd);
    element.addEventListener("lostpointercapture", pointerEnd);
    return () => {
      observer?.disconnect();
      element.removeEventListener("touchstart", down);
      element.removeEventListener("touchmove", move);
      element.removeEventListener("touchend", begin);
      element.removeEventListener("touchcancel", cancel);
      element.removeEventListener("pointerdown", pointerDown);
      element.removeEventListener("pointermove", pointerMove);
      element.removeEventListener("pointerup", pointerEnd);
      element.removeEventListener("lostpointercapture", pointerEnd);
    };
  }, [source]);
  return {
    ref,
    zoomed,
    toggle: (event: MouseEvent<HTMLButtonElement>) => {
      if (Date.now() < suppressedUntil.current) return;
      const image = ref.current?.querySelector("img");
      const scale =
        position.current.scale > 1
          ? 1
          : Math.max(2, (image?.naturalWidth ?? 0) / (image?.clientWidth || 1));
      const bounds = ref.current?.getBoundingClientRect();
      const point =
        bounds && event.detail !== 0
          ? {
              x: event.clientX - bounds.left - bounds.width / 2,
              y: event.clientY - bounds.top - bounds.height / 2,
            }
          : { x: 0, y: 0 };
      update({ x: point.x * (1 - scale), y: point.y * (1 - scale), scale });
    },
  };
};
