import { useEffect } from "react";
import type { RefObject } from "react";

import type { SessionSnapshot } from "../../shared/protocol";
import { command } from "../lib/api";

/** A selected chat is read only once its completed content reaches the visible viewport. */
export const useReadReceipt = (
  snapshot: SessionSnapshot,
  connected: boolean,
  viewport: RefObject<HTMLDivElement | null>,
  end: RefObject<HTMLDivElement | null>,
): void => {
  const messageCount = snapshot.state.messages.length;
  const unread = snapshot.state.unread === true;
  const settled = connected && snapshot.operation === "idle" && !snapshot.state.hasPendingSave;

  useEffect(() => {
    const element = viewport.current;
    const marker = end.current;
    if (!settled || !unread || !messageCount || !element || !marker) return;
    const document = element.ownerDocument;
    const window = document.defaultView;
    let disposed = false;
    let saving = false;
    let saved = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      if (
        disposed ||
        saving ||
        saved ||
        document.visibilityState !== "visible" ||
        !document.hasFocus() ||
        document.querySelector("dialog[open], .sidebar-scrim") ||
        element.clientHeight <= 0
      )
        return;
      const top = element.getBoundingClientRect().top;
      const bottom = marker.getBoundingClientRect().top;
      if (bottom >= top && bottom <= top + element.clientHeight + 2) {
        saving = true;
        clearTimeout(retry);
        void command<{ read: boolean }>(
          "/sessions/" + encodeURIComponent(snapshot.sessionId) + "/read",
          { workspaceId: snapshot.workspaceId, messageCount },
          "PUT",
        )
          .then((result) => result.read === true)
          .catch(() => false)
          .then((read) => {
            saving = false;
            saved = read;
            if (!saved && !disposed) retry = setTimeout(check, 3000);
          });
      }
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
      disposed = true;
      clearTimeout(retry);
      element.removeEventListener("scroll", check);
      document.removeEventListener("visibilitychange", check);
      document.removeEventListener("focusin", check);
      window?.removeEventListener("focus", check);
      window?.removeEventListener("resize", check);
      observer?.disconnect();
    };
  }, [snapshot.sessionId, snapshot.workspaceId, messageCount, unread, settled, viewport, end]);
};
