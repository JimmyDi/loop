import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { renderMermaid } from "../lib/mermaid";
import { createMermaidCopyButton } from "../lib/mermaid-copy";
import { useTheme } from "../state/theme-store";

type Diagram = { source: string; dark: boolean; svg: string };

export const useMermaid = (html: string, streaming: boolean) => {
  const ref = useRef<HTMLDivElement>(null);
  const cache = useRef(new Map<number, Diagram>());
  const theme = useTheme((state) => state.theme);
  const { t } = useTranslation();
  const [systemDark, setSystemDark] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-color-scheme: dark)").matches,
  );
  const dark = theme === "dark" || (theme === "system" && systemDark);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const controller = new AbortController();
    const codes = [...root.querySelectorAll<HTMLElement>("pre > code.language-mermaid")];
    const restores: (() => void)[] = [];

    // Keep only current blocks, not an ever-growing cache of streamed drafts.
    for (const index of cache.current.keys()) {
      if (index >= codes.length) cache.current.delete(index);
    }

    const draw = async () => {
      for (const [index, code] of codes.entries()) {
        if (controller.signal.aborted) return;
        const pre = code.parentElement!;
        const source = code.textContent ?? "";
        if (!source.trim()) continue;
        const saved = cache.current.get(index);
        try {
          const svg =
            saved?.source === source && saved.dark === dark
              ? saved.svg
              : await renderMermaid(source, dark, controller.signal);
          if (controller.signal.aborted) return;
          cache.current.set(index, { source, dark, svg });

          const figure = document.createElement("div");
          figure.className = "markdown-mermaid";
          const preview = document.createElement("div");
          preview.className = "markdown-mermaid-preview";
          preview.setAttribute("role", "region");
          preview.setAttribute("aria-label", t("mermaidDiagram"));
          preview.tabIndex = 0;
          preview.innerHTML = svg;
          const { button, dispose } = createMermaidCopyButton(source, {
            copy: t("mermaidCopy"),
            copied: t("copied"),
            failed: t("copyFailed"),
          });
          pre.hidden = true;
          pre.before(figure);
          figure.append(button, preview, pre);
          restores.push(() => {
            dispose();
            pre.hidden = false;
            figure.replaceWith(pre);
          });
        } catch {
          if (controller.signal.aborted) return;
          cache.current.delete(index);
          if (streaming) continue;
          const notice = document.createElement("p");
          notice.className = "markdown-mermaid-error";
          notice.textContent = t("mermaidFailed");
          pre.after(notice);
          restores.push(() => notice.remove());
        }
      }
    };

    // Avoid parsing each token of an unfinished diagram; the source remains readable meanwhile.
    const timer = window.setTimeout(() => void draw(), streaming ? 200 : 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      for (const restore of restores) restore();
    };
  }, [html, dark, streaming, t]);

  return ref;
};
