import { useEffect, useMemo, useState } from "react";

import { renderMarkdown } from "../lib/markdown";
import type { MarkdownEnhancements } from "../lib/markdown";

export const useMarkdown = (text: string, copyLabel: string, tableLabel: string): string => {
  const [enhancements, setEnhancements] = useState<MarkdownEnhancements>({});
  const math = text.includes("$");
  const code = /```|~~~|<pre[\s>]/i.test(text);
  useEffect(() => {
    let disposed = false;
    if (math) {
      void import("../lib/markdown-math")
        .then(({ mathParser }) => {
          if (!disposed) setEnhancements((previous) => ({ ...previous, math: mathParser }));
        })
        .catch(() => {});
    }
    if (code) {
      void import("../lib/markdown-highlight")
        .then(({ highlightCode }) => {
          if (!disposed) setEnhancements((previous) => ({ ...previous, highlight: highlightCode }));
        })
        .catch(() => {});
    }
    return () => {
      disposed = true;
    };
  }, [math, code]);
  return useMemo(
    () => renderMarkdown(text, copyLabel, tableLabel, enhancements),
    [text, copyLabel, tableLabel, enhancements],
  );
};
