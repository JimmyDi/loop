import { useLayoutEffect, useRef } from "react";

export const useVisualViewport = () => {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    const viewport = window.visualViewport;
    if (!element || !viewport) return;

    const update = () => {
      if (Math.abs(viewport.scale - 1) > 0.01) return;
      element.style.setProperty("--app-viewport-height", `${viewport.height}px`);
      element.style.setProperty("--app-viewport-top", `${viewport.offsetTop}px`);
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      element.style.removeProperty("--app-viewport-height");
      element.style.removeProperty("--app-viewport-top");
    };
  }, []);

  return ref;
};
