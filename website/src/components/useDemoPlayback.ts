import { useEffect, useRef, useState } from "react";

type DemoFrame = { duration: number };

export const useDemoPlayback = (frames: readonly DemoFrame[], language: string) => {
  const root = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  const [inView, setInView] = useState(false);
  const [dark, setDark] = useState(false);
  const sourceKey = `${language}-${dark ? "dark" : "light"}`;
  const [loaded, setLoaded] = useState({ key: sourceKey, frames: new Set<number>() });
  const [requested, setRequested] = useState({ key: sourceKey, frames: new Set([0]) });

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const theme = window.matchMedia("(prefers-color-scheme: dark)");
    const updateMotion = () => setReduced(media.matches);
    const updateTheme = () => setDark(theme.matches);
    const updateVisibility = () => setVisible(!document.hidden);
    updateMotion();
    updateTheme();
    updateVisibility();
    media.addEventListener("change", updateMotion);
    theme.addEventListener("change", updateTheme);
    document.addEventListener("visibilitychange", updateVisibility);
    const observer = new IntersectionObserver(([entry]) => setInView(!!entry?.isIntersecting));
    if (root.current) observer.observe(root.current);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", updateMotion);
      theme.removeEventListener("change", updateTheme);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  const playing = !paused && !reduced;
  const active = playing && visible && inView;
  const next = (frame + 1) % frames.length;

  useEffect(() => {
    setRequested((current) => {
      const indices = current.key === sourceKey ? current.frames : new Set<number>();
      if (current.key === sourceKey && indices.has(frame) && (!active || indices.has(next)))
        return current;
      return { key: sourceKey, frames: new Set([...indices, frame, ...(active ? [next] : [])]) };
    });
  }, [active, frame, next, sourceKey]);

  useEffect(() => {
    if (!active || loaded.key !== sourceKey || !loaded.frames.has(frame)) return;
    if (!loaded.frames.has(next)) return;
    const timer = window.setTimeout(() => setFrame(next), frames[frame]!.duration);
    return () => window.clearTimeout(timer);
  }, [active, frame, frames, loaded, next, sourceKey]);

  const onLoad = (index: number) => {
    setLoaded((current) => {
      const indices = current.key === sourceKey ? current.frames : new Set<number>();
      if (current.key === sourceKey && indices.has(index)) return current;
      return { key: sourceKey, frames: new Set([...indices, index]) };
    });
  };

  const shouldLoad = (index: number) =>
    index === frame || (requested.key === sourceKey && requested.frames.has(index));

  // Cached prerendered images can finish before React attaches the load handler.
  useEffect(() => {
    root.current?.querySelectorAll("img").forEach((image, index) => {
      if (image.complete && image.naturalWidth > 0) onLoad(index);
    });
  }, [sourceKey, requested]);

  return {
    root,
    frame,
    playing,
    reduced,
    sourceKey,
    shouldLoad,
    onLoad,
    toggle: () => setPaused(!paused),
  };
};
