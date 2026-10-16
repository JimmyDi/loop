import { useEffect, useRef, useState } from "react";

export const useCopyCommand = (command: string) => {
  const codeRef = useRef<HTMLElement>(null);
  const active = useRef(true);
  const [feedback, setFeedback] = useState<"copied" | "copyFallback" | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(command);
      if (active.current) setFeedback("copied");
    } catch {
      if (!active.current) return;
      const code = codeRef.current;
      if (code) {
        const range = document.createRange();
        range.selectNodeContents(code);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      setFeedback("copyFallback");
    }
  };
  return { codeRef, feedback, copy };
};
