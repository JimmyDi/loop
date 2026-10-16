import { useEffect } from "react";
import type { RefObject } from "react";

export const useHeaderScroll = (ref: RefObject<HTMLElement | null>): void => {
  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame: number | undefined;
    let previous: number | undefined;
    const update = () => {
      frame = undefined;
      const offset = Math.max(0, window.scrollY);
      const progress = motion.matches ? Number(offset > 0) : Math.min(1, offset / 120);
      if (progress === previous) return;
      previous = progress;
      header.style.setProperty("--header-progress", String(progress));
      header.dataset.floating = String(progress > 0);
    };
    const schedule = () => {
      if (frame === undefined) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("pageshow", schedule);
    motion.addEventListener("change", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("pageshow", schedule);
      motion.removeEventListener("change", schedule);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [ref]);
};
