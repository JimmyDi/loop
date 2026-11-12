import { useLayoutEffect, useRef, useState } from "react";

export const useNavigationRail = (
  activePosition: number,
  hoverPosition: number,
  count: number,
  identity: string,
) => {
  const marks = useRef<HTMLDivElement>(null);
  const initialized = useRef<string | undefined>(undefined);
  const [layout, setLayout] = useState({
    above: false,
    below: false,
    previewTop: undefined as number | undefined,
    previewSpaceBelow: 0,
  });
  const measure = () => {
    const element = marks.current;
    if (!element) return;
    const mark = element.children[hoverPosition] as HTMLElement | undefined;
    const center = mark ? mark.offsetTop + mark.offsetHeight / 2 - element.scrollTop : -1;
    const previewTop = center >= 0 && center <= element.clientHeight ? center : undefined;
    const previewSpaceBelow = element.clientHeight - center;
    const above = element.scrollTop > 1;
    const below = element.scrollHeight - element.clientHeight - element.scrollTop > 1;
    setLayout((previous) =>
      previous.above === above &&
      previous.below === below &&
      previous.previewTop === previewTop &&
      previous.previewSpaceBelow === previewSpaceBelow
        ? previous
        : { above, below, previewTop, previewSpaceBelow },
    );
  };
  const measurement = useRef(measure);
  measurement.current = measure;
  useLayoutEffect(() => {
    const element = marks.current;
    const owner = element?.ownerDocument.defaultView;
    if (!element || !owner) return;
    const follow = () => {
      const mark = element.children[activePosition] as HTMLElement | undefined;
      if (mark && element.clientHeight > 0) {
        const center = mark.offsetTop + mark.offsetHeight / 2;
        const upper = Math.min(mark.offsetHeight / 2 + 4, element.clientHeight / 2);
        const lower = element.clientHeight - upper;
        const top = Math.max(
          0,
          Math.min(
            element.scrollHeight - element.clientHeight,
            Math.max(center - lower, Math.min(element.scrollTop, center - upper)),
          ),
        );
        const behavior =
          initialized.current !== identity ||
          owner.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth";
        if (Math.abs(top - element.scrollTop) > 1) element.scrollTo({ top, behavior });
        initialized.current = identity;
      }
      measurement.current();
    };
    follow();
    const observer = new owner.ResizeObserver(follow);
    observer.observe(element);
    owner.addEventListener("resize", follow);
    return () => {
      observer.disconnect();
      owner.removeEventListener("resize", follow);
    };
  }, [activePosition, count, identity]);
  useLayoutEffect(measure, [hoverPosition, count]);
  return { marks, ...layout, onScroll: measure };
};
