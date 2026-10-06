import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

export const useProjectPopoverHeight = (open: boolean, root: RefObject<HTMLDivElement | null>) => {
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const anchor = root.current;
    if (!open || !anchor) return;
    const bounds = anchor.closest(".chat-workspace-body");
    const update = () => {
      const top = Math.max(0, bounds?.getBoundingClientRect().top ?? 0);
      setHeight(Math.max(0, anchor.getBoundingClientRect().top - top - 14));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
    observer?.observe(anchor.closest(".composer-region") ?? anchor);
    if (bounds) observer?.observe(bounds);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      observer?.disconnect();
    };
  }, [open, root]);
  return height === undefined ? undefined : `min(320px, ${height}px)`;
};
