import type { RefObject } from "react";
import { useEffect, useRef } from "react";

import { initializeHeroPointer } from "../hero-pointer";
import styles from "./HeroPointer.module.css";

export const HeroPointer = ({ hostRef }: { hostRef: RefObject<HTMLElement | null> }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    return initializeHeroPointer(host, canvas);
  }, [hostRef]);
  return <canvas ref={canvasRef} className={styles["hero-pointer"]} aria-hidden="true" />;
};
