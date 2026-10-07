import { useLayoutEffect, useRef, useState } from "react";

import { fitSkillScopes } from "../components/settings/skill-scope-layout";

export const useSkillScopeLayout = (labels: string[], selected: number) => {
  const root = useRef<HTMLDivElement>(null);
  const measurements = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState<number[]>();
  const signature = JSON.stringify(labels);
  useLayoutEffect(() => {
    const element = root.current;
    const mirror = measurements.current;
    if (!element || !mirror) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const available = element.getBoundingClientRect().width;
      if (!available) return;
      const widths = [...mirror.children].map((child) => child.getBoundingClientRect().width);
      const moreWidth = widths.pop() ?? 36;
      const gap = Number.parseFloat(window.getComputedStyle(mirror).columnGap) || 0;
      const next = fitSkillScopes(available, widths, moreWidth, selected, gap);
      setVisible((current) => (current?.join() === next.join() ? current : next));
    };
    measure();
    window.addEventListener("resize", measure);
    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(element);
    observer?.observe(mirror);
    void element.ownerDocument.fonts?.ready.then(measure);
    return () => {
      disposed = true;
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [signature, selected]);
  return {
    root,
    measurements,
    visible: visible?.filter((index) => index < labels.length) ?? labels.map((_, index) => index),
  };
};
