import { useLayoutEffect, useRef } from "react";

/** Follow live activity only while the reader stays near the bottom. */
export const useReasoningScroll = (revision: unknown, active: boolean) => {
  const ref = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const onScroll = () => {
    const element = ref.current;
    if (element)
      following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 40;
  };

  useLayoutEffect(() => {
    const element = ref.current;
    if (active && following.current && element && element.clientHeight > 0)
      element.scrollTop = element.scrollHeight;
  }, [revision, active]);

  return { ref, onScroll };
};
