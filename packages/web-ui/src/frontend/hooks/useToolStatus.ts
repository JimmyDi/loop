import { useLayoutEffect, useRef, useState } from "react";

import type { ToolView } from "../../shared/protocol";

const MIN_RUNNING_MS = 200;

/** Smooth only the icon; execution state and results remain immediate. */
export const useToolStatus = (id: string, status: ToolView["status"]): ToolView["status"] => {
  const started = useRef<{ id: string; at: number } | undefined>(undefined);
  const [heldId, setHeldId] = useState<string>();

  useLayoutEffect(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (status === "running") {
      if (started.current?.id !== id) started.current = { id, at: performance.now() };
      setHeldId(id);
      return;
    }

    const remaining =
      status === "success" && started.current?.id === id && !reducedMotion && !document.hidden
        ? MIN_RUNNING_MS - (performance.now() - started.current.at)
        : 0;
    const finish = () => {
      started.current = undefined;
      setHeldId(undefined);
    };
    if (remaining <= 0) {
      finish();
      return;
    }

    const timer = window.setTimeout(finish, remaining);
    const hide = () => {
      if (document.hidden) {
        window.clearTimeout(timer);
        finish();
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [id, status]);

  return status === "success" && heldId === id ? "running" : status;
};
