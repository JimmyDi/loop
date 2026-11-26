import { useCallback, useEffect, useRef, useState } from "react";

type SearchIndex = Record<string, Record<string, string>>;

export const useDocsSearch = () => {
  const [index, setIndex] = useState<SearchIndex>();
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const pending = useRef(false);
  const mounted = useRef(false);
  const load = useCallback(async () => {
    if (pending.current || index) return;
    pending.current = true;
    setStatus("loading");
    try {
      const { default: data } = await import("virtual:docs-search");
      if (mounted.current) {
        setIndex(data);
        setStatus("ready");
      }
    } catch {
      if (mounted.current) setStatus("error");
    } finally {
      pending.current = false;
    }
  }, [index]);

  useEffect(() => {
    mounted.current = true;
    let idle: number | undefined;
    let timer: number | undefined;
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") {
        idle = window.requestIdleCallback(() => void load());
      } else {
        timer = window.setTimeout(() => void load(), 1000);
      }
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      mounted.current = false;
      window.removeEventListener("load", schedule);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [load]);

  return { index, status, load };
};
