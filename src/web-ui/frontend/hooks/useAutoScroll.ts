import { useLayoutEffect, useRef, useState } from "react";

export const useAutoScroll = (revision: unknown) => {
  const ref = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const jump = () => {
    const element = ref.current;

    if (element) element.scrollTop = element.scrollHeight;

    following.current = true;
    setAtBottom(true);
  };
  const onScroll = () => {
    const element = ref.current;

    if (!element) return;

    following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    setAtBottom(following.current);
  };

  useLayoutEffect(() => {
    if (following.current) jump();
  }, [revision]);

  useLayoutEffect(() => {
    if (!ref.current || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      if (following.current) jump();
    });

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, []);

  return { ref, onScroll, atBottom, jump };
};
