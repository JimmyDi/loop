import { useEffect } from "react";
import type { RefObject } from "react";

import type { SessionSnapshot } from "../../shared/protocol";
import { latestCompletedTurn } from "../../shared/completed-turn";
import { useReadState } from "../state/read-store";

/** A selected chat is read only once its completed content reaches the visible viewport. */
export const useReadReceipt = (
  snapshot: SessionSnapshot,
  connected: boolean,
  viewport: RefObject<HTMLDivElement | null>,
  end: RefObject<HTMLDivElement | null>,
): void => {
  const turn = latestCompletedTurn(snapshot.state.runTimings, snapshot.state.messages.length);
  const settled = connected && snapshot.operation !== "prompt";

  useEffect(() => {
    const element = viewport.current;
    const marker = end.current;
    if (!settled || turn === undefined || !element || !marker) return;
    const document = element.ownerDocument;
    const window = document.defaultView;
    const check = () => {
      if (
        document.visibilityState !== "visible" ||
        !document.hasFocus() ||
        document.querySelector("dialog[open], .sidebar-scrim") ||
        element.clientHeight <= 0
      )
        return;
      const top = element.getBoundingClientRect().top;
      const bottom = marker.getBoundingClientRect().top;
      if (bottom >= top && bottom <= top + element.clientHeight + 2)
        useReadState.getState().markRead(snapshot.sessionId, turn);
    };
    check();
    element.addEventListener("scroll", check);
    document.addEventListener("visibilitychange", check);
    document.addEventListener("focusin", check);
    window?.addEventListener("focus", check);
    window?.addEventListener("resize", check);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(check);
    observer?.observe(element);
    if (marker.parentElement) observer?.observe(marker.parentElement);

    return () => {
      element.removeEventListener("scroll", check);
      document.removeEventListener("visibilitychange", check);
      document.removeEventListener("focusin", check);
      window?.removeEventListener("focus", check);
      window?.removeEventListener("resize", check);
      observer?.disconnect();
    };
  }, [snapshot.sessionId, turn, settled, viewport, end]);
};
