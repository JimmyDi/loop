import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import type { SessionHistoryPage, SessionSnapshot } from "../../shared/protocol";
import { projectTools } from "../../shared/tool-projection";
import { api } from "../lib/api";

type WindowPage = SessionHistoryPage & { sessionId: string };

/** A detached history window never replaces the live session or its SSE cursor. */
export const useTimelineWindow = (
  live: SessionSnapshot,
  viewport: RefObject<HTMLDivElement | null>,
) => {
  const [page, setPage] = useState<WindowPage>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const request = useRef<AbortController | undefined>(undefined);
  const retry = useRef<() => void>(() => {});
  const [target, setTarget] = useState<{ key: string; request: number }>();
  const [selected, setSelected] = useState(false);
  const sequence = useRef(0);
  const current =
    page?.sessionId === live.sessionId && page.streamId === live.streamId ? page : undefined;
  const joined = current && current.end >= (live.history?.start ?? 0);
  const messages = current
    ? joined
      ? [
          ...current.messages.slice(0, Math.max(0, (live.history?.start ?? 0) - current.start)),
          ...live.state.messages,
        ]
      : current.messages
    : live.state.messages;
  const snapshot: SessionSnapshot = current
    ? {
        ...live,
        operation: joined ? live.operation : "idle",
        history: {
          start: current.start,
          userStart: current.userStart,
          total: live.history?.total ?? live.state.messages.length,
        },
        state: {
          ...live.state,
          messages,
          isRunning: !!joined && live.state.isRunning,
          draft: joined ? live.state.draft : undefined,
        },
        tools: { ...projectTools(messages), ...(joined ? live.tools : {}) },
      }
    : live;
  const cancel = () => {
    request.current?.abort();
    setLoading(false);
    setError(false);
  };
  useEffect(() => {
    setPage(undefined);
    setSelected(false);
    setTarget(undefined);
    setLoading(false);
    setError(false);
    return () => request.current?.abort();
  }, [live.sessionId, live.streamId]);
  const load = (index: number, jump: boolean) => {
    cancel();
    const abort = new AbortController();
    request.current = abort;
    setLoading(true);
    const sessionId = live.sessionId;
    const streamId = live.streamId;
    retry.current = () => load(index, jump);
    void api<SessionHistoryPage>(
      "/sessions/" +
        encodeURIComponent(sessionId) +
        "/history?" +
        (jump ? "target=" : "after=") +
        index +
        "&streamId=" +
        encodeURIComponent(streamId),
      { signal: abort.signal, priority: "high" },
    )
      .then((result) => {
        if (abort.signal.aborted || result.streamId !== streamId) return;
        setPage((previous) =>
          !jump && previous?.end === result.start
            ? {
                ...previous,
                end: result.end,
                total: result.total,
                messages: [...previous.messages, ...result.messages],
              }
            : { ...result, sessionId },
        );
        if (jump) setTarget({ key: sessionId + ":" + index, request: ++sequence.current });
        setLoading(false);
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setLoading(false);
          setError(true);
        }
      });
  };
  const select = (index: number) => {
    cancel();
    setSelected(true);
    const liveStart = live.history?.start ?? 0;
    if (index >= liveStart && index < liveStart + live.state.messages.length) {
      setPage(undefined);
      setTarget({ key: live.sessionId + ":" + index, request: ++sequence.current });
      return;
    }
    const offset = snapshot.history?.start ?? 0;
    if (index >= offset && index < offset + messages.length)
      setTarget({ key: live.sessionId + ":" + index, request: ++sequence.current });
    else load(index, true);
  };
  return {
    snapshot,
    target,
    get navigating() {
      return selected;
    },
    loading,
    error,
    cancel,
    select,
    detached: !!current && !joined,
    retry: () => retry.current(),
    complete: () => setTarget(undefined),
    latest: () => {
      cancel();
      setPage(undefined);
      setSelected(false);
      setTarget(undefined);
    },
    prepend: current
      ? (earlier: SessionHistoryPage) => {
          if (earlier.streamId !== current.streamId || earlier.end !== current.start) return false;
          setPage({
            ...current,
            start: earlier.start,
            userStart: earlier.userStart,
            messages: [...earlier.messages, ...current.messages],
          });
          return true;
        }
      : undefined,
    forward: () => {
      const element = viewport.current;
      if (
        current &&
        !joined &&
        !loading &&
        !error &&
        element &&
        element.scrollHeight - element.scrollTop - element.clientHeight < 160
      )
        load(current.end, false);
    },
  };
};
