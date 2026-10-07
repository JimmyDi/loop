import { useEffect, useRef, useState } from "react";

export const useCopy = () => {
  const [status, setStatus] = useState<"copy" | "copied" | "copyFailed">("copy");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async (text: string, html?: string) => {
    clearTimeout(timer.current);

    try {
      if (html && typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              "text/plain": new Blob([text], { type: "text/plain" }),
              "text/html": new Blob([html], { type: "text/html" }),
            }),
          ]);
        } catch {
          await navigator.clipboard.writeText(text);
        }
      } else await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("copyFailed");
    }

    timer.current = setTimeout(() => setStatus("copy"), 1600);
  };

  return { status, copy };
};
