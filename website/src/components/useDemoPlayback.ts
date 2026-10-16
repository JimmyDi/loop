import { useEffect, useRef, useState } from "react";

type DemoFrame = { duration: number };

export const useDemoPlayback = (frames: readonly DemoFrame[]) => {
  const root = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReduced(media.matches);
    const updateVisibility = () => setVisible(!document.hidden);
    updateMotion();
    updateVisibility();
    media.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    const observer = new IntersectionObserver(([entry]) => setInView(!!entry?.isIntersecting));
    if (root.current) observer.observe(root.current);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  const playing = !paused && !reduced;

  useEffect(() => {
    if (!playing || !visible || !inView) return;
    const timer = window.setTimeout(
      () => setFrame((current) => (current + 1) % frames.length),
      frames[frame]!.duration,
    );
    return () => window.clearTimeout(timer);
  }, [frame, frames, inView, playing, visible]);

  return { root, frame, playing, reduced, toggle: () => setPaused(!paused) };
};
