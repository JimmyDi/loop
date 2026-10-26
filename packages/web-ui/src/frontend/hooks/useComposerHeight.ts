import { useLayoutEffect, useRef } from "react";

export const useComposerHeight = () => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    const parent = element?.closest<HTMLElement>(".chat-workspace-input");
    if (!element || !parent || typeof ResizeObserver === "undefined") return;
    const update = () => parent.style.setProperty("--composer-height", element.offsetHeight + "px");
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => {
      observer.disconnect();
      parent.style.removeProperty("--composer-height");
    };
  }, []);
  return ref;
};
