import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

export const useProjectMenu = (point?: { x: number; y: number }) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = (restore = true) => {
    setOpen(false);
    if (restore) trigger.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = trigger.current?.getBoundingClientRect();
    const menu = panel.current;
    if (!anchor || !menu) return;
    setPosition({
      top: Math.max(
        8,
        Math.min(point?.y ?? anchor.bottom + 6, window.innerHeight - menu.offsetHeight - 8),
      ),
      left: Math.max(
        8,
        Math.min(
          point?.x ?? anchor.right - menu.offsetWidth,
          window.innerWidth - menu.offsetWidth - 8,
        ),
      ),
    });
    (menu.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? menu).focus();
  }, [open, point?.x, point?.y]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
    };
    const reposition = () => setOpen(false);
    const scroll = (event: Event) => {
      if (!panel.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === "Tab") {
      close();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = [
      ...(panel.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ??
        []),
    ];
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (current + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
    items[next]?.focus();
  };

  return { open, setOpen, position, trigger, panel, close, navigate };
};
