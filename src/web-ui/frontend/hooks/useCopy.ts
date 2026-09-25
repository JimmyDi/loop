import { useEffect, useRef, useState } from "react";

export const useCopy = () => {
  const [status, setStatus] = useState<"copy" | "copied" | "copyFailed">("copy");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async (text: string) => {
    clearTimeout(timer.current);

    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("copyFailed");
    }

    timer.current = setTimeout(() => setStatus("copy"), 1600);
  };

  return { status, copy };
};
