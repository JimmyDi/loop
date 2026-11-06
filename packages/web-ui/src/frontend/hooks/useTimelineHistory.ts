import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import type { TimelineTurn } from "../components/chat/timeline-turns";
import type { SessionSnapshot, SessionHistoryPage } from "../../shared/protocol";
import { api } from "../lib/api";
import { holdHistoryPosition } from "./timeline-history-position";
import { useSessions } from "../state/session-store";

const initialStart = (turns: readonly TimelineTurn[]) => {
  let rounds = 0;
  for (let position = turns.length - 1; position >= 0; position--) {
    if (turns[position]!.type === "user" && ++rounds === 3) return position;
  }
  return 0;
};

export const useTimelineHistory = (
  sessionId: string,
  turns: readonly TimelineTurn[],
  ref: RefObject<HTMLDivElement | null>,
  onReveal: () => void,
  snapshot?: SessionSnapshot,
  prepend?: (page: SessionHistoryPage) => boolean,
) => {
  const [window, setWindow] = useState(() => ({ sessionId, index: initialStart(turns) }));
  const position = useRef<ReturnType<typeof holdHistoryPosition> | undefined>(undefined);
  const pending = useRef(false);
  const [restoring, setRestoring] = useState(false);
  const lastTop = useRef(0);
  const programmatic = useRef(false);
  const touchY = useRef<number | undefined>(undefined);
  const loading = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const request = useRef<AbortController | undefined>(undefined);
  const [error, setError] = useState(false);
  useEffect(() => {
    setIsLoading(false);
    setError(false);
    const element = ref.current;
    const preventScroll = (event: Event) => {
      if (loading.current) event.preventDefault();
    };
    element?.addEventListener("wheel", preventScroll, { passive: false });
    element?.addEventListener("touchmove", preventScroll, { passive: false });
    return () => {
      element?.removeEventListener("wheel", preventScroll);
      element?.removeEventListener("touchmove", preventScroll);
      request.current?.abort();
      position.current?.restore();
      position.current = undefined;
      loading.current = false;
      pending.current = false;
    };
  }, [sessionId, snapshot?.streamId, ref]);
  const current =
    window.sessionId === sessionId ? window : { sessionId, index: initialStart(turns) };
  if (current !== window) {
    pending.current = false;
    setWindow(current);
  }
  const start = snapshot?.history ? 0 : Math.min(current.index, turns.length);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (pending.current) {
      position.current?.restore(true);
      if (!restoring) {
        setRestoring(true);
        return;
      }
      setRestoring(false);
      position.current = undefined;
      pending.current = false;
      loading.current = false;
    }
    lastTop.current = element.scrollTop;
  });

  const reveal = (force = false) => {
    const element = ref.current;
    if (!element || (!force && element.scrollTop > 120) || pending.current || loading.current)
      return;
    if (snapshot?.history) {
      if (!snapshot.history.start) return;
      position.current = holdHistoryPosition(element);
      loading.current = true;
      setIsLoading(true);
      setError(false);
      onReveal();
      const before = snapshot.history.start;
      const abort = new AbortController();
      request.current = abort;
      void api<SessionHistoryPage>(
        "/sessions/" +
          encodeURIComponent(sessionId) +
          "/history?before=" +
          before +
          "&streamId=" +
          encodeURIComponent(snapshot.streamId),
        { signal: abort.signal, priority: "high" },
      )
        .then((page) => {
          if (abort.signal.aborted) return;
          if (
            prepend ||
            useSessions.getState().views[sessionId]?.snapshot?.history?.start === before
          ) {
            pending.current = true;
            if (!(prepend ? prepend(page) : useSessions.getState().prepend(sessionId, page)))
              pending.current = false;
          }
          if (!pending.current) {
            position.current?.restore(false);
            position.current = undefined;
            loading.current = false;
          }
          setIsLoading(false);
        })
        .catch(() => {
          if (abort.signal.aborted) return;
          position.current?.restore(false);
          position.current = undefined;
          loading.current = false;
          setIsLoading(false);
          setError(true);
        });
      return;
    }
    if (start === 0) return;
    onReveal();
    let index = start;
    let rounds = 0;
    while (index > 0) {
      index--;
      if (turns[index]!.type === "user" && ++rounds === 3) break;
    }
    position.current = holdHistoryPosition(element);
    pending.current = true;
    setWindow({ sessionId, index });
  };

  return {
    cancel: () => {
      programmatic.current = true;
      request.current?.abort();
      position.current?.restore();
      position.current = undefined;
      pending.current = false;
      loading.current = false;
      setIsLoading(false);
      setError(false);
    },
    show: (index: number) => {
      setError(false);
      if (!snapshot?.history)
        setWindow({
          sessionId,
          index: Math.min(
            start,
            Math.max(
              0,
              turns.findIndex((turn) => turn.index === index),
            ),
          ),
        });
    },
    start,
    loading: isLoading,
    error,
    retry: () => reveal(true),
    onScroll: () => {
      if (loading.current) {
        if (!pending.current) position.current?.freeze();
        return false;
      }
      const top = ref.current?.scrollTop ?? 0;
      if (!programmatic.current && top < lastTop.current) reveal();
      lastTop.current = top;
      return !loading.current;
    },
    onWheel: (event: React.WheelEvent) => {
      programmatic.current = false;
      if (event.deltaY < 0) reveal();
    },
    onTouchStart: (event: React.TouchEvent) => {
      programmatic.current = false;
      touchY.current = event.touches[0]?.clientY;
    },
    onTouchMove: (event: React.TouchEvent) => {
      const y = event.touches[0]?.clientY;
      if (y !== undefined && touchY.current !== undefined && y > touchY.current) reveal();
      touchY.current = y;
    },
  };
};
