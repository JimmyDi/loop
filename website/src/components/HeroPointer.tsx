import type { RefObject } from "react";
import { useEffect, useRef } from "react";

import styles from "./HeroPointer.module.css";

export const HeroPointer = ({ hostRef }: { hostRef: RefObject<HTMLElement | null> }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let active = true;
    let pending = false;
    let dispose: (() => void) | undefined;
    const activate = async (event: PointerEvent) => {
      if (
        pending ||
        event.pointerType !== "mouse" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        return;
      pending = true;
      try {
        const { initializeHeroPointer } = await import("../hero-pointer");
        if (!active) return;
        dispose = initializeHeroPointer(host, canvas);
        host.removeEventListener("pointermove", activate);
      } catch {
        pending = false;
      }
    };
    host.addEventListener("pointermove", activate, { passive: true });
    return () => {
      active = false;
      host.removeEventListener("pointermove", activate);
      dispose?.();
    };
  }, [hostRef]);
  return <canvas ref={canvasRef} className={styles["hero-pointer"]} aria-hidden="true" />;
};
