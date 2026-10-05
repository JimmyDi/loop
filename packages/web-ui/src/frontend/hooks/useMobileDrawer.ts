import { useEffect } from "react";
import type { RefObject } from "react";

export const useMobileDrawer = (
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  close: (open: boolean) => void,
) => {
  useEffect(() => {
    const element = ref.current;

    if (!element) return;

    const media = window.matchMedia("(max-width: 767px)");
    const previous = document.activeElement as HTMLElement | null;
    const update = () => {
      element.inert = media.matches && !open;
    };
    const keydown = (event: KeyboardEvent) => {
      if (!open || !media.matches) return;

      if (event.key === "Escape") close(false);

      if (event.key !== "Tab") return;

      const controls = [
        ...element.querySelectorAll<HTMLElement>(
          "button:not(:disabled),select,input,[tabindex='0']",
        ),
      ];
      const first = controls[0];
      const last = controls.at(-1);

      if (
        (event.shiftKey && document.activeElement === first) ||
        (!event.shiftKey && document.activeElement === last)
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    };

    update();

    if (open && media.matches) element.querySelector<HTMLElement>("button")?.focus();

    media.addEventListener("change", update);
    element.addEventListener("keydown", keydown);

    return () => {
      media.removeEventListener("change", update);
      element.removeEventListener("keydown", keydown);

      if (open && media.matches) previous?.focus();
    };
  }, [ref, open, close]);
};
