import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

export const useComposerMenu = (disabled: boolean, pending: boolean, autoFocus = true) => {
  const [page, setPage] = useState<"main" | "model" | "effort" | undefined>();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  const focusOnOpen = useRef(autoFocus);
  const open = (next: "main" | "model" | "effort", focus = autoFocus) => {
    focusOnOpen.current = focus;
    setPage(next);
  };
  const close = (restore = true) => {
    restoreFocus.current = restore;
    setPage(undefined);
    if (restore) trigger.current?.focus();
  };
  useLayoutEffect(() => {
    if (!page && restoreFocus.current && !disabled && !pending) {
      restoreFocus.current = false;
      trigger.current?.focus();
    }
  }, [page, disabled, pending]);
  useEffect(() => {
    if (!page) return;
    const target = panel.current?.querySelector<HTMLElement>(
      'input, [aria-checked="true"], [role="menuitemradio"]:not(:disabled), [role="menuitem"]',
    );
    if (focusOnOpen.current) target?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setPage(undefined);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [page]);
  useEffect(() => {
    if (disabled && !pending) setPage(undefined);
  }, [disabled, pending]);
  const navigate = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowRight" && page === "main") {
      const target = document.activeElement as HTMLElement | null;
      if (target?.getAttribute("aria-haspopup") === "menu") {
        event.preventDefault();
        target.click();
      }
      return;
    }
    if (event.key === "Escape" || (event.key === "ArrowLeft" && page !== "main")) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "ArrowLeft") setPage("main");
      else close();
      return;
    }
    if (event.key === "Tab") {
      close();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    if ((event.target as HTMLElement).tagName === "INPUT" && ["Home", "End"].includes(event.key))
      return;
    const options = [
      ...(panel.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not(:disabled), [role="menuitemradio"]:not(:disabled)',
      ) ?? []),
    ];
    if (!options.length) return;
    event.preventDefault();
    const current = options.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : event.key === "ArrowDown"
            ? (current + 1) % options.length
            : current < 0
              ? options.length - 1
              : (current + options.length - 1) % options.length;
    options[next]?.focus();
  };
  return { page, setPage, root, trigger, panel, close, open, navigate };
};
