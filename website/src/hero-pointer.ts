import { createPointerField } from "./hero-pointer-field";
import type { ClearArea } from "./hero-pointer-field";

export const initializeHeroPointer = (
  host: HTMLElement,
  canvas: HTMLCanvasElement,
): (() => void) => {
  const page = host.ownerDocument;
  const view = page.defaultView;
  if (!view) {
    return () => {};
  }

  const pointer = view.matchMedia("(any-hover: hover) and (any-pointer: fine)");
  const motion = view.matchMedia("(prefers-reduced-motion: reduce)");
  const field = createPointerField();
  let context: CanvasRenderingContext2D | null = null;
  let areas: ClearArea[] = [];
  let width = 0;
  let height = 0;
  let frame = 0;
  let lastInput = -Infinity;
  let lastPaint = -Infinity;

  const enabled = (): boolean => pointer.matches && !motion.matches && !page.hidden;

  const clear = (): void => {
    view.cancelAnimationFrame(frame);
    frame = 0;
    field.clear();
    lastInput = -Infinity;
    context?.clearRect(0, 0, width, height);
  };

  const updateAreas = (bounds: DOMRect): void => {
    areas = Array.from(host.querySelectorAll("[data-pointer-clear]"), (element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left - bounds.left - 14,
        right: rect.right - bounds.left + 14,
        top: rect.top - bounds.top - 12,
        bottom: rect.bottom - bounds.top + 12,
      };
    });
  };

  const resize = (): void => {
    clear();
    const bounds = host.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const scale = Math.min(view.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context?.setTransform(scale, 0, 0, scale, 0, 0);
    updateAreas(bounds);
  };

  const paint = (time: number): void => {
    frame = 0;
    if (!enabled() || !context) {
      clear();
      return;
    }
    if (time - lastPaint >= 30) {
      lastPaint = time;
      context.clearRect(0, 0, width, height);
      field.paint(context, time);
    }
    if (field.active()) {
      frame = view.requestAnimationFrame(paint);
    }
  };

  const move = (event: PointerEvent): void => {
    if (!enabled() || event.pointerType !== "mouse") {
      return;
    }
    const now = view.performance.now();
    if (now - lastInput < 35) {
      return;
    }
    lastInput = now;
    const bounds = host.getBoundingClientRect();
    updateAreas(bounds);
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    field.add(x, y, now, width, height, areas);
    if (field.active() && !frame) {
      frame = view.requestAnimationFrame(paint);
    }
  };

  const refresh = (): void => {
    if (enabled() && !context) {
      context = canvas.getContext("2d");
    }
    resize();
  };

  const observer = new view.ResizeObserver(resize);
  observer.observe(host);
  host.addEventListener("pointermove", move, { passive: true });
  pointer.addEventListener("change", refresh);
  motion.addEventListener("change", refresh);
  page.addEventListener("visibilitychange", refresh);
  view.addEventListener("resize", resize);
  refresh();

  return () => {
    clear();
    observer.disconnect();
    host.removeEventListener("pointermove", move);
    pointer.removeEventListener("change", refresh);
    motion.removeEventListener("change", refresh);
    page.removeEventListener("visibilitychange", refresh);
    view.removeEventListener("resize", resize);
  };
};
